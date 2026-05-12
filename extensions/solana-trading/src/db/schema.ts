import {
  pgTable,
  text,
  integer,
  boolean,
  bigint,
  jsonb,
  pgEnum,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Role enum for messages
export const roleEnum = pgEnum("role", ["user", "assistant"]);

// Users table - links Telegram chatId to wallet
export const usersTable = pgTable("trading_users", {
  id: text("id").primaryKey().notNull(),
  chatId: bigint("chat_id", { mode: "number" }).notNull().unique(),
  address: text("address").notNull(),
  walletId: text("wallet_id"), // Privy wallet ID if using Privy
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// Messages table - conversation history
export const messagesTable = pgTable("trading_messages", {
  id: text("id").primaryKey().notNull(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  text: text("text").notNull(),
  role: roleEnum("role"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// Tracked wallets - wallets being monitored for activity
export const trackedWalletsTable = pgTable(
  "tracked_wallets",
  {
    id: text("id").primaryKey().notNull(),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    walletAddress: text("wallet_address").notNull(),
    alias: text("alias"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("tracked_wallets_chat_wallet_idx").on(
      table.chatId,
      table.walletAddress
    ),
  ]
);

// Tracked tokens - specific tokens to monitor for a wallet
export const trackedTokensTable = pgTable(
  "tracked_tokens",
  {
    id: text("id").primaryKey().notNull(),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    walletAddress: text("wallet_address").notNull(),
    tokenMint: text("token_mint").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("tracked_tokens_chat_wallet_token_idx").on(
      table.chatId,
      table.walletAddress,
      table.tokenMint
    ),
  ]
);

// Sniper bot configuration - per-user sniper settings
export const sniperConfigTable = pgTable("sniper_config", {
  id: text("id").primaryKey().notNull(),
  chatId: bigint("chat_id", { mode: "number" }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  buyAmount: text("buy_amount").notNull(), // SOL amount as string for precision
  slippage: integer("slippage").default(15).notNull(), // percentage
  maxBuyAmount: text("max_buy_amount"), // Optional max buy amount
  filters: jsonb("filters").$type<{
    minLiquidity?: number;
    maxMarketCap?: number;
    requireSocials?: boolean;
    allowedDex?: string[];
  }>(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// Volume bot configuration - per-user volume bot settings
export const volumeBotConfigTable = pgTable("volume_bot_config", {
  id: text("id").primaryKey().notNull(),
  chatId: bigint("chat_id", { mode: "number" }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  tokenMint: text("token_mint").notNull(),
  poolId: text("pool_id").notNull(),
  buyMin: text("buy_min").notNull(), // SOL amount
  buyMax: text("buy_max").notNull(), // SOL amount
  interval: integer("interval").notNull(), // seconds
  walletNum: integer("wallet_num").default(1).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// Copy trading configuration - per-user copy trading settings
export const copyTradingConfigTable = pgTable("copy_trading_config", {
  id: text("id").primaryKey().notNull(),
  chatId: bigint("chat_id", { mode: "number" }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  sourceWallet: text("source_wallet").notNull(),
  multiplier: text("multiplier").default("1.0").notNull(), // Trade size multiplier
  maxTradeAmount: text("max_trade_amount"), // Optional max trade amount in SOL
  filters: jsonb("filters").$type<{
    allowedDex?: string[];
    minAmount?: string;
    maxAmount?: string;
    tokenAllowlist?: string[];
  }>(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// Transaction log - record of executed trades
export const transactionLogTable = pgTable("transaction_log", {
  id: text("id").primaryKey().notNull(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  type: text("type").notNull(), // 'snipe', 'copy', 'volume', 'manual'
  signature: text("signature").notNull(),
  inputMint: text("input_mint").notNull(),
  outputMint: text("output_mint").notNull(),
  inputAmount: text("input_amount").notNull(),
  outputAmount: text("output_amount"),
  status: text("status").notNull(), // 'pending', 'confirmed', 'failed'
  error: text("error"),
  metadata: jsonb("metadata"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// Type exports for use in services
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

export type TrackedWallet = typeof trackedWalletsTable.$inferSelect;
export type NewTrackedWallet = typeof trackedWalletsTable.$inferInsert;

export type TrackedToken = typeof trackedTokensTable.$inferSelect;
export type NewTrackedToken = typeof trackedTokensTable.$inferInsert;

export type SniperConfig = typeof sniperConfigTable.$inferSelect;
export type NewSniperConfig = typeof sniperConfigTable.$inferInsert;

export type VolumeBotConfig = typeof volumeBotConfigTable.$inferSelect;
export type NewVolumeBotConfig = typeof volumeBotConfigTable.$inferInsert;

export type CopyTradingConfig = typeof copyTradingConfigTable.$inferSelect;
export type NewCopyTradingConfig = typeof copyTradingConfigTable.$inferInsert;

export type TransactionLog = typeof transactionLogTable.$inferSelect;
export type NewTransactionLog = typeof transactionLogTable.$inferInsert;
