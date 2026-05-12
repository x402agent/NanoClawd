import type { SolanaTradingConfig } from './config.js';
import { parseConfig } from './config.js';
import {
  closeDatabase,
  createDatabase,
  type Database,
} from './db/index.js';
import { BagsAgentService } from './services/bags-agent-service.js';
import { BagsSDKService } from './services/bags-sdk-service.js';
import { BagsService } from './services/bags-service.js';
import { BirdeyeWebSocketService } from './services/birdeye-websocket.js';
import { CopyTradingService } from './services/copy-trading-service.js';
import { SniperService } from './services/sniper-service.js';
import { VolumeBotService } from './services/volume-service.js';
// Services
import { WalletTrackerService } from './services/wallet-tracker.js';
import { createTradingTools } from './tools/index.js';
import { setBirdeyeWebSocketService } from './tools/birdeye-alert-tools.js';
import { setBagsService } from './tools/launch-tools.js';
import type {
  Logger,
  TransactionEvent,
} from './types.js';

// Plugin state
let config: SolanaTradingConfig | null = null;
let db: Database | null = null;
let logger: Logger | null = null;
let initialized = false;

// Service instances
let walletTracker: WalletTrackerService | null = null;
let sniperService: SniperService | null = null;
let volumeBotService: VolumeBotService | null = null;
let copyTradingService: CopyTradingService | null = null;
let bagsService: BagsService | null = null;
let bagsSDKService: BagsSDKService | null = null;
let bagsAgentService: BagsAgentService | null = null;
let birdeyeWebSocket: BirdeyeWebSocketService | null = null;
let mawdBotLauncher: import('./services/mawdbot-launcher.js').MawdBotLauncher | null = null;

