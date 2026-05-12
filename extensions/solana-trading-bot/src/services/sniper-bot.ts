/**
 * Sniper Bot Service
 *
 * Monitors for new token launches on Pump.fun and executes
 * automatic buy orders based on user configuration.
 *
 * Uses Yellowstone gRPC for ultra-low latency transaction streaming.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  getSniperConfig,
  setSniperConfig,
  getActiveSniperChatIds,
  type SniperConfig,
} from "../db/redis.js";
import {
  getConnection,
  getTradeQuote,
  createSwapTransaction,
  sendTransaction,
  formatAddress,
} from "./bags-integration.js";
import { nanoid } from "nanoid";

// ============================================================================
// Constants
// ============================================================================

const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// ============================================================================
// Types
// ============================================================================

export interface SniperStartParams {
  chatId: number;
  buyAmount: number; // in SOL
  slippage: number; // percentage
  maxBuyAmount?: number;
  filters?: {
    minLiquidity?: number;
    maxMarketCap?: number;
    onlyVerified?: boolean;
  };
}

export interface SniperResult {
  chatId: number;
  tokenMint: string;
  buyAmount: number;
  signature?: string;
  error?: string;
  timestamp: number;
}

export type SniperCallback = (result: SniperResult) => Promise<void>;

// ============================================================================
// State
// ============================================================================

let grpcClient: any = null;
let grpcStream: any = null;
let isRunning = false;
let sniperCallback: SniperCallback | null = null;
let grpcEndpoint: string = "";
let grpcToken: string = "";

// ============================================================================
// Initialization
// ============================================================================

export async function initSniperBot(
  endpoint: string,
  token: string,
  callback: SniperCallback
): Promise<void> {
  if (!endpoint) {
    console.warn("⚠️  GRPC_ENDPOINT not set. Sniper bot will be disabled.");
    return;
  }

  grpcEndpoint = endpoint;
  grpcToken = token;
  sniperCallback = callback;

  try {
    // Dynamic import for gRPC client
    const YellowstoneModule = await import("@triton-one/yellowstone-grpc");
    const Client = YellowstoneModule.default || YellowstoneModule;
    grpcClient = new Client(endpoint, token, undefined);
    console.log("✅ Sniper bot initialized");
  } catch (error) {
    console.warn("⚠️  Failed to initialize sniper bot:", error);
  }
}

// ============================================================================
// Sniper Control
// ============================================================================

/**
 * Start the sniper bot for a user
 */
