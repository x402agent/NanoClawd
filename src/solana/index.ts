export { loadSolanaConfig } from './config.js';
export type { SolanaCluster, SolanaConfig } from './config.js';

export { loadOperatorWallet } from './wallet.js';
export type { OperatorWallet } from './wallet.js';

export {
  lookupPubkeyForUser,
  lookupUsersForPubkey,
  registerIdentityClaim,
} from './identity.js';
export type { IdentityClaim } from './identity.js';

export {
  verifyDelegationSignature,
  resolveAuthScope,
  listDelegationsForGroup,
} from './auth.js';
export type { AuthScope } from './auth.js';

export { deriveEscrowVaultAddress, fetchEscrowState } from './escrow.js';
export type { EscrowState } from './escrow.js';

export { recordPaymentReceipt, fetchSpendInWindow } from './payments.js';
export type { PaymentReceipt } from './payments.js';

export type {
  Lamports,
  SignatureBase58,
  SignedDelegation,
  SolanaAddress,
} from './types.js';
