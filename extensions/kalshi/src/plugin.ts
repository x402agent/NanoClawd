import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { config } from 'dotenv';

import { ClawdbotPlugin, PluginContext, Logger, KalshiConfig } from './types/index.js';
import { KalshiService } from './services/kalshi-service.js';
import { createTradingTools } from './tools/trading-tools.js';
import { createMarketTools } from './tools/market-tools.js';

// Load .env from extension directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

let kalshiService: KalshiService | null = null;
let logger: Logger | null = null;

/**
 * Load private key from file or environment variable
 */
function loadPrivateKey(): string {
  // Try file path first (preferred for multiline keys)
  const keyFilePath = process.env.KALSHI_PRIVATE_KEY_FILE_PATH;
  if (keyFilePath) {
    try {
      return readFileSync(keyFilePath, 'utf-8').trim();
    } catch {
      // Fall through to env var
    }
  }
  // Fall back to env var
  return process.env.KALSHI_PRIVATE_KEY || '';
}

/**
 * Kalshi Prediction Market Plugin for Clawdbot
 * Provides access to prediction markets, trading, and market data
 */
export const plugin: ClawdbotPlugin = {
  name: 'kalshi',
  version: '1.0.0',
  description: 'Kalshi prediction market integration - browse markets, trade, and analyze predictions',

  async activate(context: PluginContext) {
    logger = context.logger;
    logger.info('[kalshi] Activating Kalshi extension');

    // Get configuration from environment variables
    // Support both KALSHI_API_KEY and KALSHI_API_KEY_ID
    const kalshiConfig: KalshiConfig = {
      apiKey: process.env.KALSHI_API_KEY || process.env.KALSHI_API_KEY_ID || '',
      privateKey: loadPrivateKey(),
      baseUrl: process.env.KALSHI_BASE_URL,
    };

    // Validate configuration - fail gracefully if not configured
    if (!kalshiConfig.apiKey || !kalshiConfig.privateKey) {
      logger.warn('[kalshi] Missing required configuration:');
      if (!kalshiConfig.apiKey) logger.warn('  - KALSHI_API_KEY or KALSHI_API_KEY_ID');
      if (!kalshiConfig.privateKey) logger.warn('  - KALSHI_PRIVATE_KEY or KALSHI_PRIVATE_KEY_FILE_PATH');
      logger.warn('[kalshi] Plugin disabled - configure env vars to enable');
      return;
    }

    // Initialize service
    kalshiService = new KalshiService(kalshiConfig, logger);

    // Test connectivity - fail gracefully if API unreachable
    const connected = await kalshiService.ping();
    if (!connected) {
      logger.warn('[kalshi] Failed to connect to Kalshi API - plugin disabled');
      kalshiService = null;
      return;
    }

    logger.info('[kalshi] Connected to Kalshi API');

    // Create and register tools
    const tradingTools = createTradingTools(kalshiService);
    const marketTools = createMarketTools(kalshiService);

    const allTools = { ...tradingTools, ...marketTools };

    for (const tool of Object.values(allTools)) {
      context.registerTool(tool);
      logger.info(`[kalshi] Registered tool: ${tool.name}`);
    }

    logger.info(`[kalshi] Kalshi extension activated with ${Object.keys(allTools).length} tools`);
  },

  async deactivate() {
    logger?.info('[kalshi] Deactivating Kalshi extension');
    kalshiService = null;
    logger = null;
  },

  async getStatus() {
    if (!kalshiService || !logger) {
      return {
        enabled: false,
        message: 'Kalshi extension not active',
      };
    }

    try {
      const connected = await kalshiService.ping();
      const apiKeyId = kalshiService.getApiKeyId();

      return {
        enabled: connected,
        message: connected
          ? `Kalshi connected (API Key: ${apiKeyId.slice(0, 8)}...)`
          : 'Kalshi connection failed',
        details: {
          connected,
          apiKey: `${apiKeyId.slice(0, 8)}...${apiKeyId.slice(-4)}`,
          baseUrl: 'https://api.elections.kalshi.com/trade-api/v2',
        },
      };
    } catch (error) {
      return {
        enabled: false,
        message: `Kalshi error: ${error}`,
        details: { error: String(error) },
      };
    }
  },
};

export default plugin;
