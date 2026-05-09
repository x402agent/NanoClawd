import type { SignedDelegation, SolanaAddress } from './types.js';

/**
 * Authorization layer.
 *
 * Today, owner/admin grants live in `user_roles` rows in the central DB.
 * The Solana-native model replaces this with **signed delegations**: a
 * principal (a Solana pubkey) signs a message authorizing a delegate to
 * act with `owner` or `admin` scope, optionally bound to one agent group
 * and a validity window.
 *
 * Scaffold: signature verification and delegation persistence are stubs.
 * The function signatures match the eventual API so call sites in
 * `src/modules/permissions/access.ts` can be migrated incrementally.
 */

export type AuthScope = 'owner' | 'admin' | 'member' | 'none';

export async function verifyDelegationSignature(
  _delegation: SignedDelegation,
): Promise<boolean> {
  throw new Error('verifyDelegationSignature: not implemented (Solana scaffold)');
}

export async function resolveAuthScope(
  _pubkey: SolanaAddress,
  _agentGroupId: string,
): Promise<AuthScope> {
  return 'none';
}

export async function listDelegationsForGroup(
  _agentGroupId: string,
): Promise<SignedDelegation[]> {
  return [];
}
