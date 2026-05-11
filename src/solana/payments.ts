import type { Lamports, SignatureBase58 } from './types.js';

/**
 * Pay-per-call accounting for credentialed actions.
 *
 * When the OneCLI gateway proxies a paid API request (Anthropic, OpenAI,
 * Vercel, etc.), the receipt is recorded on Solana so spend is auditable
 * end-to-end. For non-trivial spend, the receipt is debited from the
 * agent group's escrow vault in the same instruction; for free or
 * already-prepaid calls it's a no-op.
 *
 * Scaffold: nothing is submitted on-chain yet. Wire the host-side hook
 * in `src/onecli-approvals.ts` once the escrow program is deployed.
 */

export type PaymentReceipt = {
  readonly agentGroupId: string;
  readonly endpoint: string;
  readonly costLamports: Lamports;
  readonly nonce: string;
  readonly txSignature: SignatureBase58 | null;
};

export async function recordPaymentReceipt(receipt: Omit<PaymentReceipt, 'txSignature'>): Promise<PaymentReceipt> {
  return { ...receipt, txSignature: null };
}

export async function fetchSpendInWindow(_agentGroupId: string, _windowSeconds: number): Promise<Lamports> {
  return 0n as Lamports;
}
