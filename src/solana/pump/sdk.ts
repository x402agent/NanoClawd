/**
 * Pump.fun SDK — high-level trading operations.
 *
 * Wraps the instruction builders + transaction builder + wallet for
 * easy one-call trade execution on Pump.fun bonding curves.
 */
import type { SolanaAddress, SignatureBase58 } from '../types.js';
import { loadOperatorWallet } from '../wallet.js';
import { getBalance } from '../rpc.js';
import { signAndSendTransaction } from '../transaction.js';
import { PUMP_INITIAL_VIRTUAL_SOL_RESERVES, PUMP_INITIAL_VIRTUAL_TOKEN_RESERVES } from './constants.js';
import {
  buildCreateInstruction,
  buildBuyInstruction,
  buildSellInstruction,
  buildMigrateInstruction,
  calculateBuyPrice,
  calculateSellProceeds,
} from './instructions.js';

/** Pump.fun event authority (used for buy/sell/migrate CPI events). */
const PUMP_EVENT_AUTHORITY = 'Ce6TQdHC3W4RZ3iBbmdCe8LCmJSqA5bumFbVwFirEWyC' as SolanaAddress;

/**
 * Create a new token on Pump.fun's bonding curve.
 * Uses the operator wallet as signer + creator.
 */
export async function createToken(
  name: string,
  symbol: string,
  uri: string,
): Promise<{ mint: SolanaAddress; signature: SignatureBase58 }> {
  const wallet = loadOperatorWallet();
  if (!wallet) throw new Error('Operator wallet not configured');

  const { generateKeyPair } = await import('../keygen.js');
  const mintKeypair = generateKeyPair();
  const { pubkeyFromKeypair } = await import('../wallet.js');
  const mintPubkey = pubkeyFromKeypair(mintKeypair);

  const ix = await buildCreateInstruction(wallet.pubkey, mintPubkey, name, symbol, uri, wallet.pubkey);

  const signature = await signAndSendTransaction({
    signers: [wallet.secretKey, mintKeypair],
    instructions: [ix],
    feePayer: wallet.pubkey,
  });

  return { mint: mintPubkey, signature };
}

/**
 * Buy tokens on a Pump.fun bonding curve.
 */
export async function buyTokens(mint: SolanaAddress, amount: bigint, maxSolCost: bigint): Promise<SignatureBase58> {
  const wallet = loadOperatorWallet();
  if (!wallet) throw new Error('Operator wallet not configured');

  const ix = await buildBuyInstruction(wallet.pubkey, mint, amount, maxSolCost, PUMP_EVENT_AUTHORITY);
  return signAndSendTransaction({
    signers: [wallet.secretKey],
    instructions: [ix],
    feePayer: wallet.pubkey,
  });
}

/**
 * Sell tokens on a Pump.fun bonding curve.
 */
export async function sellTokens(mint: SolanaAddress, amount: bigint, minSolOutput: bigint): Promise<SignatureBase58> {
  const wallet = loadOperatorWallet();
  if (!wallet) throw new Error('Operator wallet not configured');

  const ix = await buildSellInstruction(wallet.pubkey, mint, amount, minSolOutput, PUMP_EVENT_AUTHORITY);
  return signAndSendTransaction({
    signers: [wallet.secretKey],
    instructions: [ix],
    feePayer: wallet.pubkey,
  });
}

/**
 * Migrate a completed bonding curve to PumpSwap AMM.
 */
export async function migrateToAmm(mint: SolanaAddress): Promise<SignatureBase58> {
  const wallet = loadOperatorWallet();
  if (!wallet) throw new Error('Operator wallet not configured');

  const ix = await buildMigrateInstruction(wallet.pubkey, mint, PUMP_EVENT_AUTHORITY);
  return signAndSendTransaction({
    signers: [wallet.secretKey],
    instructions: [ix],
    feePayer: wallet.pubkey,
  });
}

/**
 * Estimate the cost to buy a given amount of tokens.
 */
export function estimateBuyCost(
  tokenAmount: bigint,
  virtualSolReserves: bigint = PUMP_INITIAL_VIRTUAL_SOL_RESERVES,
  virtualTokenReserves: bigint = PUMP_INITIAL_VIRTUAL_TOKEN_RESERVES,
): { costLamports: bigint; feeLamports: bigint } {
  return calculateBuyPrice(tokenAmount, virtualSolReserves, virtualTokenReserves);
}

/**
 * Estimate the proceeds from selling a given amount of tokens.
 */
export function estimateSellProceeds(
  tokenAmount: bigint,
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
): { proceedsLamports: bigint; feeLamports: bigint } {
  return calculateSellProceeds(tokenAmount, virtualSolReserves, virtualTokenReserves);
}

/**
 * Check if the operator wallet has sufficient SOL balance.
 */
export async function checkSolBalance(minLamports: bigint): Promise<boolean> {
  const wallet = loadOperatorWallet();
  if (!wallet) return false;
  const balance = await getBalance(wallet.pubkey);
  return balance >= minLamports;
}

/**
 * Get the operator wallet's SOL balance.
 */
export async function getOperatorBalance(): Promise<bigint> {
  const wallet = loadOperatorWallet();
  if (!wallet) return 0n;
  return getBalance(wallet.pubkey);
}
