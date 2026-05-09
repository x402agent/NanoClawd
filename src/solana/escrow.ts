import type { Lamports, SolanaAddress } from './types.js';

/**
 * Per-agent-group escrow vault.
 *
 * Each agent group gets a deterministic PDA-derived vault address. The
 * operator (or an admin via signed delegation) tops it up; the agent
 * spends from it for inference, gateway calls, and tool invocations.
 * Spend caps and approval policies are program-enforced — the host can
 * read the on-chain state but cannot override it.
 *
 * Scaffold: address derivation is a placeholder. Once the escrow program
 * is deployed, the seeds become `["nanoclawd-escrow", agent_group_id]` and
 * the program ID is read from a constant in `src/solana/programs/`.
 */

export type EscrowState = {
  readonly vaultAddress: SolanaAddress;
  readonly balanceLamports: Lamports;
  readonly spendCapLamportsPerHour: Lamports;
  readonly authority: SolanaAddress;
};

export async function deriveEscrowVaultAddress(
  _agentGroupId: string,
): Promise<SolanaAddress> {
  throw new Error('deriveEscrowVaultAddress: not implemented (Solana scaffold)');
}

export async function fetchEscrowState(
  _agentGroupId: string,
): Promise<EscrowState | null> {
  return null;
}
