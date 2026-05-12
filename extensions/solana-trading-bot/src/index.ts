/**
 * Solana Trading Bot Extension for Clawdbot
 *
 * A comprehensive Solana trading extension with:
 * - Bags.fm integration for swaps and token launches
 * - Privy wallet management
 * - Sniper bot for new token launches
 * - Copy trading
 * - Volume bot
 * - Wallet tracking with notifications
 *
 * @module @clawdbot/solana-trading-bot
 */

import type { ClawdbotPluginApi, ClawdbotPluginDefinition } from "clawdbot/plugin-sdk";
import { initRedis } from "./db/redis.js";
import {
  initBagsSDK,
  getConnection,
} from "./services/bags-integration.js";
import { initPrivy } from "./services/privy-wallet.js";
import {
  initWalletTracking,
  syncTrackedWallets,
  formatNotification,
} from "./services/wallet-tracking.js";
import { initSniperBot } from "./services/sniper-bot.js";
import { initCopyTrading } from "./services/copy-trading.js";
import { initVolumeBot, restartActiveVolumeBots } from "./services/volume-bot.js";
import { createAllTools } from "./tools/index.js";

// ============================================================================
// Plugin Configuration Interface
// ============================================================================

interface TradingBotConfig {
  enabled?: boolean;
  bagsApiKey?: string;
  bagsPartnerConfigKey?: string;
  rpcEndpoint?: string;
  rpcWebsocketEndpoint?: string;
  grpcEndpoint?: string;
  grpcToken?: string;
  upstashRedisUrl?: string;
  upstashRedisToken?: string;
  privy?: {
    appId?: string;
    appSecret?: string;
  };
  defaultSlippage?: number;
  sniperEnabled?: boolean;
  copyTradingEnabled?: boolean;
}

// ============================================================================
// Plugin Definition
// ============================================================================