// Lazy initialization
async function ensureInitialized(): Promise<Database> {
  if (!initialized && config) {
    db = createDatabase(config.database);
    initialized = true;
    logger?.info("[solana-trading] Database initialized");
  }
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

// Get RPC URL from config, env, or Helius
function getRpcUrl(cfg: SolanaTradingConfig): string {
  // 1. Config file
  if (cfg.rpcUrl) {
    return cfg.rpcUrl;
  }
  // 2. Environment variables (multiple options)
  const envRpc = process.env.RPC_ENDPOINT 
    || process.env.RPC_URL 
    || process.env.HELIUS_MAINNET_URL
    || process.env.SOLANA_RPC_URL;
  if (envRpc) {
    return envRpc;
  }
  // 3. Build from Helius API key
  if (cfg.helius?.apiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${cfg.helius.apiKey}`;
  }
  const heliusKey = process.env.HELIUS_API_KEY;
  if (heliusKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  }
  return "https://api.mainnet-beta.solana.com";
}

// Get trading wallet from env
function getTradingWallet(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.SOLANA_TRADING_WALLET_PUBLIC;
  const privateKey = process.env.SOLANA_TRADING_WALLET_PRIVATE;
  if (publicKey && privateKey) {
    return { publicKey, privateKey };
  }
  return null;
}

// Plugin definition
const plugin = {
  id: "solana-trading",
  name: "Solana Trading Bot",
  description: "Trading automation: sniper, volume bot, copy trading, wallet tracking",

  configSchema: {
    parse: (value: unknown) => parseConfig(value),
    safeParse: (value: unknown) => {
      try {
        return { success: true, data: parseConfig(value) };
      } catch (error) {
        return { success: false, error };
      }
    },
  },

  async register(api: any) {
    config = parseConfig(api.pluginConfig || {});
    logger = api.logger;

    if (!config.enabled) {
      logger?.info("[solana-trading] Plugin disabled");
      return;
    }

    const rpcUrl = getRpcUrl(config);
    const wallet = getTradingWallet();
    
    logger?.info(`[solana-trading] Using RPC: ${rpcUrl.replace(/api-key=[^&]+/, "api-key=***")}`);
    if (wallet) {
      logger?.info(`[solana-trading] Trading wallet: ${wallet.publicKey}`);
    } else {
      logger?.warn("[solana-trading] No trading wallet configured - set SOLANA_TRADING_WALLET_PUBLIC/PRIVATE env vars");
    }

    // Initialize Birdeye WebSocket service for real-time alerts
    const birdeyeApiKey = process.env.BIRDEYE_API_KEY;
    if (birdeyeApiKey) {
      birdeyeWebSocket = new BirdeyeWebSocketService(
        {
          apiKey: birdeyeApiKey,
          autoReconnect: true,
          maxReconnectAttempts: 10,
          reconnectDelay: 5000,
        },
        logger!
      );
      setBirdeyeWebSocketService(birdeyeWebSocket);

      // Connect WebSocket
      try {
        await birdeyeWebSocket.connect();
        logger?.info("[solana-trading] Birdeye WebSocket connected - real-time alerts enabled");
      } catch (err) {
        logger?.warn(`[solana-trading] Birdeye WebSocket connection failed: ${err}`);
      }

      // Set up event handlers for alerts
      birdeyeWebSocket.on('alert', (alert: any) => {
        logger?.info(`[solana-trading] 🚨 Birdeye Alert: ${alert.type} - ${JSON.stringify(alert.data)}`);
        // TODO: Integrate with message delivery system
        // This will send alerts to WhatsApp/Telegram/Discord via the gateway
      });

      birdeyeWebSocket.on('price', (data: any) => {
        logger?.debug(`[solana-trading] Price update: ${data.address} = $${data.price}`);
      });

      birdeyeWebSocket.on('transaction', (data: any) => {
        logger?.debug(`[solana-trading] Transaction: ${data.signature}`);
      });

      birdeyeWebSocket.on('new_listing', (data: any) => {
        logger?.info(`[solana-trading] 🆕 New listing: ${data.baseToken?.symbol} with $${data.initialLiquidity} liquidity`);
      });

      birdeyeWebSocket.on('large_trade', (data: any) => {
        logger?.info(`[solana-trading] 🐳 Large trade: ${data.side?.toUpperCase()} $${data.amountUsd?.toLocaleString()}`);
      });

      birdeyeWebSocket.on('wallet_activity', (data: any) => {
        logger?.info(`[solana-trading] 👛 Wallet activity: ${data.walletAddress}`);
      });
    }

    // Register all agent tools
    const tools = createTradingTools({
      ensureDb: ensureInitialized,
      config,
      rpcUrl,
      logger: logger!,
    });

    for (const tool of tools) {
      api.registerTool(tool);
    }

    // Create service context
    const createServiceContext = async () => ({
      db: await ensureInitialized(),
      config: config!,
      logger: logger!,
      rpcUrl,
    });

    // Register background services
    if (config.walletTracking?.enabled !== false) {
      api.registerService({
        id: "solana-trading-wallet-tracker",
        async start() {
          const ctx = await createServiceContext();
          walletTracker = new WalletTrackerService({
            ...ctx,
            trackerConfig: {
              heliusApiKey: config!.helius?.apiKey,
              maxTrackedWallets: config!.walletTracking?.maxTrackedWallets,
            },
          });

          // Connect wallet tracker to copy trading
          walletTracker.setTransactionCallback(async (event: TransactionEvent) => {
            if (copyTradingService && event.type === "swap") {
              await copyTradingService.handleSourceTransaction(event);
            }
          });

          await walletTracker.start();
          logger?.info("[solana-trading] Wallet tracker service started");
        },
        async stop() {
          await walletTracker?.stop();
          walletTracker = null;
          logger?.info("[solana-trading] Wallet tracker service stopped");
        },
      });
    }

    if (config.sniper?.enabled) {
      api.registerService({
        id: "solana-trading-sniper",
        async start() {
          const ctx = await createServiceContext();
          sniperService = new SniperService({
            ...ctx,
            sniperConfig: {
              enabled: true,
              defaultBuyAmount: config!.sniper?.defaultBuyAmount ?? 0.1,
              defaultSlippage: config!.sniper?.defaultSlippage ?? 15,
              maxConcurrentSnipes: 5,
            },
          });
          await sniperService.start();
          logger?.info("[solana-trading] Sniper service started");
        },
        async stop() {
          await sniperService?.stop();
          sniperService = null;
          logger?.info("[solana-trading] Sniper service stopped");
        },
      });
    }

    if (config.volumeBot?.enabled) {
      api.registerService({
        id: "solana-trading-volume-bot",
        async start() {
          const ctx = await createServiceContext();
          volumeBotService = new VolumeBotService({
            ...ctx,
            volumeConfig: {
              enabled: true,
              defaultInterval: 60,
              maxWallets: 10,
            },
          });
          await volumeBotService.start();
          logger?.info("[solana-trading] Volume bot service started");
        },
        async stop() {
          await volumeBotService?.stop();
          volumeBotService = null;
          logger?.info("[solana-trading] Volume bot service stopped");
        },
      });
    }

    if (config.copyTrading?.enabled) {
      api.registerService({
        id: "solana-trading-copy-trading",
        async start() {
          const ctx = await createServiceContext();
          copyTradingService = new CopyTradingService({
            ...ctx,
            copyConfig: {
              enabled: true,
              defaultMultiplier: 1,
              maxTradeAmount: config!.copyTrading?.maxTradeAmount,
            },
          });
          await copyTradingService.start();
          logger?.info("[solana-trading] Copy trading service started");
        },
        async stop() {
          await copyTradingService?.stop();
          copyTradingService = null;
          logger?.info("[solana-trading] Copy trading service stopped");
        },
      });
    }

    // Initialize Bags service for token launches
    // Read from config or env vars
    const bagsApiKey = config.bags?.apiKey || process.env.BAGS_API_KEY;
    const bagsConfigKey = config.bags?.partnerConfigKey || process.env.BAGS_CONFIG_KEY;
    const bagsRefCode = process.env.BAGS_REF_CODE;
    
    if (bagsApiKey) {
      const ctx = await createServiceContext();
      bagsService = new BagsService({
        ...ctx,
        bagsConfig: {
          apiKey: bagsApiKey,
          partnerConfigKey: bagsConfigKey,
          refCode: bagsRefCode,
        },
      });
      setBagsService(bagsService);
      logger?.info("[solana-trading] Bags.fm service initialized");
      if (bagsRefCode) {
        logger?.info(`[solana-trading] Bags referral: ${bagsRefCode}`);
      }

      // Initialize BagsSDKService for official SDK integration
      bagsSDKService = new BagsSDKService({
        ...ctx,
        bagsConfig: {
          apiKey: bagsApiKey,
          partnerConfigKey: bagsConfigKey,
          refCode: bagsRefCode,
          rpcUrl,
        },
      });

      // Set wallet if configured
      if (wallet) {
        try {
          bagsSDKService.setWallet(wallet.privateKey);
          logger?.info("[solana-trading] BagsSDK wallet configured");
        } catch (err) {
          logger?.warn(`[solana-trading] Failed to set BagsSDK wallet: ${err}`);
        }
      }

      // Register BagsSDK tools
      const { createBagsTools } = await import('./tools/bags-tools.js');
      const bagsTools = createBagsTools(bagsSDKService, {});
      for (const [, tool] of Object.entries(bagsTools)) {
        api.registerTool(tool);
      }
      logger?.info("[solana-trading] BagsSDK tools registered: bags_launch_token, bags_buy_token, bags_sell_token, bags_get_quote, bags_get_balance, bags_get_token_balance");

      // Initialize BagsAgentService for comprehensive API v2 coverage
      bagsAgentService = new BagsAgentService({
        ...ctx,
        bagsConfig: {
          apiKey: bagsApiKey,
          partnerConfigKey: bagsConfigKey,
          refCode: bagsRefCode,
          rpcUrl,
        },
      });

      // Set wallet if configured
      if (wallet) {
        try {
          bagsAgentService.setWallet(wallet.privateKey);
          logger?.info("[solana-trading] BagsAgent wallet configured");
        } catch (err) {
          logger?.warn(`[solana-trading] Failed to set BagsAgent wallet: ${err}`);
        }
      }

      // Register BagsAgent tools (comprehensive API v2 endpoints)
      const { createBagsAgentTools } = await import('./tools/bags-agent-tools.js');
      const bagsAgentTools = createBagsAgentTools(bagsAgentService);
      for (const [, tool] of Object.entries(bagsAgentTools)) {
        api.registerTool(tool);
      }
      logger?.info("[solana-trading] BagsAgent tools registered (18 tools): health, launch, fee_share, analytics, claiming, swap, partner");

      // Initialize MawdBotLauncher for complete autonomous token launches
      try {
        const { MawdBotLauncher } = await import('./services/mawdbot-launcher.js');
        mawdBotLauncher = new MawdBotLauncher(undefined, logger!);
        
        // Register MawdBot tools
        const { createMawdBotTools } = await import('./tools/mawdbot-tools.js');
        const mawdBotTools = createMawdBotTools(mawdBotLauncher);
        for (const [, tool] of Object.entries(mawdBotTools)) {
          api.registerTool(tool);
        }
        logger?.info("[solana-trading] MawdBot launcher initialized with complete token launch tools");
        logger?.info("[solana-trading] MawdBot tools: mawdbot_launch_token, mawdbot_swap, mawdbot_claim_all_fees, mawdbot_claim_token_fees, mawdbot_create_partner, mawdbot_health, mawdbot_balance");
      } catch (err) {
        logger?.warn(`[solana-trading] MawdBot launcher not available: ${err}`);
      }
    }

    // Register gateway methods for UI integration
    api.registerGatewayMethod("trading.status", async () => {
      return {
        initialized,
        services: {
          walletTracker: walletTracker !== null,
          sniper: sniperService !== null,
          volumeBot: volumeBotService !== null,
          copyTrading: copyTradingService !== null,
          bags: bagsService !== null,
          bagsSDK: bagsSDKService !== null,
          bagsAgent: bagsAgentService !== null,
        },
        stats: {
          trackedWallets: walletTracker?.getTrackedAddresses().length ?? 0,
          activeSnipes: sniperService?.getActiveSnipeCount() ?? 0,
          activeVolumeTasks: volumeBotService?.getActiveTaskCount() ?? 0,
          monitoredCopyWallets: copyTradingService?.getMonitoredWallets().length ?? 0,
        },
      };
    });

    api.registerGatewayMethod("trading.trackedWallets", async () => {
      return walletTracker?.getTrackedAddresses() ?? [];
    });

    api.registerGatewayMethod("trading.copyWallets", async () => {
      return copyTradingService?.getMonitoredWallets() ?? [];
    });

    api.registerGatewayMethod("trading.wallet", async () => {
      const w = getTradingWallet();
      if (!w) return { configured: false };
      return {
        configured: true,
        publicKey: w.publicKey,
        // Never expose private key via gateway!
      };
    });

    api.registerGatewayMethod("trading.rpc", async () => {
      return {
        url: rpcUrl.replace(/api-key=[^&]+/, "api-key=***"),
      };
    });

    // Birdeye API status
    api.registerGatewayMethod("trading.birdeye", async () => {
      const apiKey = process.env.BIRDEYE_API_KEY;
      const wssUrl = process.env.BIRDEYE_WSS_URL;
      return {
        configured: !!apiKey,
        hasApiKey: !!apiKey,
        hasWssUrl: !!wssUrl,
        features: {
          tokenAnalysis: !!apiKey,
          ohlcvCharts: !!apiKey,
          priceAlerts: !!apiKey && !!wssUrl,
          newListingAlerts: !!apiKey && !!wssUrl,
          whaleAlerts: !!apiKey && !!wssUrl,
          walletTracking: !!apiKey && !!wssUrl,
        },
      };
    });

    logger?.info("[solana-trading] Plugin registered with tools and services");
    if (process.env.BIRDEYE_API_KEY) {
      logger?.info("[solana-trading] Birdeye API enabled - token analysis and alerts available");
    }
  },

  async deactivate() {
    // Stop all services
    await walletTracker?.stop();
    await sniperService?.stop();
    await volumeBotService?.stop();
    await copyTradingService?.stop();

    // Disconnect Birdeye WebSocket
    if (birdeyeWebSocket) {
      birdeyeWebSocket.disconnect();
      birdeyeWebSocket = null;
    }

    walletTracker = null;
    sniperService = null;
    volumeBotService = null;
    copyTradingService = null;
    bagsService = null;

    await closeDatabase();
    initialized = false;
    db = null;
    logger?.info("[solana-trading] Plugin deactivated");
  },

  // Expose services for external access
  getServices() {
    return {
      walletTracker,
      sniperService,
      volumeBotService,
      copyTradingService,
      bagsService,
      bagsSDKService,
      bagsAgentService,
      birdeyeWebSocket,
    };
  },
};

export default plugin;
