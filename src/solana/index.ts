export { loadSolanaConfig } from './config.js';
export type { SolanaCluster, SolanaConfig } from './config.js';

export { base58Decode, base58Encode } from './base58.js';

export { decodeKeypairFile, loadOperatorWallet, pubkeyFromKeypair } from './wallet.js';
export type { OperatorWallet } from './wallet.js';

export { generateKeyPair, pubkeyFromKeypair as pubkeyFromKeypairGen } from './keygen.js';

export { lookupPubkeyForUser, lookupUsersForPubkey, registerIdentityClaim } from './identity.js';
export type { IdentityClaim } from './identity.js';

export {
  canonicalDelegationMessage,
  listDelegationsForGroup,
  resolveAuthScope,
  signDelegation,
  verifyDelegationSignature,
} from './auth.js';
export type { AuthScope } from './auth.js';

export { deriveEscrowVaultAddress, fetchEscrowState } from './escrow.js';
export type { EscrowState } from './escrow.js';

export { recordPaymentReceipt, fetchSpendInWindow } from './payments.js';
export type { PaymentReceipt } from './payments.js';

export type { Lamports, SignatureBase58, SignedDelegation, SolanaAddress } from './types.js';

// ── RPC & Transaction ────────────────────────────────────────────────────────
export {
  getLatestBlockhash,
  getBalance,
  getMultipleAccounts,
  getAccountInfo,
  simulateTransaction,
  sendTransaction,
  confirmTransaction,
  getTokenAccountsByOwner,
  getProgramAccounts,
} from './rpc.js';

export { signAndSendTransaction, simulateTransactionBuilder } from './transaction.js';
export type { AccountMeta, Instruction, Transaction } from './transaction.js';

// ── Pump Trading SDK ─────────────────────────────────────────────────────────
export { PUMP_PROGRAM_ID, PUMP_SWAP_PROGRAM_ID } from './pump/constants.js';

export {
  buildCreateInstruction,
  buildBuyInstruction,
  buildSellInstruction,
  buildMigrateInstruction,
  calculateBuyPrice,
  calculateSellProceeds,
} from './pump/instructions.js';

export {
  buildCreatePoolInstruction,
  buildDepositInstruction,
  buildWithdrawInstruction,
  buildSwapBuyInstruction,
  buildSwapSellInstruction,
  derivePumpSwapPool,
  derivePumpSwapLpMint,
} from './pump/pump-swap-instructions.js';

export {
  createToken,
  buyTokens,
  sellTokens,
  migrateToAmm,
  estimateBuyCost,
  estimateSellProceeds,
  checkSolBalance,
  getOperatorBalance,
} from './pump/sdk.js';

export { findProgramAddress, createProgramAddress } from './pump/pda.js';