const plugin: ClawdbotPluginDefinition = {
  id: "solana-trading-bot",
  name: "Solana Trading Bot",
  description: "Advanced Solana trading with Bags.fm - sniper, copy trading, volume bot, wallet tracking",
  version: "1.0.0",

  async register(api: ClawdbotPluginApi) {
    const config = (api.pluginConfig || {}) as TradingBotConfig;

    // Check if enabled
    if (config.enabled === false) {
      api.logger.info("Solana Trading Bot is disabled in config");
      return;
    }

    api.logger.info("Initializing Solana Trading Bot...");

    // =========================================================================
    // Initialize Redis
    // =========================================================================
    const redisUrl = config.upstashRedisUrl || process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = config.upstashRedisToken || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      initRedis({ url: redisUrl, token: redisToken });
    } else {
      api.logger.warn("Redis not configured. User data will not persist.");
    }

    // =========================================================================
    // Initialize Bags SDK
    // =========================================================================
    const bagsApiKey = config.bagsApiKey || process.env.BAGS_API_KEY;
    const rpcEndpoint = config.rpcEndpoint || process.env.RPC_ENDPOINT || process.env.RPC_URL;
    const rpcWsEndpoint = config.rpcWebsocketEndpoint || process.env.RPC_WEBSOCKET_ENDPOINT;

    if (bagsApiKey && rpcEndpoint) {
      await initBagsSDK({
        apiKey: bagsApiKey,
        partnerConfigKey: config.bagsPartnerConfigKey || process.env.BAGS_PARTNER_CONFIG_KEY,
        rpcEndpoint,
        rpcWebsocketEndpoint: rpcWsEndpoint,
      });
    } else {
      api.logger.warn("Bags SDK not configured. Trading features disabled.");
    }

    // =========================================================================
    // Initialize Privy
    // =========================================================================
    const privyAppId = config.privy?.appId || process.env.PRIVY_APP_ID;
    const privyAppSecret = config.privy?.appSecret || process.env.PRIVY_APP_SECRET;

    if (privyAppId && privyAppSecret) {
      initPrivy({ appId: privyAppId, appSecret: privyAppSecret });
    } else {
      api.logger.warn("Privy not configured. Wallet features limited.");
    }

    // =========================================================================
    // Initialize Wallet Tracking
    // =========================================================================
    const connection = getConnection();
    if (connection) {
      initWalletTracking(connection, async (notification) => {
        // TODO: Route notification to correct chat via Telegram
        // This would use Clawdbot's messaging system
        api.logger.info(`Wallet notification: ${JSON.stringify(notification)}`);
      });

      // Sync tracked wallets from Redis
      await syncTrackedWallets();
    }

    // =========================================================================
    // Initialize Sniper Bot
    // =========================================================================
    const grpcEndpoint = config.grpcEndpoint || process.env.GRPC_ENDPOINT;
    const grpcToken = config.grpcToken || process.env.GRPC_TOKEN;

    if (grpcEndpoint && config.sniperEnabled !== false) {
      await initSniperBot(grpcEndpoint, grpcToken || "", async (result) => {
        api.logger.info(`Sniper result: ${JSON.stringify(result)}`);
        // TODO: Execute actual trade and notify user
      });
    }

    // =========================================================================
    // Initialize Copy Trading
    // =========================================================================
    if (config.copyTradingEnabled !== false) {
      initCopyTrading(async (result) => {
        api.logger.info(`Copy trade: ${JSON.stringify(result)}`);
        // TODO: Execute actual trade and notify user
      });
    }

    // =========================================================================
    // Initialize Volume Bot
    // =========================================================================
    initVolumeBot(async (result) => {
      api.logger.info(`Volume trade: ${JSON.stringify(result)}`);
      // TODO: Execute actual trade
    });

    // Restart any active volume bots
    await restartActiveVolumeBots();

    // =========================================================================
    // Register Agent Tools
    // =========================================================================
    const tools = createAllTools();
    for (const tool of tools) {
      api.registerTool(tool);
    }

    api.logger.info(`Registered ${tools.length} trading tools`);

    // =========================================================================
    // Register Gateway Methods (for WebSocket/HTTP API)
    // =========================================================================
    api.registerGatewayMethod("solana.trading.getWallet", async (params, ctx) => {
      // Gateway method implementation
      return { success: true, message: "Wallet gateway method" };
    });

    api.registerGatewayMethod("solana.trading.buy", async (params, ctx) => {
      return { success: true, message: "Buy gateway method" };
    });

    api.registerGatewayMethod("solana.trading.sell", async (params, ctx) => {
      return { success: true, message: "Sell gateway method" };
    });

    // =========================================================================
    // Register CLI Commands
    // =========================================================================
    api.registerCli((ctx) => {
      const { program } = ctx;

      // Add trading subcommands
      const tradingCmd = program
        .command("trading")
        .description("Solana trading bot commands");

      tradingCmd
        .command("status")
        .description("Show trading bot status")
        .action(async () => {
          ctx.logger.info("Trading bot status:");
          ctx.logger.info(`  Connection: ${connection ? "Connected" : "Not connected"}`);
          ctx.logger.info(`  Tools: ${tools.length} registered`);
        });

      tradingCmd
        .command("wallet")
        .description("Show wallet info")
        .action(async () => {
          ctx.logger.info("Use the Telegram bot or agent tools to manage wallets");
        });
    });

    // =========================================================================
    // Register Lifecycle Hooks
    // =========================================================================
    api.on("gateway_start", async (event) => {
      api.logger.info("Trading bot: Gateway started");
    });

    api.on("gateway_stop", async (event) => {
      api.logger.info("Trading bot: Gateway stopped");
    });

    api.logger.info("✅ Solana Trading Bot initialized successfully!");
  },
};

export default plugin;

// Also export for named imports
export { plugin as SolanaTradingBotPlugin };

// Re-export types for consumers
export type { TradingBotConfig };
