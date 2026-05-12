/**
 * Solana Trading Bot Extension for Clawdbot
 *
 * Features:
 * - Sniper Bot: Auto-buy tokens on launch with configurable filters
 * - Volume Bot: Generate trading volume for token price action
 * - Copy Trading: Mirror trades from tracked wallets
 * - Wallet Tracking: Monitor wallet activity with real-time notifications
 * - Token Launches: Launch tokens on Bags.fm with fee sharing
 *
 * Database: PostgreSQL + Drizzle ORM
 * Integration: Uses solana-agent extension for Privy wallet signing
 */

import plugin from "./plugin.js";

export default plugin;

// Re-export types for external use
export type { SolanaTradingConfig } from "./config.js";
export type { Database, User, TrackedWallet, SniperConfig, VolumeBotConfig, CopyTradingConfig } from "./db/index.js";
