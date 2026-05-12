/**
 * Wallet Tracking Service
 *
 * Monitors Solana wallets for transactions and notifies users.
 * Uses WebSocket subscriptions for real-time updates.
 */

import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import {
  getAllTrackedWalletAddresses,
  getTrackedWallets,
  type TrackedWallet,
} from "../db/redis.js";
import { formatAddress, toSol } from "./bags-integration.js";

// ============================================================================
// Types
// ============================================================================

export interface TransactionNotification {
  chatId: number;
  walletAddress: string;
  alias?: string;
  signature: string;
  type: "incoming" | "outgoing" | "swap" | "unknown";
  amount?: number;
  token?: string;
  from?: string;
  to?: string;
  timestamp: number;
}

export type NotificationCallback = (notification: TransactionNotification) => Promise<void>;

// ============================================================================
// State
// ============================================================================

let connection: Connection | null = null;
let subscriptions: Map<string, number> = new Map(); // wallet -> subscriptionId
let notificationCallback: NotificationCallback | null = null;

// ============================================================================
// Initialization
// ============================================================================

export function initWalletTracking(
  conn: Connection,
  callback: NotificationCallback
): void {
  connection = conn;
  notificationCallback = callback;
  console.log("✅ Wallet tracking service initialized");
}

// ============================================================================
// Subscription Management
// ============================================================================

/**
 * Start tracking a wallet
 */
export async function startTracking(walletAddress: string): Promise<void> {
  if (!connection) {
    throw new Error("Wallet tracking not initialized");
  }

  // Already tracking?
  if (subscriptions.has(walletAddress)) {
    return;
  }

  try {
    const publicKey = new PublicKey(walletAddress);

    // Subscribe to account changes (transactions)
    const subscriptionId = connection.onAccountChange(
      publicKey,
      async (accountInfo, context) => {
        await handleAccountChange(walletAddress, accountInfo, context);
      },
      "confirmed"
    );

    subscriptions.set(walletAddress, subscriptionId);
    console.log(`👀 Started tracking wallet: ${formatAddress(walletAddress)}`);
  } catch (error) {
    console.error(`Failed to track wallet ${walletAddress}:`, error);
  }
}

/**
 * Stop tracking a wallet
 */
export async function stopTracking(walletAddress: string): Promise<void> {
  if (!connection) return;

  const subscriptionId = subscriptions.get(walletAddress);
  if (subscriptionId) {
    await connection.removeAccountChangeListener(subscriptionId);
    subscriptions.delete(walletAddress);
    console.log(`🛑 Stopped tracking wallet: ${formatAddress(walletAddress)}`);
  }
}

/**
 * Sync tracked wallets from Redis
 */
export async function syncTrackedWallets(): Promise<void> {
  const trackedAddresses = await getAllTrackedWalletAddresses();

  // Start tracking any new wallets
  for (const address of trackedAddresses) {
    if (!subscriptions.has(address)) {
      await startTracking(address);
    }
  }

  // Stop tracking any removed wallets
  for (const [address] of subscriptions) {
    if (!trackedAddresses.includes(address)) {
      await stopTracking(address);
    }
  }

  console.log(`📊 Synced ${trackedAddresses.length} tracked wallets`);
}

// ============================================================================
// Transaction Processing
// ============================================================================

async function handleAccountChange(
  walletAddress: string,
  accountInfo: any,
  context: any
): Promise<void> {
  if (!connection || !notificationCallback) return;

  try {
    // Get recent signatures for this wallet
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(walletAddress),
      { limit: 1 }
    );

    if (signatures.length === 0) return;

    const latestSig = signatures[0];

    // Get transaction details
    const tx = await connection.getParsedTransaction(latestSig.signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return;

    // Process and notify
    await processTransaction(walletAddress, latestSig.signature, tx);
  } catch (error) {
    console.error(`Error processing transaction for ${walletAddress}:`, error);
  }
}

