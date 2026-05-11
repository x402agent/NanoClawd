/**
 * Pump.fun instruction builders.
 *
 * Builds the raw instruction data for the Pump bonding curve program.
 * Each instruction is a discriminator (8 bytes) + borsh-encoded arguments.
 *
 * Program: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
 */
import type { SolanaAddress } from '../types.js';
import { base58Decode } from '../base58.js';
import type { Instruction, AccountMeta } from '../transaction.js';
import {
  PUMP_PROGRAM_ID,
  PUMP_DISCRIMINATORS,
  PUMP_GLOBAL_CONFIG,
  PUMP_GLOBAL_SEED,
  PUMP_BONDING_CURVE_SEED,
  PUMP_FEE_BPS,
} from './constants.js';
import { textSeed, findProgramAddress } from './pda.js';

// ── Helper: encode u64 as 8-byte little-endian ──────────────────────────────

function encodeU64LE(val: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((val >> BigInt(8 * i)) & 0xffn);
  }
  return buf;
}

// ── PDA derivation helpers ──────────────────────────────────────────────────

async function bondingCurvePda(mint: SolanaAddress): Promise<SolanaAddress> {
  const { address } = await findProgramAddress(
    [textSeed(PUMP_BONDING_CURVE_SEED), base58Decode(mint)],
    PUMP_PROGRAM_ID,
  );
  return address;
}

async function bondingCurveLpMintPda(mint: SolanaAddress): Promise<SolanaAddress> {
  // Some Pump versions derive an LP mint PDA: seeds=["lp_mint", mint]
  const { address } = await findProgramAddress([textSeed('lp_mint'), base58Decode(mint)], PUMP_PROGRAM_ID);
  return address;
}

// ── Associated Token Account (ATA) derivation ──────────────────────────────
// Standard SPL ATA: seeds=[wallet, TOKEN_PROGRAM_ID, mint]
// TOKEN_PROGRAM_ID = TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as SolanaAddress;
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xr25ix9aNJ6hN9d9z' as SolanaAddress;

