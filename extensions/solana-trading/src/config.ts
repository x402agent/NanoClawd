import { z } from "zod";

export const SolanaTradingConfigSchema = z.object({
  enabled: z.boolean().default(true),

  // Database configuration
  database: z.object({
    url: z.string().describe("PostgreSQL connection URL"),
    ssl: z.boolean().default(true).describe("Use SSL for database connection"),
  }),

  // Helius API for wallet tracking
  helius: z
    .object({
      apiKey: z.string().describe("Helius API key"),
      webhookUrl: z.string().optional().describe("Webhook URL for transaction notifications"),
    })
    .optional(),

  // Bags.fm integration
  bags: z
    .object({
      apiKey: z.string().describe("Bags.fm API key"),
      partnerConfigKey: z.string().optional().describe("Partner config key for fee sharing"),
    })
    .optional(),

  // Solana RPC URL
  rpcUrl: z.string().optional().describe("Solana RPC endpoint URL"),

  // Sniper bot configuration
  sniper: z
    .object({
      enabled: z.boolean().default(false),
      defaultBuyAmount: z.number().default(0.1).describe("Default SOL amount per snipe"),
      defaultSlippage: z.number().default(15).describe("Default slippage tolerance (%)"),
      maxConcurrentSnipes: z.number().default(3).describe("Maximum concurrent snipe operations"),
    })
    .optional(),

  // Volume bot configuration
  volumeBot: z
    .object({
      enabled: z.boolean().default(false),
      defaultInterval: z.number().default(60).describe("Default interval between trades (seconds)"),
      maxWallets: z.number().default(5).describe("Maximum wallets for volume generation"),
    })
    .optional(),

  // Copy trading configuration
  copyTrading: z
    .object({
      enabled: z.boolean().default(false),
      defaultMultiplier: z.number().default(1).describe("Default trade size multiplier"),
      maxTradeAmount: z.number().optional().describe("Maximum trade amount in SOL"),
    })
    .optional(),

  // Wallet tracking configuration
  walletTracking: z
    .object({
      enabled: z.boolean().default(true),
      maxTrackedWallets: z.number().default(50).describe("Maximum wallets to track per user"),
    })
    .optional(),
});

export type SolanaTradingConfig = z.infer<typeof SolanaTradingConfigSchema>;

export function parseConfig(raw: unknown): SolanaTradingConfig {
  return SolanaTradingConfigSchema.parse(raw);
}

export function validateConfig(raw: unknown): {
  success: boolean;
  data?: SolanaTradingConfig;
  error?: z.ZodError;
} {
  const result = SolanaTradingConfigSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
