import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

import { ClawdbotPlugin, PluginContext, Logger, HyperliquidConfig } from './types/index.js';
import { HyperliquidService } from './services/hyperliquid-service.js';
import { createTradingTools } from './tools/trading-tools.js';
import { createMarketTools } from './tools/market-tools.js';

// Load .env from extension directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

let hyperliquidService: HyperliquidService | null = null;
let logger: Logger | null = null;

/**
 * Hyperliquid DEX Plugin for Clawdbot
 * Provides perpetual and spot trading with natural language processing
 */
export const plugin: ClawdbotPlugin = {
  name: 'hyperliquid-dex',
  version: '1.0.0',
  description: 'Hyperliquid DEX trading integration - perpetuals, spot trading, market data, and analysis',

  configSchema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      walletAddress: { type: 'string', description: 'Hyperliquid wallet address' },
      privateKey: { type: 'string', description: 'Hyperliquid private key' },
      testnet: { type: 'boolean', default: false, description: 'Use testnet instead of mainnet' },
    },
    additionalProperties: false,
  },

  async activate(context: PluginContext) {
    logger = context.logger;
    logger.info('[hyperliquid-dex] Activating Hyperliquid DEX extension');

    // Get configuration from environment variables
    const config: HyperliquidConfig = {
      walletAddress: process.env.HYPERLIQUID_WALLET || '',
      privateKey: process.env.HYPERLIQUID_PRIVATE_KEY || '',
      testnet: process.env.HYPERLIQUID_TESTNET === 'true',
      enableWs: process.env.HYPERLIQUID_ENABLE_WS !== 'false',
      rpcUrl: process.env.HYPERLIQUID_RPC_URL,
      wssUrl: process.env.HYPERLIQUID_WSS_URL,
    };

    // Validate configuration - fail gracefully if not configured
    if (!config.walletAddress || !config.privateKey) {
      logger.warn('[hyperliquid-dex] Missing required configuration:');
      if (!config.walletAddress) logger.warn('  - HYPERLIQUID_WALLET');
      if (!config.privateKey) logger.warn('  - HYPERLIQUID_PRIVATE_KEY');
      logger.warn('[hyperliquid-dex] Plugin disabled - configure env vars to enable');
      return;
    }

    // Initialize service
    hyperliquidService = new HyperliquidService(config, logger);

    // Test connectivity - fail gracefully if API unreachable
    const connected = await hyperliquidService.ping();
    if (!connected) {
      logger.warn('[hyperliquid-dex] Failed to connect to Hyperliquid API - plugin disabled');
      hyperliquidService = null;
      return;
    }

    logger.info(`[hyperliquid-dex] Connected to Hyperliquid ${config.testnet ? 'Testnet' : 'Mainnet'} API`);

    // Create and register tools
    const tradingTools = createTradingTools(hyperliquidService);
    const marketTools = createMarketTools(hyperliquidService);

    const allTools = { ...tradingTools, ...marketTools };

    for (const tool of Object.values(allTools)) {
      context.registerTool(tool);
      logger.info(`[hyperliquid-dex] Registered tool: ${(tool as any).name}`);
    }

    logger.info(`[hyperliquid-dex] Hyperliquid DEX extension activated with ${Object.keys(allTools).length} tools`);
  },

  async deactivate() {
    logger?.info('[hyperliquid-dex] Deactivating Hyperliquid DEX extension');

    if (hyperliquidService) {
      hyperliquidService.destroy();
      hyperliquidService = null;
    }

    logger = null;
  },

  async getStatus() {
    if (!hyperliquidService || !logger) {
      return {
        enabled: false,
        message: 'Hyperliquid DEX extension not active'
      };
    }

    try {
      const connected = await hyperliquidService.ping();
      const walletAddress = hyperliquidService.getWalletAddress();
      const isMainnet = hyperliquidService.getIsMainnet();

      return {
        enabled: connected,
        message: connected
          ? `Hyperliquid DEX connected (${isMainnet ? 'Mainnet' : 'Testnet'}, Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)})`
          : 'Hyperliquid DEX connection failed',
        details: {
          connected,
          network: isMainnet ? 'Mainnet' : 'Testnet',
          wallet: walletAddress,
          baseUrl: isMainnet ? 'https://api.hyperliquid.xyz' : 'https://api.hyperliquid-testnet.xyz'
        }
      };
    } catch (error) {
      return {
        enabled: false,
        message: `Hyperliquid DEX error: ${error}`,
        details: { error: String(error) }
      };
    }
  }
};

export default plugin;