async function associatedTokenAddress(wallet: SolanaAddress, mint: SolanaAddress): Promise<SolanaAddress> {
  const { address } = await findProgramAddress(
    [base58Decode(wallet), base58Decode(TOKEN_PROGRAM_ID), base58Decode(mint)],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

// ── Instruction builders ────────────────────────────────────────────────────

/**
 * Create a new coin on Pump.fun's bonding curve.
 *
 * Accounts:
 *   0. [w] user (signer)
 *   1. [w] mint (new token mint)
 *   2. [w] bonding curve PDA
 *   3. [w] associated user token account
 *   4. [r] global config
 *   5. [r] token program
 *   6. [r] associated token program
 *   7. [r] system program
 *   8. [r] rent sysvar
 */
export async function buildCreateInstruction(
  user: SolanaAddress,
  mint: SolanaAddress,
  name: string,
  symbol: string,
  uri: string,
  creator: SolanaAddress,
): Promise<Instruction> {
  const curveAddr = await bondingCurvePda(mint);
  const userAta = await associatedTokenAddress(user, mint);

  // Encode arguments: name, symbol, uri (each as 4-byte len prefix + UTF-8)
  const nameBytes = new TextEncoder().encode(name);
  const symbolBytes = new TextEncoder().encode(symbol);
  const uriBytes = new TextEncoder().encode(uri);

  const args = new Uint8Array(
    PUMP_DISCRIMINATORS.create.length + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + uriBytes.length + 32, // creator pubkey
  );

  let offset = 0;
  args.set(PUMP_DISCRIMINATORS.create, offset);
  offset += PUMP_DISCRIMINATORS.create.length;

  // [4-byte LE length][bytes]
  args[offset++] = nameBytes.length & 0xff;
  args[offset++] = (nameBytes.length >> 8) & 0xff;
  args[offset++] = (nameBytes.length >> 16) & 0xff;
  args[offset] = (nameBytes.length >> 24) & 0xff;
  offset = 1; // reset for simpler approach
  // Actually let's do it cleanly
  const allArgs = new Uint8Array([
    ...PUMP_DISCRIMINATORS.create,
    ...encodeStringWithLength(name),
    ...encodeStringWithLength(symbol),
    ...encodeStringWithLength(uri),
    ...base58Decode(creator),
  ]);

  return {
    programId: PUMP_PROGRAM_ID,
    accounts: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: true, isWritable: true },
      { pubkey: curveAddr, isSigner: false, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: PUMP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
      { pubkey: 'SysvarRent111111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
    ],
    data: allArgs,
  };
}

function encodeStringWithLength(s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  const lenPrefix = new Uint8Array(4);
  lenPrefix[0] = bytes.length & 0xff;
  lenPrefix[1] = (bytes.length >> 8) & 0xff;
  lenPrefix[2] = (bytes.length >> 16) & 0xff;
  lenPrefix[3] = (bytes.length >> 24) & 0xff;
  const out = new Uint8Array(4 + bytes.length);
  out.set(lenPrefix, 0);
  out.set(bytes, 4);
  return out;
}

/**
 * Buy tokens on the Pump bonding curve.
 *
 * Accounts:
 *   0. [w] user (signer, payer)
 *   1. [w] associated user token account
 *   2. [w] bonding curve PDA
 *   3. [w] curve's associated token account (for the mint)
 *   4. [r] global config
 *   5. [r] token program
 *   6. [r] associated token program
 *   7. [r] system program
 *   8. [r] rent sysvar
 *   9. [r] event authority (for logging)
 */
export async function buildBuyInstruction(
  user: SolanaAddress,
  mint: SolanaAddress,
  amount: bigint, // token amount to buy (not SOL)
  maxSolCost: bigint, // max SOL in lamports to spend
  eventAuthority: SolanaAddress,
): Promise<Instruction> {
  const curveAddr = await bondingCurvePda(mint);
  const userAta = await associatedTokenAddress(user, mint);
  const curveAta = await associatedTokenAddress(curveAddr, mint);

  const data = new Uint8Array([...PUMP_DISCRIMINATORS.buy, ...encodeU64LE(amount), ...encodeU64LE(maxSolCost)]);

  return {
    programId: PUMP_PROGRAM_ID,
    accounts: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: curveAddr, isSigner: false, isWritable: true },
      { pubkey: curveAta, isSigner: false, isWritable: true },
      { pubkey: PUMP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
      { pubkey: 'SysvarRent111111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Sell tokens on the Pump bonding curve.
 *
 * Accounts:
 *   0. [w] user (signer)
 *   1. [w] associated user token account
 *   2. [w] bonding curve PDA
 *   3. [w] curve's associated token account (for the mint)
 *   4. [r] global config
 *   5. [r] token program
 *   6. [r] associated token program
 *   7. [r] system program
 *   8. [r] rent sysvar
 *   9. [r] event authority
 */
export async function buildSellInstruction(
  user: SolanaAddress,
  mint: SolanaAddress,
  amount: bigint, // token amount to sell
  minSolOutput: bigint, // minimum SOL in lamports to receive
  eventAuthority: SolanaAddress,
): Promise<Instruction> {
  const curveAddr = await bondingCurvePda(mint);
  const userAta = await associatedTokenAddress(user, mint);
  const curveAta = await associatedTokenAddress(curveAddr, mint);

  const data = new Uint8Array([...PUMP_DISCRIMINATORS.sell, ...encodeU64LE(amount), ...encodeU64LE(minSolOutput)]);

  return {
    programId: PUMP_PROGRAM_ID,
    accounts: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: curveAddr, isSigner: false, isWritable: true },
      { pubkey: curveAta, isSigner: false, isWritable: true },
      { pubkey: PUMP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
      { pubkey: 'SysvarRent111111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Migrate a completed bonding curve to PumpSwap AMM.
 *
 * Accounts:
 *   0. [w] user (signer)
 *   1. [w] bonding curve PDA
 *   2. [w] curve's associated token account (for the mint)
 *   3. [r] global config
 *   4. [r] token program
 *   5. [r] associated token program
 *   6. [r] system program
 *   7. [r] rent sysvar
 *   8. [r] event authority
 *   9. [w] mint
 *   10. [w] amm pool (PumpSwap pool PDA)
 *   11. [w] amm pool lp mint
 */
export async function buildMigrateInstruction(
  user: SolanaAddress,
  mint: SolanaAddress,
  eventAuthority: SolanaAddress,
  pumpSwapPool?: SolanaAddress,
  pumpSwapLpMint?: SolanaAddress,
): Promise<Instruction> {
  const curveAddr = await bondingCurvePda(mint);
  const curveAta = await associatedTokenAddress(curveAddr, mint);

  const accounts: AccountMeta[] = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: curveAddr, isSigner: false, isWritable: true },
    { pubkey: curveAta, isSigner: false, isWritable: true },
    { pubkey: PUMP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: '11111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
    { pubkey: 'SysvarRent111111111111111111111111111111111' as SolanaAddress, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: true },
  ];

  if (pumpSwapPool) {
    accounts.push({ pubkey: pumpSwapPool, isSigner: false, isWritable: true });
  }
  if (pumpSwapLpMint) {
    accounts.push({ pubkey: pumpSwapLpMint, isSigner: false, isWritable: true });
  }

  const data = new Uint8Array([...PUMP_DISCRIMINATORS.migrate, ...base58Decode(mint)]);

  return {
    programId: PUMP_PROGRAM_ID,
    accounts,
    data,
  };
}

/**
 * Calculate buy price for a given token amount on the bonding curve.
 *
 * Uses constant product formula with virtual reserves:
 *   k = virtualSolReserves * virtualTokenReserves
 *   cost = (amount * virtualSolReserves) / (virtualTokenReserves - amount)
 *   cost_with_fee = cost * (1 + fee_bps/10000)
 *
 * Virtual SOL reserves: 30 SOL = 30,000,000,000 lamports
 * Virtual token reserves: 1,073,000,000,000,000
 */
export function calculateBuyPrice(
  tokenAmount: bigint,
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
): { costLamports: bigint; feeLamports: bigint } {
  // cost = (tokenAmount * virtualSolReserves) / virtualTokenReserves
  // with invariant adjustment for sold tokens
  const costNumerator = tokenAmount * virtualSolReserves;
  const costDenominator = virtualTokenReserves - tokenAmount;

  if (costDenominator <= 0n) {
    return { costLamports: 0n, feeLamports: 0n };
  }

  const cost = costNumerator / costDenominator;
  const fee = (cost * BigInt(PUMP_FEE_BPS)) / 10000n;

  return { costLamports: cost + fee, feeLamports: fee };
}

/**
 * Calculate sell proceeds for a given token amount.
 *   proceeds = (tokenAmount * virtualTokenReserves) / (virtualSolReserves + tokenAmount_adjusted)
 */
export function calculateSellProceeds(
  tokenAmount: bigint,
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
): { proceedsLamports: bigint; feeLamports: bigint } {
  const adjustedToken = tokenAmount;
  const proceeds = (adjustedToken * virtualSolReserves) / (virtualTokenReserves + adjustedToken);

  const fee = (proceeds * BigInt(PUMP_FEE_BPS)) / 10000n;
  const proceedsAfterFee = proceeds - fee;

  return { proceedsLamports: proceedsAfterFee, feeLamports: fee };
}
