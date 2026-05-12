/**
 * Volume Bot Service
 *
 * Generates trading volume for tokens by executing random
 * buy/sell orders within configured parameters.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getVolumeBotConfig,
  setVolumeBotConfig,
  getActiveVolumeBotChatIds,
  type VolumeBotConfig,
} from "../db/redis.js";
import {
  getConnection,
  getTradeQuote,
  formatAddress,
  toLamports,
} from "./bags-integration.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { nanoid } from "nanoid";

// ============================================================================
// Types
// ============================================================================

export interface VolumeBotStartParams {
  chatId: number;
  tokenMint: string;
  poolId: string;
  buyMin: number; // min SOL per trade
  buyMax: number; // max SOL per trade
  interval: number; // seconds between trades
  walletNum?: number; // number of sub-wallets to use
}

export interface VolumeTradeResult {
  chatId: number;
  tokenMint: string;
  type: "buy" | "sell";
  amount: number;
  signature?: string;
  error?: string;
  timestamp: number;
}

export type VolumeTradeCallback = (result: VolumeTradeResult) => Promise<void>;

// ============================================================================
// State
// ============================================================================

let volumeCallback: VolumeTradeCallback | null = null;
let activeIntervals: Map<number, NodeJS.Timeout> = new Map(); // chatId -> interval

// ============================================================================
// Initialization
// ============================================================================

export function initVolumeBot(callback: VolumeTradeCallback): void {
  volumeCallback = callback;
  console.log("✅ Volume bot service initialized");
}

// ============================================================================
// Volume Bot Control
// ============================================================================

/**
 * Start the volume bot for a user
 */
export async function startVolumeBot(params: VolumeBotStartParams): Promise<void> {
  // Stop any existing interval
  await stopVolumeBot(params.chatId);

  const config: VolumeBotConfig = {
    id: nanoid(),
    chatId: params.chatId,
    enabled: true,
    tokenMint: params.tokenMint,
    poolId: params.poolId,
    buyMin: params.buyMin.toString(),
    buyMax: params.buyMax.toString(),
    interval: params.interval,
    walletNum: params.walletNum || 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setVolumeBotConfig(config);

  // Start the trading interval
  const intervalId = setInterval(
    () => executeVolumeTrade(params.chatId),
    params.interval * 1000
  );

  activeIntervals.set(params.chatId, intervalId);

  console.log(
    `📈 Started volume bot for chat ${params.chatId}: ` +
    `${formatAddress(params.tokenMint)} @ ${params.buyMin}-${params.buyMax} SOL every ${params.interval}s`
  );

  // Execute first trade immediately
  await executeVolumeTrade(params.chatId);
}

/**
 * Stop the volume bot for a user
 */
export async function stopVolumeBot(chatId: number): Promise<void> {
  // Clear interval
  const intervalId = activeIntervals.get(chatId);
  if (intervalId) {
    clearInterval(intervalId);
    activeIntervals.delete(chatId);
  }

  // Update config
  const config = await getVolumeBotConfig(chatId);
  if (config) {
    config.enabled = false;
    config.updatedAt = Date.now();
    await setVolumeBotConfig(config);
  }

  console.log(`🛑 Stopped volume bot for chat ${chatId}`);
}

/**
 * Get volume bot status for a user
 */
export async function getVolumeBotStatus(chatId: number): Promise<{
  enabled: boolean;
  tokenMint?: string;
  buyMin?: string;
  buyMax?: string;
  interval?: number;
  isRunning: boolean;
}> {
  const config = await getVolumeBotConfig(chatId);
  return {
    enabled: config?.enabled || false,
    tokenMint: config?.tokenMint,
    buyMin: config?.buyMin,
    buyMax: config?.buyMax,
    interval: config?.interval,
    isRunning: activeIntervals.has(chatId),
  };
}

// ============================================================================
// Trade Execution
// ============================================================================

async function executeVolumeTrade(chatId: number): Promise<void> {
  const config = await getVolumeBotConfig(chatId);
  if (!config?.enabled) {
    // Config disabled, stop the interval
    const intervalId = activeIntervals.get(chatId);
    if (intervalId) {
      clearInterval(intervalId);
      activeIntervals.delete(chatId);
    }
    return;
  }

  try {
    // Random amount between min and max
    const buyMin = parseFloat(config.buyMin);
    const buyMax = parseFloat(config.buyMax);
    const amount = buyMin + Math.random() * (buyMax - buyMin);

    // Random trade type (buy or sell)
    const tradeType = Math.random() > 0.5 ? "buy" : "sell";

    console.log(
      `📈 Volume trade for chat ${chatId}: ${tradeType} ${amount.toFixed(4)} SOL`
    );

    // Notify via callback (actual execution happens in main plugin)
    if (volumeCallback) {
      await volumeCallback({
        chatId,
        tokenMint: config.tokenMint,
        type: tradeType,
        amount,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error(`Volume trade error for chat ${chatId}:`, error);

    if (volumeCallback) {
      await volumeCallback({
        chatId,
        tokenMint: config.tokenMint,
        type: "buy",
        amount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
    }
  }
}

// ============================================================================
// Statistics
// ============================================================================

export interface VolumeBotStats {
  chatId: number;
  tokenMint: string;
  totalTrades: number;
  totalVolume: number;
  startedAt: number;
  lastTradeAt?: number;
}

// In-memory stats (would be better in Redis for persistence)
const botStats: Map<number, VolumeBotStats> = new Map();

export function updateStats(
  chatId: number,
  tokenMint: string,
  amount: number
): void {
  const existing = botStats.get(chatId);

  if (existing) {
    existing.totalTrades += 1;
    existing.totalVolume += amount;
    existing.lastTradeAt = Date.now();
  } else {
    botStats.set(chatId, {
      chatId,
      tokenMint,
      totalTrades: 1,
      totalVolume: amount,
      startedAt: Date.now(),
      lastTradeAt: Date.now(),
    });
  }
}

export function getStats(chatId: number): VolumeBotStats | undefined {
  return botStats.get(chatId);
}

// ============================================================================
// Public API
// ============================================================================

export function getActiveVolumeBots(): number {
  return activeIntervals.size;
}

export async function getActiveVolumeBotCount(): Promise<number> {
  const activeIds = await getActiveVolumeBotChatIds();
  return activeIds.length;
}

/**
 * Restart all active volume bots (called on startup)
 */
export async function restartActiveVolumeBots(): Promise<void> {
  const activeIds = await getActiveVolumeBotChatIds();

  for (const chatId of activeIds) {
    const config = await getVolumeBotConfig(chatId);
    if (config?.enabled) {
      // Restart the interval
      const intervalId = setInterval(
        () => executeVolumeTrade(chatId),
        config.interval * 1000
      );
      activeIntervals.set(chatId, intervalId);
      console.log(`📈 Restored volume bot for chat ${chatId}`);
    }
  }

  console.log(`📊 Restored ${activeIntervals.size} active volume bots`);
}
