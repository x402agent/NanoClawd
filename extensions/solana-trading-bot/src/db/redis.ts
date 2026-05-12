/**
 * Upstash Redis Client
 *
 * Provides serverless-friendly Redis storage for:
 * - User wallet data
 * - Tracked wallets and tokens
 * - Bot configurations (sniper, copy trading, volume)
 * - Session data
 */

import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export interface RedisConfig {
  url: string;
  token: string;
}

/**
 * Initialize Redis client
 */
export function initRedis(config: RedisConfig): Redis {
  redis = new Redis({
    url: config.url,
    token: config.token,
  });
  console.log("✅ Upstash Redis initialized");
  return redis;
}

/**
 * Get the Redis client instance
 */
export function getRedis(): Redis | null {
  return redis;
}

// ============================================================================
// Key Prefixes
// ============================================================================

export const REDIS_KEYS = {
  // User data
  user: (chatId: number) => `user:${chatId}`,
  userByAddress: (address: string) => `user:addr:${address}`,

  // Wallet tracking
  trackedWallets: (chatId: number) => `tracked:wallets:${chatId}`,
  trackedTokens: (chatId: number, wallet: string) => `tracked:tokens:${chatId}:${wallet}`,

  // Bot configurations
  sniperConfig: (chatId: number) => `sniper:config:${chatId}`,
  volumeBotConfig: (chatId: number) => `volume:config:${chatId}`,
  copyTradingConfig: (chatId: number) => `copy:config:${chatId}`,

  // Messages/conversations
  messages: (chatId: number) => `messages:${chatId}`,

  // Global tracking sets
  allTrackedWallets: () => `tracked:all:wallets`,
  activeSnipers: () => `sniper:active`,
  activeCopyTraders: () => `copy:active`,
  activeVolumeBots: () => `volume:active`,
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

export interface UserData {
  id: number;
  address: string;
  walletId: string;
  createdAt: number;
}

export interface TrackedWallet {
  id: string;
  chatId: number;
  walletAddress: string;
  alias?: string;
  createdAt: number;
}

export interface TrackedToken {
  id: string;
  chatId: number;
  walletAddress: string;
  tokenMint: string;
  createdAt: number;
}

export interface SniperConfig {
  id: string;
  chatId: number;
  enabled: boolean;
  buyAmount: string;
  slippage: number;
  maxBuyAmount?: string;
  filters?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface VolumeBotConfig {
  id: string;
  chatId: number;
  enabled: boolean;
  tokenMint: string;
  poolId: string;
  buyMin: string;
  buyMax: string;
  interval: number;
  walletNum: number;
  createdAt: number;
  updatedAt: number;
}

export interface CopyTradingConfig {
  id: string;
  chatId: number;
  enabled: boolean;
  sourceWallet: string;
  multiplier: string;
  maxTradeAmount?: string;
  filters?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  createdAt: number;
  chatId: number;
  role: "user" | "assistant";
}

// ============================================================================
// User Operations
// ============================================================================

export async function getUser(chatId: number): Promise<UserData | null> {
  if (!redis) return null;
  return await redis.get<UserData>(REDIS_KEYS.user(chatId));
}

export async function setUser(user: UserData): Promise<void> {
  if (!redis) return;
  await Promise.all([
    redis.set(REDIS_KEYS.user(user.id), user),
    redis.set(REDIS_KEYS.userByAddress(user.address), user.id),
  ]);
}

export async function getUserByAddress(address: string): Promise<UserData | null> {
  if (!redis) return null;
  const chatId = await redis.get<number>(REDIS_KEYS.userByAddress(address));
  if (!chatId) return null;
  return await getUser(chatId);
}

export async function deleteUser(chatId: number): Promise<void> {
  if (!redis) return;
  const user = await getUser(chatId);
  if (user) {
    await Promise.all([
      redis.del(REDIS_KEYS.user(chatId)),
      redis.del(REDIS_KEYS.userByAddress(user.address)),
    ]);
  }
}

// ============================================================================
// Tracked Wallet Operations
// ============================================================================

export async function addTrackedWallet(wallet: TrackedWallet): Promise<void> {
  if (!redis) return;
  await Promise.all([
    redis.hset(REDIS_KEYS.trackedWallets(wallet.chatId), { [wallet.walletAddress]: JSON.stringify(wallet) }),
    redis.sadd(REDIS_KEYS.allTrackedWallets(), wallet.walletAddress),
  ]);
}

export async function removeTrackedWallet(chatId: number, walletAddress: string): Promise<void> {
  if (!redis) return;
  await redis.hdel(REDIS_KEYS.trackedWallets(chatId), walletAddress);
  // Note: We don't remove from allTrackedWallets as other users might track it
}

export async function getTrackedWallets(chatId: number): Promise<TrackedWallet[]> {
  if (!redis) return [];
  const data = await redis.hgetall<Record<string, string>>(REDIS_KEYS.trackedWallets(chatId));
  if (!data) return [];
  return Object.values(data).map((v) => JSON.parse(v) as TrackedWallet);
}

export async function getAllTrackedWalletAddresses(): Promise<string[]> {
  if (!redis) return [];
  return await redis.smembers(REDIS_KEYS.allTrackedWallets());
}

// ============================================================================
// Tracked Token Operations
// ============================================================================

export async function addTrackedToken(token: TrackedToken): Promise<void> {
  if (!redis) return;
  await redis.hset(
    REDIS_KEYS.trackedTokens(token.chatId, token.walletAddress),
    { [token.tokenMint]: JSON.stringify(token) }
  );
}

export async function removeTrackedToken(chatId: number, walletAddress: string, tokenMint: string): Promise<void> {
  if (!redis) return;
  await redis.hdel(REDIS_KEYS.trackedTokens(chatId, walletAddress), tokenMint);
}

export async function getTrackedTokens(chatId: number, walletAddress: string): Promise<TrackedToken[]> {
  if (!redis) return [];
  const data = await redis.hgetall<Record<string, string>>(REDIS_KEYS.trackedTokens(chatId, walletAddress));
  if (!data) return [];
  return Object.values(data).map((v) => JSON.parse(v) as TrackedToken);
}

// ============================================================================
// Sniper Config Operations
// ============================================================================

export async function getSniperConfig(chatId: number): Promise<SniperConfig | null> {
  if (!redis) return null;
  return await redis.get<SniperConfig>(REDIS_KEYS.sniperConfig(chatId));
}

export async function setSniperConfig(config: SniperConfig): Promise<void> {
  if (!redis) return;
  await redis.set(REDIS_KEYS.sniperConfig(config.chatId), config);
  if (config.enabled) {
    await redis.sadd(REDIS_KEYS.activeSnipers(), config.chatId.toString());
  } else {
    await redis.srem(REDIS_KEYS.activeSnipers(), config.chatId.toString());
  }
}

export async function getActiveSniperChatIds(): Promise<number[]> {
  if (!redis) return [];
  const ids = await redis.smembers(REDIS_KEYS.activeSnipers());
  return ids.map((id) => parseInt(id, 10));
}

// ============================================================================
// Volume Bot Config Operations
// ============================================================================

export async function getVolumeBotConfig(chatId: number): Promise<VolumeBotConfig | null> {
  if (!redis) return null;
  return await redis.get<VolumeBotConfig>(REDIS_KEYS.volumeBotConfig(chatId));
}

export async function setVolumeBotConfig(config: VolumeBotConfig): Promise<void> {
  if (!redis) return;
  await redis.set(REDIS_KEYS.volumeBotConfig(config.chatId), config);
  if (config.enabled) {
    await redis.sadd(REDIS_KEYS.activeVolumeBots(), config.chatId.toString());
  } else {
    await redis.srem(REDIS_KEYS.activeVolumeBots(), config.chatId.toString());
  }
}

export async function getActiveVolumeBotChatIds(): Promise<number[]> {
  if (!redis) return [];
  const ids = await redis.smembers(REDIS_KEYS.activeVolumeBots());
  return ids.map((id) => parseInt(id, 10));
}

// ============================================================================
// Copy Trading Config Operations
// ============================================================================

export async function getCopyTradingConfig(chatId: number): Promise<CopyTradingConfig | null> {
  if (!redis) return null;
  return await redis.get<CopyTradingConfig>(REDIS_KEYS.copyTradingConfig(chatId));
}

export async function setCopyTradingConfig(config: CopyTradingConfig): Promise<void> {
  if (!redis) return;
  await redis.set(REDIS_KEYS.copyTradingConfig(config.chatId), config);
  if (config.enabled) {
    await redis.sadd(REDIS_KEYS.activeCopyTraders(), config.chatId.toString());
  } else {
    await redis.srem(REDIS_KEYS.activeCopyTraders(), config.chatId.toString());
  }
}

export async function getActiveCopyTraderChatIds(): Promise<number[]> {
  if (!redis) return [];
  const ids = await redis.smembers(REDIS_KEYS.activeCopyTraders());
  return ids.map((id) => parseInt(id, 10));
}

// ============================================================================
// Message Operations (for conversation history)
// ============================================================================

export async function addMessage(message: ChatMessage): Promise<void> {
  if (!redis) return;
  // Store last 100 messages per chat
  await redis.lpush(REDIS_KEYS.messages(message.chatId), JSON.stringify(message));
  await redis.ltrim(REDIS_KEYS.messages(message.chatId), 0, 99);
}

export async function getMessages(chatId: number, limit: number = 50): Promise<ChatMessage[]> {
  if (!redis) return [];
  const data = await redis.lrange(REDIS_KEYS.messages(chatId), 0, limit - 1);
  return data.map((v) => JSON.parse(v as string) as ChatMessage);
}

export async function clearMessages(chatId: number): Promise<void> {
  if (!redis) return;
  await redis.del(REDIS_KEYS.messages(chatId));
}
