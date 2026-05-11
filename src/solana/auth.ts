import { createPublicKey, verify, sign, createPrivateKey } from 'crypto';
import { base58Decode, base58Encode } from './base58.js';
import { getDelegationsForGroup } from '../db/solana-delegations.js';
import type { SignatureBase58, SignedDelegation, SolanaAddress } from './types.js';

/**
 * Authorization layer.
 *
 * Today, owner/admin grants live in `user_roles` rows in the central DB.
 * The Solana-native model is **signed delegations**: a principal (a Solana
 * pubkey) signs a message authorizing a delegate to act with `owner` or
 * `admin` scope, optionally bound to one agent group and a validity window.
 *
 * Verification is implemented here. Persistence (DB or on-chain registry)
 * is not — call sites pass delegations they've already fetched.
 */

export type AuthScope = 'owner' | 'admin' | 'member' | 'none';

const ED25519_SPKI_DER_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ED25519_PKCS8_DER_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * Build the deterministic message bytes that a delegation signature covers.
 * Format is intentionally explicit and stable so that on-chain verifiers
 * (a future Anchor program) and host-side verifiers agree byte-for-byte.
 *
 *   "nanoclawd-delegation:v1\n"
 *   "principal=<base58>\n"
 *   "delegate=<base58>\n"
 *   "scope=<owner|admin>\n"
 *   "agent_group_id=<id|*>\n"
 *   "not_before=<unix>\n"
 *   "not_after=<unix>\n"
 */
export function canonicalDelegationMessage(d: Omit<SignedDelegation, 'signature'>): Uint8Array {
  const text =
    'nanoclawd-delegation:v1\n' +
    `principal=${d.principal}\n` +
    `delegate=${d.delegate}\n` +
    `scope=${d.scope}\n` +
    `agent_group_id=${d.agentGroupId ?? '*'}\n` +
    `not_before=${d.notBefore}\n` +
    `not_after=${d.notAfter}\n`;
  return new TextEncoder().encode(text);
}

function ed25519PublicKeyFromBase58(pubkeyB58: SolanaAddress) {
  const raw = base58Decode(pubkeyB58);
  if (raw.length !== 32) {
    throw new Error(`expected 32-byte ed25519 pubkey, got ${raw.length}`);
  }
  const der = Buffer.concat([ED25519_SPKI_DER_PREFIX, raw]);
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

function ed25519PrivateKeyFromSeed(seed32: Uint8Array) {
  if (seed32.length !== 32) {
    throw new Error(`expected 32-byte ed25519 seed, got ${seed32.length}`);
  }
  const der = Buffer.concat([ED25519_PKCS8_DER_PREFIX, Buffer.from(seed32)]);
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

export function verifyDelegationSignature(d: SignedDelegation): boolean {
  let key: ReturnType<typeof createPublicKey>;
  try {
    key = ed25519PublicKeyFromBase58(d.principal);
  } catch {
    return false;
  }
  let sig: Uint8Array;
  try {
    sig = base58Decode(d.signature);
  } catch {
    return false;
  }
  if (sig.length !== 64) return false;
  const msg = canonicalDelegationMessage(d);
  return verify(null, msg, key, sig);
}

/**
 * Sign a delegation with a 64-byte Solana keypair (32-byte seed || 32-byte pubkey).
 * Used by tooling that mints delegations on the operator's behalf.
 */
export function signDelegation(delegation: Omit<SignedDelegation, 'signature'>, keypair: Uint8Array): SignedDelegation {
  if (keypair.length !== 64) {
    throw new Error(`expected 64-byte Solana keypair, got ${keypair.length}`);
  }
  const seed = keypair.slice(0, 32);
  const key = ed25519PrivateKeyFromSeed(seed);
  const msg = canonicalDelegationMessage(delegation);
  const sig = sign(null, msg, key);
  return { ...delegation, signature: base58Encode(sig) as SignatureBase58 };
}

/**
 * Resolve the auth scope a pubkey holds for a given agent group, given a
 * set of candidate delegations (already fetched from DB or chain).
 *
 *   - `owner` beats `admin`
 *   - a group-scoped delegation beats no scope (more specific)
 *   - expired or future delegations are ignored
 *   - unverifiable signatures are ignored
 *
 * Returns 'none' if no delegation matches.
 */
export function resolveAuthScope(
  pubkey: SolanaAddress,
  agentGroupId: string,
  delegations: readonly SignedDelegation[],
  now: number = Math.floor(Date.now() / 1000),
): AuthScope {
  let best: AuthScope = 'none';
  for (const d of delegations) {
    if (d.delegate !== pubkey) continue;
    if (d.notBefore > now || d.notAfter < now) continue;
    if (d.agentGroupId !== null && d.agentGroupId !== agentGroupId) continue;
    if (!verifyDelegationSignature(d)) continue;

    if (d.scope === 'owner') return 'owner';
    if (d.scope === 'admin' && best === 'none') best = 'admin';
  }
  return best;
}

/**
 * Read delegations applicable to an agent group from the local DB cache.
 * Pre on-chain deployment, the DB is the source of truth; once the
 * `delegation-registry` program is live, swap this for an RPC fetch and
 * keep the DB as a write-through cache.
 */
export function listDelegationsForGroup(agentGroupId: string): SignedDelegation[] {
  return getDelegationsForGroup(agentGroupId);
}
