/**
 * Copy Trading Service
 *
 * Monitors source wallets and automatically copies their trades
 * with configurable multipliers and filters.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getCopyTradingConfig,
  setCopyTradingConfig,
  getActiveCopyTraderChatIds,
  type CopyTradingConfig,
} from "../db/redis.js";
import {
  getConnection,
  getTradeQuote,
  createSwapTransaction,
  formatAddress,
  toSol,
} from "./bags-integration.js";
import { nanoid } from "nanoid";

// ============================================================================
// Types
// ============================================================================

export interface CopyTradeStartParams {
  chatId: number;
  sourceWallet: string;
  multiplier: number; // e.g., 1.0 = same amount, 0.5 = half
  maxTradeAmount?: number; // max SOL per trade
  filters?: {
    dex?: string[];
    minAmount?: number;
    tokens?: string[]; // only copy trades for these tokens
  };
}

export interface DetectedTrade {
  sourceWallet: string;
  signature: string;
  type: "buy" | "sell";
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  timestamp: number;
}

export interface CopyTradeResult {
  chatId: number;
  sourceTrade: DetectedTrade;
  executedAmount: number;
  signature?: string;
  error?: string;
  timestamp: number;
}

export type CopyTradeCallback = (result: CopyTradeResult) => Promise<void>;

// ============================================================================
// State
// ============================================================================

let copyTradeCallback: CopyTradeCallback | null = null;
let monitoredWallets: Map<string, number[]> = new Map(); // wallet -> chatIds
let subscriptions: Map<string, number> = new Map(); // wallet -> subscriptionId

// ============================================================================
// Initialization
// ============================================================================

export function initCopyTrading(callback: CopyTradeCallback): void {
  copyTradeCallback = callback;
  console.log("✅ Copy trading service initialized");
}

// ============================================================================
// Copy Trading Control
// ============================================================================

/**
 * Start copy trading for a user
 */
