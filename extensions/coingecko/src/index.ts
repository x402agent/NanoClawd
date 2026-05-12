/**
 * CoinGecko Extension for Clawdbot
 *
 * Provides real-time cryptocurrency market data from CoinGecko Pro API.
 *
 * Features:
 * - Price lookup by coin ID, symbol, or contract address
 * - Market data with rankings, volume, and market cap
 * - ASCII price charts (line and candlestick)
 * - Trending coins and top gainers/losers
 * - Global market statistics
 * - Detailed coin information
 *
 * Configuration:
 * - Set COINGECKO_API_KEY environment variable with your Pro API key
 * - Plugin config options: defaultCurrency, chartWidth, chartHeight
 *
 * @see https://docs.coingecko.com/
 */

import type { CoinGeckoConfig } from "./types.js";
import { parseConfig, defaultConfig } from "./types.js";
import { createCoinGeckoTools } from "./tools.js";
import { resetCoinGeckoApi } from "./api.js";

// Re-export types for external use
export type { CoinGeckoConfig } from "./types.js";
export { CoinGeckoApi, getCoinGeckoApi } from "./api.js";
export {
  renderLineChart,
  renderCandlestickChart,
  renderSparkline,
  renderMarketTable,
} from "./chart.js";

interface ClawdbotPluginApi {
  id: string;
  name: string;
  version?: string;
  config: unknown;
  pluginConfig?: Record<string, unknown>;
  runtime: unknown;
  logger: {
    debug: (msg: string) => void;
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  registerTool: (
    tool: {
      name: string;
      label?: string;
      description: string;
      inputSchema: object;
      execute: (params: any) => Promise<any> | any;
    },
    opts?: { category?: string }
  ) => void;
  registerService?: (service: {
    id: string;
    start?: (ctx: unknown) => Promise<void>;
    stop?: (ctx: unknown) => Promise<void>;
  }) => void;
}

const plugin = {
  id: "coingecko",
  name: "CoinGecko",
  description:
    "Real-time cryptocurrency market data from CoinGecko Pro API with charting support",
  version: "0.1.0",

  configSchema: {
    type: "object",
    properties: {
      enabled: { type: "boolean", default: true },
      defaultCurrency: { type: "string", default: "usd" },
      chartWidth: { type: "number", default: 60 },
      chartHeight: { type: "number", default: 15 },
    },
    additionalProperties: false,
    parse: (value: unknown): CoinGeckoConfig => parseConfig(value),
    safeParse: (value: unknown) => {
      try {
        return { success: true as const, data: parseConfig(value) };
      } catch (error) {
        return { success: false as const, error };
      }
    },
  },

  register(api: ClawdbotPluginApi) {
    const config = parseConfig(api.pluginConfig || {});

    // Check for API key
    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) {
      api.logger.warn(
        "COINGECKO_API_KEY not set. CoinGecko tools will not work without a Pro API key."
      );
      api.logger.info(
        "Get your API key at https://www.coingecko.com/en/api/pricing"
      );
    } else {
      api.logger.info("CoinGecko Pro API initialized");
    }

    // Create and register tools
    const tools = createCoinGeckoTools({
      config,
      logger: api.logger,
    });

    for (const tool of tools) {
      api.registerTool(tool, { category: "crypto" });
    }

    api.logger.debug(`Registered ${tools.length} CoinGecko tools`);

    // Register cleanup service
    if (api.registerService) {
      api.registerService({
        id: "coingecko-cleanup",
        stop: async () => {
          resetCoinGeckoApi();
          api.logger.debug("CoinGecko API instance cleaned up");
        },
      });
    }
  },
};

export default plugin;