export async function startSniper(params: SniperStartParams): Promise<void> {
  const config: SniperConfig = {
    id: nanoid(),
    chatId: params.chatId,
    enabled: true,
    buyAmount: params.buyAmount.toString(),
    slippage: params.slippage,
    maxBuyAmount: params.maxBuyAmount?.toString(),
    filters: params.filters,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setSniperConfig(config);

  // Start the global stream if not running
  if (!isRunning) {
    await startGrpcStream();
  }

  console.log(`🎯 Started sniper for chat ${params.chatId} with ${params.buyAmount} SOL`);
}

/**
 * Stop the sniper bot for a user
 */
export async function stopSniper(chatId: number): Promise<void> {
  const config = await getSniperConfig(chatId);
  if (config) {
    config.enabled = false;
    config.updatedAt = Date.now();
    await setSniperConfig(config);
  }

  // Check if any snipers are still active
  const activeIds = await getActiveSniperChatIds();
  if (activeIds.length === 0 && isRunning) {
    await stopGrpcStream();
  }

  console.log(`🛑 Stopped sniper for chat ${chatId}`);
}

/**
 * Get sniper status for a user
 */
export async function getSniperStatus(chatId: number): Promise<{
  enabled: boolean;
  buyAmount?: string;
  slippage?: number;
  globalRunning: boolean;
}> {
  const config = await getSniperConfig(chatId);
  return {
    enabled: config?.enabled || false,
    buyAmount: config?.buyAmount,
    slippage: config?.slippage,
    globalRunning: isRunning,
  };
}

// ============================================================================
// gRPC Stream Management
// ============================================================================

async function startGrpcStream(): Promise<void> {
  if (!grpcClient || isRunning) return;

  try {
    grpcStream = await grpcClient.subscribe();

    // Subscribe to Pump.fun program transactions
    const request = {
      slots: {},
      accounts: {},
      transactions: {
        pumpFun: {
          account: [PUMP_FUN_PROGRAM_ID],
        },
      },
      blocks: {},
      blocksMeta: {},
      accountsDataSlice: [],
      commitment: 1, // finalized
    };

    await grpcStream.write(request);
    isRunning = true;

    console.log("🔍 Sniper bot watching for new tokens...");

    // Handle incoming data
    grpcStream.on("data", async (update: any) => {
      await handleGrpcUpdate(update);
    });

    grpcStream.on("error", (error: Error) => {
      console.error("❌ Sniper bot stream error:", error);
      isRunning = false;
      // Attempt reconnect after delay
      setTimeout(() => startGrpcStream(), 5000);
    });

    grpcStream.on("end", () => {
      console.log("⚠️  Sniper bot stream ended");
      isRunning = false;
    });
  } catch (error) {
    console.error("Failed to start gRPC stream:", error);
    isRunning = false;
  }
}

async function stopGrpcStream(): Promise<void> {
  if (grpcStream) {
    grpcStream.destroy();
    grpcStream = null;
  }
  isRunning = false;
  console.log("🛑 Sniper bot stream stopped");
}

// ============================================================================
// Transaction Processing
// ============================================================================

async function handleGrpcUpdate(update: any): Promise<void> {
  if (!update.transaction?.transaction) return;

  const transaction = update.transaction.transaction;

  // Extract mint address from transaction
  const mintAddress = extractMintFromTransaction(transaction);
  if (!mintAddress) return;

  console.log(`🆕 New token detected: ${formatAddress(mintAddress)}`);

  // Get all active sniper configs
  const activeIds = await getActiveSniperChatIds();

  for (const chatId of activeIds) {
    const config = await getSniperConfig(chatId);
    if (!config?.enabled) continue;

    // Execute snipe for this user
    try {
      await executeSnipe(chatId, config, mintAddress);
    } catch (error) {
      console.error(`Error executing snipe for chat ${chatId}:`, error);

      if (sniperCallback) {
        await sniperCallback({
          chatId,
          tokenMint: mintAddress,
          buyAmount: parseFloat(config.buyAmount),
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: Date.now(),
        });
      }
    }
  }
}

function extractMintFromTransaction(transaction: any): string | null {
  try {
    // Extract mint from Pump.fun create transaction
    // The mint is typically the first account key in the transaction
    const accounts = transaction.transaction?.message?.accountKeys || [];
    if (accounts.length > 0) {
      return accounts[0]?.pubkey || null;
    }
  } catch (error) {
    console.error("Error extracting mint:", error);
  }
  return null;
}

// ============================================================================
// Snipe Execution
// ============================================================================

async function executeSnipe(
  chatId: number,
  config: SniperConfig,
  tokenMint: string
): Promise<void> {
  const connection = getConnection();
  if (!connection) {
    throw new Error("Connection not initialized");
  }

  // Apply filters if configured
  if (config.filters) {
    const passesFilters = await checkFilters(tokenMint, config.filters);
    if (!passesFilters) {
      console.log(`⏭️  Token ${formatAddress(tokenMint)} filtered out`);
      return;
    }
  }

  const buyAmountSol = parseFloat(config.buyAmount);
  const buyAmountLamports = Math.floor(buyAmountSol * LAMPORTS_PER_SOL);

  console.log(`🎯 Executing snipe: ${buyAmountSol} SOL -> ${formatAddress(tokenMint)}`);

  // Get quote
  const quote = await getTradeQuote(
    NATIVE_MINT,
    new PublicKey(tokenMint),
    buyAmountLamports
  );

  // The actual transaction would need the user's wallet
  // This will be called back to the main plugin which has wallet access
  if (sniperCallback) {
    await sniperCallback({
      chatId,
      tokenMint,
      buyAmount: buyAmountSol,
      timestamp: Date.now(),
    });
  }
}

async function checkFilters(
  tokenMint: string,
  filters: Record<string, unknown>
): Promise<boolean> {
  // TODO: Implement filter checks
  // - minLiquidity: Check pool liquidity
  // - maxMarketCap: Check market cap
  // - onlyVerified: Check if token is verified

  return true; // Pass all filters for now
}

// ============================================================================
// Public API
// ============================================================================

export function isSniperRunning(): boolean {
  return isRunning;
}

export async function getActiveSniperCount(): Promise<number> {
  const activeIds = await getActiveSniperChatIds();
  return activeIds.length;
}