export async function startCopyTrading(params: CopyTradeStartParams): Promise<void> {
  const config: CopyTradingConfig = {
    id: nanoid(),
    chatId: params.chatId,
    enabled: true,
    sourceWallet: params.sourceWallet,
    multiplier: params.multiplier.toString(),
    maxTradeAmount: params.maxTradeAmount?.toString(),
    filters: params.filters,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setCopyTradingConfig(config);

  // Add to monitored wallets
  const chatIds = monitoredWallets.get(params.sourceWallet) || [];
  if (!chatIds.includes(params.chatId)) {
    chatIds.push(params.chatId);
    monitoredWallets.set(params.sourceWallet, chatIds);
  }

  // Start monitoring if not already
  if (!subscriptions.has(params.sourceWallet)) {
    await startMonitoring(params.sourceWallet);
  }

  console.log(
    `📋 Started copy trading for chat ${params.chatId}: copying ${formatAddress(params.sourceWallet)} with ${params.multiplier}x multiplier`
  );
}

/**
 * Stop copy trading for a user
 */
export async function stopCopyTrading(chatId: number): Promise<void> {
  const config = await getCopyTradingConfig(chatId);
  if (!config) return;

  config.enabled = false;
  config.updatedAt = Date.now();
  await setCopyTradingConfig(config);

  // Remove from monitored wallets
  const chatIds = monitoredWallets.get(config.sourceWallet) || [];
  const index = chatIds.indexOf(chatId);
  if (index > -1) {
    chatIds.splice(index, 1);
    if (chatIds.length === 0) {
      monitoredWallets.delete(config.sourceWallet);
      await stopMonitoring(config.sourceWallet);
    } else {
      monitoredWallets.set(config.sourceWallet, chatIds);
    }
  }

  console.log(`🛑 Stopped copy trading for chat ${chatId}`);
}

/**
 * Get copy trading status for a user
 */
export async function getCopyTradingStatus(chatId: number): Promise<{
  enabled: boolean;
  sourceWallet?: string;
  multiplier?: string;
  maxTradeAmount?: string;
}> {
  const config = await getCopyTradingConfig(chatId);
  return {
    enabled: config?.enabled || false,
    sourceWallet: config?.sourceWallet,
    multiplier: config?.multiplier,
    maxTradeAmount: config?.maxTradeAmount,
  };
}

// ============================================================================
// Wallet Monitoring
// ============================================================================

async function startMonitoring(walletAddress: string): Promise<void> {
  const connection = getConnection();
  if (!connection) {
    console.warn("Cannot start monitoring: connection not initialized");
    return;
  }

  try {
    const publicKey = new PublicKey(walletAddress);

    // Subscribe to account changes
    const subscriptionId = connection.onAccountChange(
      publicKey,
      async (accountInfo, context) => {
        await handleWalletActivity(walletAddress);
      },
      "confirmed"
    );

    subscriptions.set(walletAddress, subscriptionId);
    console.log(`👀 Started monitoring wallet for copy trading: ${formatAddress(walletAddress)}`);
  } catch (error) {
    console.error(`Failed to monitor wallet ${walletAddress}:`, error);
  }
}

async function stopMonitoring(walletAddress: string): Promise<void> {
  const connection = getConnection();
  if (!connection) return;

  const subscriptionId = subscriptions.get(walletAddress);
  if (subscriptionId) {
    await connection.removeAccountChangeListener(subscriptionId);
    subscriptions.delete(walletAddress);
    console.log(`🛑 Stopped monitoring wallet: ${formatAddress(walletAddress)}`);
  }
}

// ============================================================================
// Trade Detection & Execution
// ============================================================================

async function handleWalletActivity(walletAddress: string): Promise<void> {
  const connection = getConnection();
  if (!connection || !copyTradeCallback) return;

  try {
    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(walletAddress),
      { limit: 1 }
    );

    if (signatures.length === 0) return;

    const latestSig = signatures[0];

    // Get and analyze transaction
    const tx = await connection.getParsedTransaction(latestSig.signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return;

    // Detect if this is a trade
    const trade = analyzeForTrade(walletAddress, tx);
    if (!trade) return;

    console.log(
      `🔔 Detected trade from ${formatAddress(walletAddress)}: ${trade.type} ${toSol(trade.inputAmount)} SOL`
    );

    // Get all chatIds copying this wallet
    const chatIds = monitoredWallets.get(walletAddress) || [];

    for (const chatId of chatIds) {
      await executeCopyTrade(chatId, trade);
    }
  } catch (error) {
    console.error(`Error handling wallet activity for ${walletAddress}:`, error);
  }
}

function analyzeForTrade(
  walletAddress: string,
  tx: any
): DetectedTrade | null {
  try {
    // Look for swap instructions
    const innerInstructions = tx.meta?.innerInstructions || [];
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    const postTokenBalances = tx.meta?.postTokenBalances || [];

    // Find token balance changes for the wallet
    const walletBalanceChanges: Array<{
      mint: string;
      before: number;
      after: number;
      change: number;
    }> = [];

    for (let i = 0; i < Math.max(preTokenBalances.length, postTokenBalances.length); i++) {
      const pre = preTokenBalances.find(
        (b: any) => b.accountIndex === i && b.owner === walletAddress
      );
      const post = postTokenBalances.find(
        (b: any) => b.accountIndex === i && b.owner === walletAddress
      );

      if (pre || post) {
        const mint = pre?.mint || post?.mint;
        const before = pre?.uiTokenAmount?.uiAmount || 0;
        const after = post?.uiTokenAmount?.uiAmount || 0;
        const change = after - before;

        if (change !== 0) {
          walletBalanceChanges.push({ mint, before, after, change });
        }
      }
    }

    // Check SOL balance change
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.accountKeys;

    const walletIndex = accountKeys.findIndex(
      (key: any) => key.pubkey.toBase58() === walletAddress
    );

    if (walletIndex === -1) return null;

    const solChange = (postBalances[walletIndex] || 0) - (preBalances[walletIndex] || 0);

    // Determine trade type
    if (walletBalanceChanges.length > 0 && solChange !== 0) {
      const tokenChange = walletBalanceChanges[0];

      if (solChange < 0 && tokenChange.change > 0) {
        // SOL decreased, tokens increased = BUY
        return {
          sourceWallet: walletAddress,
          signature: tx.transaction.signatures[0],
          type: "buy",
          inputMint: "So11111111111111111111111111111111111111112",
          outputMint: tokenChange.mint,
          inputAmount: Math.abs(solChange),
          outputAmount: tokenChange.change,
          timestamp: tx.blockTime || Date.now() / 1000,
        };
      } else if (solChange > 0 && tokenChange.change < 0) {
        // SOL increased, tokens decreased = SELL
        return {
          sourceWallet: walletAddress,
          signature: tx.transaction.signatures[0],
          type: "sell",
          inputMint: tokenChange.mint,
          outputMint: "So11111111111111111111111111111111111111112",
          inputAmount: Math.abs(tokenChange.change),
          outputAmount: solChange,
          timestamp: tx.blockTime || Date.now() / 1000,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error analyzing trade:", error);
    return null;
  }
}

async function executeCopyTrade(chatId: number, trade: DetectedTrade): Promise<void> {
  const config = await getCopyTradingConfig(chatId);
  if (!config?.enabled) return;

  // Apply multiplier
  const multiplier = parseFloat(config.multiplier);
  let tradeAmount = toSol(trade.inputAmount) * multiplier;

  // Apply max amount limit
  if (config.maxTradeAmount) {
    const maxAmount = parseFloat(config.maxTradeAmount);
    if (tradeAmount > maxAmount) {
      tradeAmount = maxAmount;
    }
  }

  // Apply filters
  if (config.filters) {
    const passesFilters = checkTradeFilters(trade, config.filters);
    if (!passesFilters) {
      console.log(`⏭️  Trade filtered out for chat ${chatId}`);
      return;
    }
  }

  console.log(
    `📋 Copying trade for chat ${chatId}: ${trade.type} ${tradeAmount.toFixed(4)} SOL`
  );

  // Notify via callback (actual execution happens in main plugin with wallet access)
  if (copyTradeCallback) {
    await copyTradeCallback({
      chatId,
      sourceTrade: trade,
      executedAmount: tradeAmount,
      timestamp: Date.now(),
    });
  }
}

function checkTradeFilters(trade: DetectedTrade, filters: Record<string, unknown>): boolean {
  // Check minimum amount
  if (filters.minAmount) {
    const minAmount = filters.minAmount as number;
    if (toSol(trade.inputAmount) < minAmount) {
      return false;
    }
  }

  // Check allowed tokens
  if (filters.tokens && Array.isArray(filters.tokens)) {
    const tokens = filters.tokens as string[];
    if (tokens.length > 0) {
      const tradedToken = trade.type === "buy" ? trade.outputMint : trade.inputMint;
      if (!tokens.includes(tradedToken)) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================================
// Public API
// ============================================================================

export function getMonitoredWallets(): string[] {
  return Array.from(monitoredWallets.keys());
}

export async function getActiveCopyTradersCount(): Promise<number> {
  const activeIds = await getActiveCopyTraderChatIds();
  return activeIds.length;
}