async function processTransaction(
  walletAddress: string,
  signature: string,
  tx: ParsedTransactionWithMeta
): Promise<void> {
  if (!notificationCallback) return;

  // Determine transaction type and extract info
  const txInfo = analyzeTransaction(walletAddress, tx);

  // Find all users tracking this wallet
  // Note: In production, you'd have a reverse mapping from wallet -> chatIds
  // For now, we'll iterate through possible chatIds (could be optimized with Redis sets)

  // This would be called by the main plugin which has access to the chat context
  // For now, we emit a generic notification that the plugin can route

  const notification: TransactionNotification = {
    chatId: 0, // Will be filled in by the caller
    walletAddress,
    signature,
    type: txInfo.type,
    amount: txInfo.amount,
    token: txInfo.token,
    from: txInfo.from,
    to: txInfo.to,
    timestamp: tx.blockTime || Date.now() / 1000,
  };

  // The callback will handle routing to correct chat IDs
  await notificationCallback(notification);
}

interface TxAnalysis {
  type: "incoming" | "outgoing" | "swap" | "unknown";
  amount?: number;
  token?: string;
  from?: string;
  to?: string;
}

function analyzeTransaction(
  walletAddress: string,
  tx: ParsedTransactionWithMeta
): TxAnalysis {
  const result: TxAnalysis = { type: "unknown" };

  try {
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.accountKeys;

    // Find wallet index
    const walletIndex = accountKeys.findIndex(
      (key) => key.pubkey.toBase58() === walletAddress
    );

    if (walletIndex === -1) return result;

    // Calculate SOL balance change
    const balanceChange = (postBalances[walletIndex] || 0) - (preBalances[walletIndex] || 0);

    if (balanceChange > 0) {
      result.type = "incoming";
      result.amount = toSol(balanceChange);
      result.token = "SOL";
    } else if (balanceChange < 0) {
      result.type = "outgoing";
      result.amount = toSol(Math.abs(balanceChange));
      result.token = "SOL";
    }

    // Check for token transfers in inner instructions
    const innerInstructions = tx.meta?.innerInstructions || [];
    for (const inner of innerInstructions) {
      for (const ix of inner.instructions) {
        if ("parsed" in ix && ix.parsed?.type === "transfer") {
          result.type = "swap";
          break;
        }
      }
    }

    // Extract from/to addresses
    if (accountKeys.length >= 2) {
      if (result.type === "outgoing") {
        result.to = accountKeys[1]?.pubkey.toBase58();
      } else if (result.type === "incoming") {
        result.from = accountKeys[0]?.pubkey.toBase58();
      }
    }
  } catch (error) {
    console.error("Error analyzing transaction:", error);
  }

  return result;
}

// ============================================================================
// Public API
// ============================================================================

export function getActiveSubscriptions(): string[] {
  return Array.from(subscriptions.keys());
}

export function isTracking(walletAddress: string): boolean {
  return subscriptions.has(walletAddress);
}

/**
 * Format a notification for display
 */
export function formatNotification(notification: TransactionNotification): string {
  const emoji = notification.type === "incoming" ? "📥" :
                notification.type === "outgoing" ? "📤" :
                notification.type === "swap" ? "🔄" : "📋";

  const alias = notification.alias ? ` (${notification.alias})` : "";
  const amount = notification.amount ? `${notification.amount.toFixed(4)} ${notification.token || ""}` : "";

  let message = `${emoji} *Wallet Activity*${alias}\n\n`;
  message += `Wallet: \`${formatAddress(notification.walletAddress)}\`\n`;
  message += `Type: *${notification.type}*\n`;

  if (amount) {
    message += `Amount: *${amount}*\n`;
  }

  if (notification.from && notification.type === "incoming") {
    message += `From: \`${formatAddress(notification.from)}\`\n`;
  }

  if (notification.to && notification.type === "outgoing") {
    message += `To: \`${formatAddress(notification.to)}\`\n`;
  }

  message += `\n[View Transaction](https://solscan.io/tx/${notification.signature})`;

  return message;
}
