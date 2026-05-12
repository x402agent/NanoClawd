/**
 * Bags.fm API Integration
 *
 * Provides trading functionality via Bags.fm SDK:
 * - Token swaps (buy/sell)
 * - Token launches
 * - Fee claiming
 * - Quote fetching
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL, VersionedTransaction, Keypair } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

// ============================================================================
// Types
// ============================================================================

export interface BagsConfig {
  apiKey: string;
  partnerConfigKey?: string;
  rpcEndpoint: string;
  rpcWebsocketEndpoint?: string;
}

export interface TokenInfo {
  tokenMint: PublicKey;
  tokenMetadata: string;
}

export interface TradeQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: number;
  slippageBps?: number;
}

export interface SwapResult {
  transaction: VersionedTransaction;
  quote: TradeQuote;
}

export interface ClaimablePosition {
  baseMint: string;
  virtualPoolAddress?: string;
  totalClaimableLamportsUserShare?: string;
  dammPositionInfo?: {
    position: string;
    pool: string;
    positionNftAccount: string;
    tokenAMint: string;
    tokenBMint: string;
    tokenAVault: string;
    tokenBVault: string;
  };
  isCustomFeeVault?: boolean;
  programId?: string;
  customFeeVaultClaimerA?: string;
  customFeeVaultClaimerB?: string;
  customFeeVaultClaimerSide?: string;
}

// ============================================================================
// State
// ============================================================================

let bagsConfig: BagsConfig | null = null;
let connection: Connection | null = null;
let sdk: any = null;

// ============================================================================
// Initialization
// ============================================================================

export async function initBagsSDK(config: BagsConfig): Promise<void> {
  bagsConfig = config;

  if (!config.apiKey) {
    console.warn("⚠️  BAGS_API_KEY not set. Bags features will be disabled.");
    return;
  }

  if (!config.rpcEndpoint) {
    console.warn("⚠️  RPC_ENDPOINT not set. Bags features will be disabled.");
    return;
  }

  connection = new Connection(config.rpcEndpoint, {
    wsEndpoint: config.rpcWebsocketEndpoint || undefined,
    commitment: "confirmed",
  });

  // Dynamically import Bags SDK (handles ESM/CJS issues)
  try {
    const BagsSDKModule = await import("@bagsfm/bags-sdk");
    const BagsSDK = BagsSDKModule.BagsSDK || BagsSDKModule.default;
    sdk = new BagsSDK(config.apiKey, connection, "processed");
    console.log("✅ Bags SDK initialized");
  } catch (error) {
    console.warn("⚠️  Failed to initialize Bags SDK:", error);
  }
}

export function getBagsSDK(): any | null {
  return sdk;
}

export function getConnection(): Connection | null {
  return connection;
}

export function getBagsConfig(): BagsConfig | null {
  return bagsConfig;
}

// ============================================================================
// Token Info & Metadata
// ============================================================================

export async function createTokenInfo(
  launchWallet: PublicKey,
  tokenName: string,
  tokenSymbol: string,
  description: string,
  imageUrl?: string,
  twitter?: string,
  website?: string,
  telegram?: string
): Promise<TokenInfo> {
  if (!sdk) throw new Error("Bags SDK not initialized");

  const tokenInfoParams: Record<string, string> = {
    name: tokenName,
    symbol: tokenSymbol?.toUpperCase()?.replace("$", ""),
    description: description,
  };

  if (imageUrl) {
    tokenInfoParams.imageUrl = imageUrl;
  } else {
    // Default Bags.fm logo
    tokenInfoParams.imageUrl =
      "https://pub-1ec717f11ac645d7aef23e7502188da0.r2.dev/6GtjHLzGW%2BjM8v%2Bpbviy%2BsrUhJwB2sqWEbQKpPo9OxVQsgXzvKjVUj0VD54bYE2fa8mOtGt3T13c%2BYG193dfXv%2Bgz%2BH87K9oUuLsN4AAAAAElFTkSuQmCC.png";
  }

  if (twitter) tokenInfoParams.twitter = twitter;
  if (website) tokenInfoParams.website = website;
  if (telegram) tokenInfoParams.telegram = telegram;

  const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata(tokenInfoParams);

  return {
    tokenMint: new PublicKey(tokenInfo.tokenMint),
    tokenMetadata: tokenInfo.tokenMetadata,
  };
}

// ============================================================================
// Fee Share Config
// ============================================================================

export async function createFeeShareConfig(
  tokenMint: PublicKey,
  creatorWallet: PublicKey,
  feeClaimers: Array<{ user: PublicKey; userBps: number }> = []
): Promise<PublicKey> {
  if (!sdk) throw new Error("Bags SDK not initialized");

  const config = await sdk.feeShare.getOrCreateFeeShareConfig({
    tokenMint,
    creatorWallet,
    feeClaimers,
  });

  return config.configKey;
}

// ============================================================================
// Token Launch
// ============================================================================

export async function createTokenLaunchTransaction(
  launchWallet: PublicKey,
  tokenMint: PublicKey,
  tokenMetadata: string,
  configKey: PublicKey,
  initialBuyLamports: number
): Promise<VersionedTransaction> {
  if (!sdk) throw new Error("Bags SDK not initialized");

  const transaction = await sdk.tokenLaunch.createLaunchTransaction({
    metadataUrl: tokenMetadata,
    tokenMint,
    launchWallet,
    initialBuyLamports,
    configKey,
  });

  return transaction;
}

// ============================================================================
// Trading - Quotes
// ============================================================================

export async function getTradeQuote(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number
): Promise<TradeQuote> {
  if (!sdk) throw new Error("Bags SDK not initialized");

  const quote = await sdk.trade.getQuote({
    inputMint,
    outputMint,
    amount,
    slippageMode: "auto",
  });

  return {
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    inAmount: quote.inAmount?.toString() || amount.toString(),
    outAmount: quote.outAmount?.toString() || "0",
    priceImpactPct: quote.priceImpactPct,
    slippageBps: quote.slippageBps,
  };
}

// ============================================================================
// Trading - Swaps
// ============================================================================

export async function createSwapTransaction(
  quoteResponse: any,
  userPublicKey: PublicKey
): Promise<SwapResult> {
  if (!sdk) throw new Error("Bags SDK not initialized");

  const result = await sdk.trade.createSwapTransaction({
    quoteResponse,
    userPublicKey,
  });

  return {
    transaction: result.transaction,
    quote: {
      inputMint: quoteResponse.inputMint?.toString() || "",
      outputMint: quoteResponse.outputMint?.toString() || "",
      inAmount: quoteResponse.inAmount?.toString() || "0",
      outAmount: quoteResponse.outAmount?.toString() || "0",
      priceImpactPct: quoteResponse.priceImpactPct,
    },
  };
}

/**
 * Execute a buy order (SOL -> Token)
 */
