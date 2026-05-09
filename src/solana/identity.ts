import type { SolanaAddress } from './types.js';

/**
 * Translate between NanoClawd's `<channel>:<handle>` user IDs and
 * Solana pubkey identities.
 *
 * Today, users are stored in `data/v2.db` keyed by `<channel>:<handle>`.
 * Once the on-chain identity registry is live, that handle is bound to a
 * Solana pubkey via a signed claim, and authorization decisions consult
 * the chain instead of (or alongside) the DB.
 *
 * Scaffold: identity claims are not yet persisted on-chain. These functions
 * provide the host-side interface so callers can be written against the
 * final API.
 */

export type IdentityClaim = {
  readonly channel: string;
  readonly handle: string;
  readonly pubkey: SolanaAddress;
  readonly proofSignature: string;
};

/**
 * Resolve a `<channel>:<handle>` user ID to a Solana pubkey, if claimed.
 * Returns null if no claim has been registered.
 */
export async function lookupPubkeyForUser(_userId: string): Promise<SolanaAddress | null> {
  return null;
}

/**
 * Reverse lookup: given a Solana pubkey, list all `<channel>:<handle>`
 * identities that have been claimed under it.
 */
export async function lookupUsersForPubkey(_pubkey: SolanaAddress): Promise<string[]> {
  return [];
}

export async function registerIdentityClaim(_claim: IdentityClaim): Promise<void> {
  throw new Error('registerIdentityClaim: not implemented (Solana scaffold)');
}
