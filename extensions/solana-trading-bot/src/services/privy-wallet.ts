/**
 * Privy Wallet Integration
 *
 * Manages user wallets via Privy's server-side wallet API.
 * Each Telegram user gets their own non-custodial wallet.
 */

import { PrivyClient } from "@privy-io/server-auth";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getUser, setUser, type UserData } from "../db/redis.js";
import { nanoid } from "nanoid";

// ============================================================================
// Types
// ============================================================================

export interface PrivyConfig {
  appId: string;
  appSecret: string;
}

export interface WalletInfo {
  address: string;
  walletId: string;
}

// ============================================================================
// State
// ============================================================================

let privyClient: PrivyClient | null = null;
let privyConfig: PrivyConfig | null = null;

// ============================================================================
// Initialization
// ============================================================================

export function initPrivy(config: PrivyConfig): void {
  if (!config.appId || !config.appSecret) {
    console.warn("⚠️  Privy credentials not configured. Wallet features will be limited.");
    return;
  }

  privyClient = new PrivyClient(config.appId, config.appSecret);
  privyConfig = config;
  console.log("✅ Privy wallet integration initialized");
}

export function getPrivyClient(): PrivyClient | null {
  return privyClient;
}

// ============================================================================
// Wallet Management
// ============================================================================

/**
 * Get or create a wallet for a Telegram user
 */
export async function getOrCreateWallet(chatId: number): Promise<WalletInfo> {
  // Check if user already has a wallet
  const existingUser = await getUser(chatId);
  if (existingUser) {
    return {
      address: existingUser.address,
      walletId: existingUser.walletId,
    };
  }

  // Create new wallet via Privy
  if (!privyClient) {
    throw new Error("Privy not initialized. Cannot create wallet.");
  }

  const wallet = await privyClient.walletApi.create({ chainType: "solana" });

  // Save user data
  const userData: UserData = {
    id: chatId,
    address: wallet.address,
    walletId: wallet.id,
    createdAt: Date.now(),
  };
  await setUser(userData);

  console.log(`✅ Created wallet for user ${chatId}: ${wallet.address}`);

  return {
    address: wallet.address,
    walletId: wallet.id,
  };
}

/**
 * Get wallet info for a user (returns null if not found)
 */
export async function getWallet(chatId: number): Promise<WalletInfo | null> {
  const user = await getUser(chatId);
  if (!user) return null;

  return {
    address: user.address,
    walletId: user.walletId,
  };
}

/**
 * Get wallet address as PublicKey
 */
export async function getWalletPublicKey(chatId: number): Promise<PublicKey | null> {
  const wallet = await getWallet(chatId);
  if (!wallet) return null;
  return new PublicKey(wallet.address);
}

// ============================================================================
// Transaction Signing
// ============================================================================

/**
 * Sign a transaction using Privy's wallet API
 */
export async function signTransaction(
  walletId: string,
  transaction: VersionedTransaction
): Promise<VersionedTransaction> {
  if (!privyClient) {
    throw new Error("Privy not initialized");
  }

  // Serialize the transaction
  const serializedTx = Buffer.from(transaction.serialize()).toString("base64");

  // Sign with Privy
  const signedResult = await privyClient.walletApi.solana.signTransaction({
    walletId,
    transaction: serializedTx,
  });

  // Deserialize the signed transaction
  const signedTx = VersionedTransaction.deserialize(
    Buffer.from(signedResult.signedTransaction, "base64")
  );

  return signedTx;
}

/**
 * Sign and send a transaction
 */
export async function signAndSendWithPrivy(
  chatId: number,
  transaction: VersionedTransaction,
  connection: import("@solana/web3.js").Connection
): Promise<string> {
  const wallet = await getWallet(chatId);
  if (!wallet) {
    throw new Error("Wallet not found. Please run /start first.");
  }

  // Sign the transaction
  const signedTx = await signTransaction(wallet.walletId, transaction);

  // Send the transaction
  const signature = await connection.sendTransaction(signedTx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  // Wait for confirmation
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return signature;
}

// ============================================================================
// Wallet Export (for advanced users)
// ============================================================================

/**
 * Export wallet private key (requires additional security measures)
 * NOTE: This should be used carefully and with proper user authentication
 */
export async function exportWalletKey(walletId: string): Promise<string> {
  if (!privyClient) {
    throw new Error("Privy not initialized");
  }

  // This requires special permissions in Privy dashboard
  const result = await privyClient.walletApi.getWallet({ id: walletId });

  // For security, Privy doesn't expose private keys directly
  // Users would need to use the Privy SDK on client-side for export
  throw new Error("Private key export requires client-side Privy SDK");
}