export async function executeBuy(
  userPublicKey: PublicKey,
  tokenMint: PublicKey,
  amountSol: number
): Promise<{ transaction: VersionedTransaction; quote: TradeQuote }> {
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const quote = await getTradeQuote(NATIVE_MINT, tokenMint, amountLamports);

  // Get the raw quote for swap transaction
  const rawQuote = await sdk.trade.getQuote({
    inputMint: NATIVE_MINT,
    outputMint: tokenMint,
    amount: amountLamports,
    slippageMode: "auto",
  });

  const swapResult = await createSwapTransaction(rawQuote, userPublicKey);
  return { transaction: swapResult.transaction, quote };
}

/**
 * Execute a sell order (Token -> SOL)
 */
export async function executeSell(
  userPublicKey: PublicKey,
  tokenMint: PublicKey,
  amountTokens: number,
  decimals: number = 9
): Promise<{ transaction: VersionedTransaction; quote: TradeQuote }> {
  const amountRaw = Math.floor(amountTokens * Math.pow(10, decimals));
  const quote = await getTradeQuote(tokenMint, NATIVE_MINT, amountRaw);

  // Get the raw quote for swap transaction
  const rawQuote = await sdk.trade.getQuote({
    inputMint: tokenMint,
    outputMint: NATIVE_MINT,
    amount: amountRaw,
    slippageMode: "auto",
  });

  const swapResult = await createSwapTransaction(rawQuote, userPublicKey);
  return { transaction: swapResult.transaction, quote };
}

// ============================================================================
// Fee Claiming
// ============================================================================

export async function getClaimablePositions(wallet: PublicKey): Promise<ClaimablePosition[]> {
  if (!bagsConfig?.apiKey) throw new Error("BAGS_API_KEY not set");

  const response = await fetch(
    `https://public-api-v2.bags.fm/api/v1/token-launch/claimable-positions?wallet=${wallet.toBase58()}`,
    {
      headers: {
        "x-api-key": bagsConfig.apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.success ? data.response : [];
}

export async function getClaimTransactions(claimData: any): Promise<any[]> {
  if (!bagsConfig?.apiKey) throw new Error("BAGS_API_KEY not set");

  const response = await fetch(
    "https://public-api-v2.bags.fm/api/v1/token-launch/claim-txs/v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": bagsConfig.apiKey,
      },
      body: JSON.stringify(claimData),
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.success ? data.response : [];
}

// ============================================================================
// Transaction Sending
// ============================================================================

/**
 * Send a signed transaction
 */
export async function sendTransaction(
  signedTransaction: VersionedTransaction
): Promise<string> {
  if (!connection) throw new Error("Connection not initialized");

  const signature = await connection.sendTransaction(signedTransaction, {
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

/**
 * Sign and send with a keypair (for bots/services)
 */
export async function signAndSendTransaction(
  transaction: VersionedTransaction,
  keypair: Keypair
): Promise<string> {
  transaction.sign([keypair]);
  return await sendTransaction(transaction);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatSol(lamports: number | string): number {
  const value = typeof lamports === "string" ? parseInt(lamports, 10) : lamports;
  return value / LAMPORTS_PER_SOL;
}

export function toSol(amount: number): number {
  return amount / LAMPORTS_PER_SOL;
}

export function toLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function formatAddress(address: string, chars: number = 6): string {
  if (!address || address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
