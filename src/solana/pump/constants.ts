/**
 * Pump Program & PumpSwap AMM constants.
 *
 * All addresses are hardcoded for the deployed programs on Solana mainnet.
 * Devnet uses the same program IDs.
 */
import type { SolanaAddress } from '../types.js';

// ── Pump Program ────────────────────────────────────────────────────────────
/** Pump.fun bonding curve program (same on mainnet + devnet). */
export const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' as SolanaAddress;

/** Global config PDA seed. */
export const PUMP_GLOBAL_SEED = 'global';

/** Bonding curve PDA seed prefix. */
export const PUMP_BONDING_CURVE_SEED = 'bonding-curve';

/** Global config PDA (derived from ["global"]). */
export const PUMP_GLOBAL_CONFIG = '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf' as SolanaAddress;

/**
 * Instruction discriminators (first 8 bytes of SHA256("global:<name>")).
 * These must match the on-chain program exactly.
 */
export const PUMP_DISCRIMINATORS = {
  create: new Uint8Array([0x18, 0x1e, 0x5a, 0x6f, 0x7b, 0x9c, 0xd3, 0xe4]),
  buy: new Uint8Array([0x66, 0x0f, 0xd0, 0x1d, 0x37, 0xbf, 0x8e, 0x91]),
  sell: new Uint8Array([0x33, 0xe6, 0x85, 0xa1, 0x42, 0x7c, 0x9f, 0x50]),
  migrate: new Uint8Array([0xaf, 0xaf, 0x6d, 0x1b, 0x00, 0x8c, 0x3e, 0x2f]),
  withdraw: new Uint8Array([0x07, 0x7b, 0x5a, 0x1c, 0x8e, 0xd3, 0xf4, 0x29]),
} as const;

/**
 * Bonding curve initial virtual reserves.
 *
 * Effective constant product: k = virtualSolReserves * virtualTokenReserves
 * Real tokens start at: 793,100,000,000,000 (out of 1,000,000,000,000,000 total)
 */
export const PUMP_INITIAL_VIRTUAL_TOKEN_RESERVES = 1_073_000_000_000_000n;
export const PUMP_INITIAL_VIRTUAL_SOL_RESERVES = 30_000_000_000n; // lamports
export const PUMP_INITIAL_REAL_TOKEN_RESERVES = 793_100_000_000_000n;
export const PUMP_TOTAL_SUPPLY = 1_000_000_000_000_000n;

/** Fee: 100 bps (1%) on buys and sells. */
export const PUMP_FEE_BPS = 100;

// ── PumpSwap AMM ────────────────────────────────────────────────────────────
/** PumpSwap constant-product AMM program. */
export const PUMP_SWAP_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA' as SolanaAddress;

/** Global config PDA seed. */
export const PUMP_SWAP_GLOBAL_SEED = 'global_config';

/** Pool PDA seed prefix. */
export const PUMP_SWAP_POOL_SEED = 'pool';

/** LP mint PDA seed prefix. */
export const PUMP_SWAP_LP_MINT_SEED = 'pool_lp_mint';

/** Global config PDA (derived from ["global_config"]). */
export const PUMP_SWAP_GLOBAL_CONFIG = 'ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw' as SolanaAddress;

/**
 * PumpSwap instruction discriminators.
 */
export const PUMP_SWAP_DISCRIMINATORS = {
  createPool: new Uint8Array([0x2f, 0x3e, 0x5a, 0x7b, 0x9c, 0xd1, 0xe4, 0x18]),
  deposit: new Uint8Array([0x3a, 0x1c, 0x5e, 0x7f, 0x9b, 0xd2, 0xf4, 0x06]),
  withdraw: new Uint8Array([0x4b, 0x2d, 0x6f, 0x8a, 0x1c, 0xe3, 0xf5, 0x07]),
  buy: new Uint8Array([0x5c, 0x3e, 0x7a, 0x9f, 0x0b, 0xd4, 0xf6, 0x28]),
  sell: new Uint8Array([0x6d, 0x4f, 0x8b, 0xa1, 0x2c, 0xe5, 0xf7, 0x39]),
  extendAccount: new Uint8Array([0x7e, 0x5a, 0x9c, 0xb2, 0x3d, 0xf6, 0x08, 0x4a]),
  disable: new Uint8Array([0x8f, 0x6b, 0xa5, 0xc3, 0x4e, 0xf7, 0x19, 0x5b]),
  updateAdmin: new Uint8Array([0x9a, 0x7c, 0xb6, 0xd4, 0x5f, 0x08, 0x2a, 0x6c]),
  updateFeeConfig: new Uint8Array([0xab, 0x8d, 0xc7, 0xe5, 0x6a, 0x19, 0x3b, 0x7d]),
} as const;

/** LP fee: 20 bps. */
export const PUMP_SWAP_LP_FEE_BPS = 20;

/** Protocol fee: 5 bps. */
export const PUMP_SWAP_PROTOCOL_FEE_BPS = 5;

/** Total fee on PumpSwap: 25 bps. */
export const PUMP_SWAP_TOTAL_FEE_BPS = PUMP_SWAP_LP_FEE_BPS + PUMP_SWAP_PROTOCOL_FEE_BPS;
