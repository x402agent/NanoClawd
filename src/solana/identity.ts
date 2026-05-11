/**
 * Identity claims — resolve channel users to Solana pubkeys and vice versa.
 *
 * Claims are stored in an append-only table in the central DB.
 * Each claim is a signed message proving the user controls the pubkey.
 */
import type { SolanaAddress } from './types.js';
import { log } from '../log.js';
import { base58Decode, base58Encode } from './base58.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type IdentityClaim = {
  readonly channel: string;
  readonly handle: string;
  readonly pubkey: SolanaAddress;
  readonly proofSignature: string;
};

type DbClaimRow = {
  id: number;
  channel: string;
  handle: string;
  pubkey: string;
  proof_signature: string;
  created_at: string;
};

// ── In-memory cache (singleton, populated from DB on first access) ──────────

let _claimsCache: IdentityClaim[] | null = null;
let _claimsByUser: Map<string, SolanaAddress> | null = null;
let _claimsByPubkey: Map<SolanaAddress, string[]> | null = null;

function rebuildCache(claims: IdentityClaim[]): void {
  _claimsCache = claims;
  _claimsByUser = new Map();
  _claimsByPubkey = new Map();

  for (const c of claims) {
    const key = `${c.channel}:${c.handle}`;
    _claimsByUser.set(key, c.pubkey);

    const existing = _claimsByPubkey.get(c.pubkey) ?? [];
    existing.push(key);
    _claimsByPubkey.set(c.pubkey, existing);
  }
}

// ── DB helpers ──────────────────────────────────────────────────────────────

function getDb(): import('better-sqlite3').Database | null {
  try {
    // Lazy import — the main DB module handles connection lifecycle
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getGlobalDb } = require('../db/connection.js');
    return getGlobalDb();
  } catch {
    return null;
  }
}

function loadAllClaims(): IdentityClaim[] {
  const db = getDb();
  if (!db) {
    log.warn('Identity: DB not available, identity claims inactive');
    return [];
  }

  try {
    const rows = db.prepare('SELECT * FROM identity_claims ORDER BY id ASC').all() as DbClaimRow[];
    return rows.map((r) => ({
      channel: r.channel,
      handle: r.handle,
      pubkey: r.pubkey as SolanaAddress,
      proofSignature: r.proof_signature,
    }));
  } catch {
    // Table may not exist yet — that's okay
    return [];
  }
}

function ensureTable(): void {
  const db = getDb();
  if (!db) return;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS identity_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL,
        handle TEXT NOT NULL,
        pubkey TEXT NOT NULL,
        proof_signature TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(channel, handle)
      )
    `);
  } catch (err) {
    log.error('Identity: failed to create identity_claims table', { err });
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve a `<channel>:<handle>` user ID to a Solana pubkey, if claimed.
 */
export async function lookupPubkeyForUser(userId: string): Promise<SolanaAddress | null> {
  if (!_claimsByUser) {
    rebuildCache(loadAllClaims());
  }
  return _claimsByUser?.get(userId) ?? null;
}

/**
 * Reverse lookup: given a Solana pubkey, list all `<channel>:<handle>`
 * identities that have been claimed under it.
 */
export async function lookupUsersForPubkey(pubkey: SolanaAddress): Promise<string[]> {
  if (!_claimsByPubkey) {
    rebuildCache(loadAllClaims());
  }
  return _claimsByPubkey?.get(pubkey) ?? [];
}

/**
 * Register a new identity claim. The caller must have verified the proof
 * (a signature of the channel+handle by the claimed pubkey) before calling.
 *
 * This is idempotent per channel+handle — last write wins.
 */
export async function registerIdentityClaim(claim: IdentityClaim): Promise<void> {
  const userId = `${claim.channel}:${claim.handle}`;

  // Verify proof signature
  const proofValid = await verifyProof(claim);
  if (!proofValid) {
    throw new Error(`Invalid proof signature for identity claim: ${userId} -> ${claim.pubkey}`);
  }

  ensureTable();
  const db = getDb();
  if (!db) throw new Error('DB not available');

  try {
    db.prepare(
      `
      INSERT OR REPLACE INTO identity_claims (channel, handle, pubkey, proof_signature)
      VALUES (?, ?, ?, ?)
    `,
    ).run(claim.channel, claim.handle, claim.pubkey, claim.proofSignature);

    // Invalidate cache
    _claimsByUser = null;
    _claimsByPubkey = null;
    _claimsCache = null;

    log.info(`Identity claim registered: ${userId} -> ${claim.pubkey}`);
  } catch (err) {
    log.error(`Identity: failed to register claim for ${userId}`, { err });
    throw new Error(`Failed to register identity claim: ${err}`);
  }
}

/**
 * Verify a proof signature: the pubkey signed the message
 * `"nanoclawd-identity-claim:v1\n<channel>\n<handle>"`.
 */
async function verifyProof(claim: IdentityClaim): Promise<boolean> {
  try {
    const { verify } = await import('crypto');
    const { createPublicKey } = await import('crypto');

    const message = `nanoclawd-identity-claim:v1\n${claim.channel}\n${claim.handle}`;
    const msgBytes = new TextEncoder().encode(message);

    // Decode signature
    const sigBytes = base58Decode(claim.proofSignature);
    if (sigBytes.length !== 64) return false;

    // Build SPKI DER from pubkey
    const rawPubkey = base58Decode(claim.pubkey);
    if (rawPubkey.length !== 32) return false;

    const ED25519_SPKI_DER_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_DER_PREFIX, Buffer.from(rawPubkey)]),
      format: 'der',
      type: 'spki',
    });

    return verify(null, msgBytes, key, Buffer.from(sigBytes));
  } catch {
    return false;
  }
}

/**
 * Create a proof signature for an identity claim using a 64-byte keypair.
 * Useful for tooling that registers claims on the user's behalf.
 */
export async function signIdentityClaim(channel: string, handle: string, keypair: Uint8Array): Promise<string> {
  const { sign } = await import('crypto');

  const message = `nanoclawd-identity-claim:v1\n${channel}\n${handle}`;
  const msgBytes = new TextEncoder().encode(message);

  const seed = keypair.slice(0, 32);
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const { createPrivateKey } = await import('crypto');
  const privateKey = createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.from(seed)]),
    format: 'der',
    type: 'pkcs8',
  });

  const sig = sign(null, Buffer.from(msgBytes), privateKey);
  return base58Encode(new Uint8Array(sig));
}

/**
 * Invalidate the cache (called when claims may have changed externally).
 */
export function invalidateIdentityCache(): void {
  _claimsByUser = null;
  _claimsByPubkey = null;
  _claimsCache = null;
}
