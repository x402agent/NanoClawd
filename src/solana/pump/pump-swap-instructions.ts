/**
 * PumpSwap AMM instruction builders.
 *
 * Builds raw instruction data for the PumpSwap constant-product AMM.
 *
 * Program: pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA
 */
import type { SolanaAddress } from '../types.js';
import { base58Decode } from '../base58.js';
import type { Instruction, AccountMeta } from '../transaction.js';
import {
  PUMP_SWAP_PROGRAM_ID,
  PUMP_SWAP_GLOBAL_CONFIG,
  PUMP_SWAP_POOL_SEED,
  PUMP_SWAP_LP_MINT_SEED,
  PUMP_SWAP_DISCRIMINATORS,
} from './constants.js';
import { textSeed, pubkeySeed, numberSeed, findProgramAddress } from './pda.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function encodeU64LE(val: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((val >> BigInt(8 * i)) & 0xffn);
  }
  return buf;
}

// ── PDA derivation ──────────────────────────────────────────────────────────

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as SolanaAddress;
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xr25ix9aNJ6hN9d9z' as SolanaAddress;

async function associatedTokenAddress(wallet: SolanaAddress, mint: SolanaAddress): Promise<SolanaAddress> {
  const { address } = await findProgramAddress(
    [base58Decode(wallet), base58Decode(TOKEN_PROGRAM_ID), base58Decode(mint)],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

export async function derivePumpSwapPool(
  index: number,
  creator: SolanaAddress,
  baseMint: SolanaAddress,
  quoteMint: SolanaAddress,
): Promise<SolanaAddress> {
  const { address } = await findProgramAddress(
    [
      textSeed(PUMP_SWAP_POOL_SEED),
      numberSeed(BigInt(index), 8),
      pubkeySeed(creator),
      pubkeySeed(baseMint),
      pubkeySeed(quoteMint),
    ],
    PUMP_SWAP_PROGRAM_ID,
  );
  return address;
}

export async function derivePumpSwapLpMint(poolAddress: SolanaAddress): Promise<SolanaAddress> {
  const { address } = await findProgramAddress(
    [textSeed(PUMP_SWAP_LP_MINT_SEED), pubkeySeed(poolAddress)],
    PUMP_SWAP_PROGRAM_ID,
  );
  return address;
}

// ── Instruction builders ────────────────────────────────────────────────────

/**
 * Create a new PumpSwap pool.
 *
 * Accounts:
 *   0. [w,s] creator (signer)
 *   1. [w] pool PDA
 *   2. [w] lp_mint PDA
 *   3. [w] creator's base token account
 *   4. [w] creator's quote token account
 *   5. [w] pool's base vault (ATA)
 *   6. [w] pool's quote vault (ATA)
 *   7. [r] global config
 *   8. [r] token program
 *   9. [r] associated token program
 *   10. [r] system program
 *   11. [r] rent sysvar
 *   12. [r] base mint
 *   13. [r] quote mint
 */
export async function buildCreatePoolInstruction(
  creator: SolanaAddress,
  index: number,
  baseMint: SolanaAddress,
  quoteMint: SolanaAddress,
  baseIn: bigint,
  quoteIn: bigint,
): Promise<Instruction> {
  const poolAddr = await derivePumpSwapPool(index, creator, baseMint, quoteMint);
  const lpMintAddr = await derivePumpSwapLpMint(poolAddr);
  const creatorBaseAta = await associatedTokenAddress(creator, baseMint);
  const creatorQuoteAta = await associatedTokenAddress(creator, quoteMint);
  const poolBaseVault = await associatedTokenAddress(poolAddr, baseMint);
  const poolQuoteVault = await associatedTokenAddress(poolAddr, quoteMint);

  const data = new Uint8Array([
    ...PUMP_SWAP_DISCRIMINATORS.createPool,
    ...numberSeed(BigInt(index), 8),
    ...base58Decode(creator),
    ...base58Decode(baseMint),
    ...base58Decode(quoteMint),
    ...encodeU64LE(baseIn),
    ...encodeU64LE(quoteIn),
  ]);

  return {
    programId: PUMP_SWAP_PROGRAM_ID,
    accounts: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: poolAddr, isSigner: false, isWritable: true },
      { pubkey: lpMintAddr, isSigner: false, isWritable: true },
      { pubkey: creatorBaseAta, isSigner: false, isWritable: true },
      { pubkey: creatorQuoteAta, isSigner: false, isWritable: true },
      { pubkey: poolBaseVault, isSigner: false, isWritable: true },
      { pubkey: poolQuoteVault, isSigner: false, isWritable: true },
      { pubkey: PUMP_SWAP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
      { pubkey: 'SysvarRent111111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
      { pubkey: baseMint, isSigner: false, isWritable: false },
      { pubkey: quoteMint, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Deposit liquidity into a PumpSwap pool.
 *
 * Accounts:
 *   0. [w,s] user (signer)
 *   1. [w] pool PDA
 *   2. [w] lp_mint PDA
 *   3. [w] user's lp token account
 *   4. [w] user's base token account
 *   5. [w] user's quote token account
 *   6. [w] pool's base vault
 *   7. [w] pool's quote vault
 *   8. [r] global config
 *   9. [r] token program
 *   10. [r] system program
 */
export async function buildDepositInstruction(
  user: SolanaAddress,
  poolAddress: SolanaAddress,
  lpMintAddress: SolanaAddress,
  baseMint: SolanaAddress,
  quoteMint: SolanaAddress,
  lpTokenOut: bigint,
  maxBaseIn: bigint,
  maxQuoteIn: bigint,
): Promise<Instruction> {
  const userLpAta = await associatedTokenAddress(user, lpMintAddress);
  const userBaseAta = await associatedTokenAddress(user, baseMint);
  const userQuoteAta = await associatedTokenAddress(user, quoteMint);
  const poolBaseVault = await associatedTokenAddress(poolAddress, baseMint);
  const poolQuoteVault = await associatedTokenAddress(poolAddress, quoteMint);

  const data = new Uint8Array([
    ...PUMP_SWAP_DISCRIMINATORS.deposit,
    ...encodeU64LE(lpTokenOut),
    ...encodeU64LE(maxBaseIn),
    ...encodeU64LE(maxQuoteIn),
  ]);

  return {
    programId: PUMP_SWAP_PROGRAM_ID,
    accounts: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: poolAddress, isSigner: false, isWritable: true },
      { pubkey: lpMintAddress, isSigner: false, isWritable: true },
      { pubkey: userLpAta, isSigner: false, isWritable: true },
      { pubkey: userBaseAta, isSigner: false, isWritable: true },
      { pubkey: userQuoteAta, isSigner: false, isWritable: true },
      { pubkey: poolBaseVault, isSigner: false, isWritable: true },
      { pubkey: poolQuoteVault, isSigner: false, isWritable: true },
      { pubkey: PUMP_SWAP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Withdraw liquidity from a PumpSwap pool.
 *
 * Accounts:
 *   0. [w,s] user (signer)
 *   1. [w] pool PDA
 *   2. [w] lp_mint PDA
 *   3. [w] user's lp token account (to burn from)
 *   4. [w] user's base token account
 *   5. [w] user's quote token account
 *   6. [w] pool's base vault
 *   7. [w] pool's quote vault
 *   8. [r] global config
 *   9. [r] token program
 *   10. [r] system program
 */
export async function buildWithdrawInstruction(
  user: SolanaAddress,
  poolAddress: SolanaAddress,
  lpMintAddress: SolanaAddress,
  baseMint: SolanaAddress,
  quoteMint: SolanaAddress,
  lpTokenIn: bigint,
  minBaseOut: bigint,
  minQuoteOut: bigint,
): Promise<Instruction> {
  const userLpAta = await associatedTokenAddress(user, lpMintAddress);
  const userBaseAta = await associatedTokenAddress(user, baseMint);
  const userQuoteAta = await associatedTokenAddress(user, quoteMint);
  const poolBaseVault = await associatedTokenAddress(poolAddress, baseMint);
  const poolQuoteVault = await associatedTokenAddress(poolAddress, quoteMint);

  const data = new Uint8Array([
    ...PUMP_SWAP_DISCRIMINATORS.withdraw,
    ...encodeU64LE(lpTokenIn),
    ...encodeU64LE(minBaseOut),
    ...encodeU64LE(minQuoteOut),
  ]);

  return {
    programId: PUMP_SWAP_PROGRAM_ID,
    accounts: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: poolAddress, isSigner: false, isWritable: true },
      { pubkey: lpMintAddress, isSigner: false, isWritable: true },
      { pubkey: userLpAta, isSigner: false, isWritable: true },
      { pubkey: userBaseAta, isSigner: false, isWritable: true },
      { pubkey: userQuoteAta, isSigner: false, isWritable: true },
      { pubkey: poolBaseVault, isSigner: false, isWritable: true },
      { pubkey: poolQuoteVault, isSigner: false, isWritable: true },
      { pubkey: PUMP_SWAP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Buy base tokens from a PumpSwap pool (quote → base).
 *
 * Accounts (quote → base direction, default):
 *   0. [w,s] user (signer)
 *   1. [w] pool PDA
 *   2. [w] user's base token account (to receive)
 *   3. [w] user's quote token account (to spend)
 *   4. [w] pool's base vault
 *   5. [w] pool's quote vault
 *   6. [w] lp_mint PDA (takes protocol fees)
 *   7. [r] global config
 *   8. [r] token program
 *   9. [r] system program
 */
export async function buildSwapBuyInstruction(
  user: SolanaAddress,
  poolAddress: SolanaAddress,
  lpMintAddress: SolanaAddress,
  baseMint: SolanaAddress,
  quoteMint: SolanaAddress,
  baseOut: bigint,
  maxQuoteIn: bigint,
): Promise<Instruction> {
  const userBaseAta = await associatedTokenAddress(user, baseMint);
  const userQuoteAta = await associatedTokenAddress(user, quoteMint);
  const poolBaseVault = await associatedTokenAddress(poolAddress, baseMint);
  const poolQuoteVault = await associatedTokenAddress(poolAddress, quoteMint);

  const data = new Uint8Array([...PUMP_SWAP_DISCRIMINATORS.buy, ...encodeU64LE(baseOut), ...encodeU64LE(maxQuoteIn)]);

  return {
    programId: PUMP_SWAP_PROGRAM_ID,
    accounts: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: poolAddress, isSigner: false, isWritable: true },
      { pubkey: userBaseAta, isSigner: false, isWritable: true },
      { pubkey: userQuoteAta, isSigner: false, isWritable: true },
      { pubkey: poolBaseVault, isSigner: false, isWritable: true },
      { pubkey: poolQuoteVault, isSigner: false, isWritable: true },
      { pubkey: lpMintAddress, isSigner: false, isWritable: true },
      { pubkey: PUMP_SWAP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Sell base tokens to a PumpSwap pool (base → quote).
 *
 * Accounts (base → quote direction):
 *   0. [w,s] user (signer)
 *   1. [w] pool PDA
 *   2. [w] user's base token account (to spend)
 *   3. [w] user's quote token account (to receive)
 *   4. [w] pool's base vault
 *   5. [w] pool's quote vault
 *   6. [w] lp_mint PDA (takes protocol fees)
 *   7. [r] global config
 *   8. [r] token program
 *   9. [r] system program
 */
export async function buildSwapSellInstruction(
  user: SolanaAddress,
  poolAddress: SolanaAddress,
  lpMintAddress: SolanaAddress,
  baseMint: SolanaAddress,
  quoteMint: SolanaAddress,
  baseIn: bigint,
  minQuoteOut: bigint,
): Promise<Instruction> {
  const userBaseAta = await associatedTokenAddress(user, baseMint);
  const userQuoteAta = await associatedTokenAddress(user, quoteMint);
  const poolBaseVault = await associatedTokenAddress(poolAddress, baseMint);
  const poolQuoteVault = await associatedTokenAddress(poolAddress, quoteMint);

  const data = new Uint8Array([...PUMP_SWAP_DISCRIMINATORS.sell, ...encodeU64LE(baseIn), ...encodeU64LE(minQuoteOut)]);

  return {
    programId: PUMP_SWAP_PROGRAM_ID,
    accounts: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: poolAddress, isSigner: false, isWritable: true },
      { pubkey: userBaseAta, isSigner: false, isWritable: true },
      { pubkey: userQuoteAta, isSigner: false, isWritable: true },
      { pubkey: poolBaseVault, isSigner: false, isWritable: true },
      { pubkey: poolQuoteVault, isSigner: false, isWritable: true },
      { pubkey: lpMintAddress, isSigner: false, isWritable: true },
      { pubkey: PUMP_SWAP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
    ],
    data,
  };
}
