import type { Database } from "./db/index.js";
import type { SolanaTradingConfig } from "./config.js";

// Logger interface (matches Clawdbot's PluginLogger)
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

// Service context
export interface ServiceContext {
  db: Database;
  config: SolanaTradingConfig;
  logger: Logger;
  rpcUrl: string;
}

// Transaction event from wallet tracking
export interface TransactionEvent {
  signature: string;
  walletAddress: string;
  type: "swap" | "transfer" | "mint" | "burn" | "unknown";
  inputMint?: string;
  outputMint?: string;
  inputAmount?: string;
  outputAmount?: string;
  timestamp: number;
  programId?: string;
  raw?: unknown;
}

// Sniper target
export interface SniperTarget {
  tokenMint: string;
  poolId?: string;
  dex: string;
  liquidity?: number;
  marketCap?: number;
  timestamp: number;
}

// Trade execution result
export interface TradeResult {
  success: boolean;
  signature?: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount?: string;
  error?: string;
}

// Tool context (provided by Clawdbot)
export interface ToolContext {
  sessionKey?: string;
  agentId?: string;
  messageChannel?: string;
  workspaceDir?: string;
}

// Chat ID extraction from session key
export function extractChatIdFromSession(sessionKey: string): number | null {
  // Session key format: agent:{agentId}:telegram:direct:{chatId}
  // or: agent:{agentId}:telegram:group:{groupId}
  const match = sessionKey.match(/:telegram:(?:direct|group):(-?\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Format SOL amount for display
export function formatSol(lamports: number | string): string {
  const sol = typeof lamports === "string" ? parseFloat(lamports) : lamports / 1e9;
  return sol.toFixed(6);
}

// Format address for display
export function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}
