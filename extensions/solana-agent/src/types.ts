/**
 * Type definitions for Clawdbot Solana Agent integration
 */

import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

/**
 * Configuration for the Solana Agent
 */
export interface SolanaAgentConfig {
  /** Solana RPC URL */
  rpcUrl: string;
  /** Network: mainnet or devnet */
  network: "mainnet" | "devnet";
  /** Wallet private key (base58 encoded) - optional if using external wallet */
  privateKey?: string;
  /** Sign transactions only without broadcasting */
  signOnly?: boolean;
  /** Priority fee level */
  priorityLevel?: "medium" | "high" | "veryHigh";

  // API Keys for various protocols
  heliusApiKey?: string;
  jupiterReferralAccount?: string;
  jupiterFeeBps?: number;
  coingeckoProApiKey?: string;
  pinataJwt?: string;
  pinataGateway?: string;
  pumpFunReferralWallet?: string;
  magicEdenApiKey?: string;
  openaiApiKey?: string;
  alloraApiKey?: string;
  elfaAiApiKey?: string;
  messariApiKey?: string;
  okxApiKey?: string;
  okxSecretKey?: string;
  okxPassphrase?: string;
  okxProjectId?: string;
}

/**
 * Wallet balance response
 */
export interface WalletBalance {
  sol: number;
  lamports: number;
  tokens: TokenBalance[];
}

/**
 * Token balance entry
 */
export interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
  symbol?: string;
  name?: string;
  logoUri?: string;
  usdValue?: number;
}

/**
 * Swap quote response
 */
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  minOutputAmount: number;
  priceImpact: number;
  fee: number;
  route: string;
  routeInfo?: SwapRouteInfo[];
}

/**
 * Swap route info
 */
export interface SwapRouteInfo {
  dex: string;
  inputMint: string;
  outputMint: string;
  percentage: number;
}

/**
 * Swap execution result
 */
export interface SwapResult {
  status: "success" | "error";
  signature?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: string;
}

/**
 * Token launch parameters
 */
export interface TokenLaunchParams {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  initialLiquiditySOL?: number;
  slippageBps?: number;
  priorityFee?: number;
}

/**
 * Token launch result
 */
export interface TokenLaunchResult {
  status: "success" | "error";
  signature?: string;
  mint?: string;
  metadataUri?: string;
  marketAddress?: string;
  error?: string;
}

/**
 * NFT collection parameters
 */
export interface NFTCollectionParams {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  royaltyBps?: number;
  creators?: Array<{ address: string; share: number }>;
}

/**
 * NFT mint parameters
 */
export interface NFTMintParams {
  collectionAddress: string;
  name: string;
  description?: string;
  imageUrl?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  recipient?: string;
}

/**
 * NFT result
 */
export interface NFTResult {
  status: "success" | "error";
  signature?: string;
  address?: string;
  error?: string;
}

/**
 * Pool information
 */
export interface PoolInfo {
  address: string;
  type: "pump" | "meteora" | "raydium" | "orca" | "manifest" | "fluxbeam";
  baseMint: string;
  quoteMint: string;
  liquidity: number;
  volume24h?: number;
  fee?: number;
  apy?: number;
}

/**
 * Price info from various sources
 */
export interface PriceInfo {
  source: "jupiter" | "pyth" | "coingecko" | "dexscreener";
  mint: string;
  priceUsd: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdated: number;
}

/**
 * Staking parameters
 */
export interface StakeParams {
  amount: number;
  validator?: string;
  protocol?: "native" | "jupiter" | "sanctum" | "solayer";
}

/**
 * Staking result
 */
export interface StakeResult {
  status: "success" | "error";
  signature?: string;
  stakeAccount?: string;
  lstMint?: string;
  error?: string;
}

/**
 * Limit order parameters
 */
export interface LimitOrderParams {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  expireAt?: number;
}

/**
 * Limit order result
 */
export interface LimitOrderResult {
  status: "success" | "error";
  orderId?: string;
  signature?: string;
  error?: string;
}

/**
 * Token security check result
 */
export interface TokenSecurityCheck {
  mint: string;
  score: number;
  risks: Array<{
    name: string;
    level: "low" | "medium" | "high" | "critical";
    description: string;
    score: number;
  }>;
  tokenProgram: string;
  tokenType: string;
}

/**
 * Domain registration parameters
 */
export interface DomainParams {
  domain: string;
  owner?: string;
}

/**
 * Webhook parameters (Helius)
 */
export interface WebhookParams {
  webhookUrl: string;
  transactionTypes: string[];
  accountAddresses?: string[];
  webhookType?: "enhanced" | "raw";
}

/**
 * Action execution result
 */
export interface ActionResult {
  status: "success" | "error";
  data?: Record<string, unknown>;
  message?: string;
  error?: string;
  code?: string;
}

/**
 * Transaction signing request (for mobile wallet)
 */
export interface SigningRequest {
  requestId: string;
  transaction: string; // Base64 encoded
  message?: string;
  action: string;
  params?: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

/**
 * Signed transaction response (from mobile wallet)
 */
export interface SignedTransaction {
  requestId: string;
  signature: string;
  signedTransaction?: string; // Base64 encoded if needed
}

/**
 * Available Solana actions by category
 */
export type SolanaActionCategory =
  | "token"
  | "defi"
  | "nft"
  | "misc"
  | "blinks";

/**
 * Action metadata for UI display
 */
export interface ActionMetadata {
  name: string;
  displayName: string;
  description: string;
  category: SolanaActionCategory;
  similes: string[];
  requiresWallet: boolean;
  requiresSignature: boolean;
}
