/**
 * Financial Datasets Extension for Clawdbot
 *
 * Provides access to comprehensive financial data including:
 * - Stock prices (real-time and historical)
 * - Cryptocurrency prices (from Coinbase, Kraken, Bitfinex)
 * - Company facts and fundamentals
 * - Financial statements (income, balance sheet, cash flow)
 * - SEC filings and filing item extraction
 * - Financial news
 * - Analyst estimates
 *
 * Configuration:
 * - Set FINANCIAL_DATASETS_API_KEY environment variable with your API key
 * - Get your key at https://financialdatasets.ai
 *
 * @see https://docs.financialdatasets.ai
 */

import {
  createFinancialDatasetsService,
  resetFinancialDatasetsService,
} from './services/financial-datasets-service.js';
import { getFinancialDatasetsTools } from './tools/financial-datasets-tools.js';

// Re-export types and services for external use
export {
  FinancialDatasetsService,
  getFinancialDatasetsService,
  createFinancialDatasetsService,
  type FinancialDatasetsConfig,
  type Price,
  type CompanyFacts,
  type FinancialMetric,
  type FinancialStatement,
  type SECFiling,
  type NewsArticle,
  type AnalystEstimate,
} from './services/financial-datasets-service.js';

export { getFinancialDatasetsTools } from './tools/financial-datasets-tools.js';

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
      execute: (params: unknown) => Promise<unknown> | unknown;
    },
    opts?: { category?: string }
  ) => void;
  registerService?: (service: {
    id: string;
    start?: (ctx: unknown) => Promise<void>;
    stop?: (ctx: unknown) => Promise<void>;
  }) => void;
}

export interface FinancialDatasetsPluginConfig {
  enabled?: boolean;
}

function parseConfig(value: unknown): FinancialDatasetsPluginConfig {
  if (!value || typeof value !== 'object') {
    return { enabled: true };
  }
  const config = value as Record<string, unknown>;
  return {
    enabled: config.enabled !== false,
  };
}

const plugin = {
  id: 'financial-datasets',
  name: 'Financial Datasets',
  description:
    'Comprehensive financial data API - stocks, crypto, SEC filings, financial statements, and news',
  version: '0.1.0',

  configSchema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
    },
    additionalProperties: false,
    parse: (value: unknown): FinancialDatasetsPluginConfig => parseConfig(value),
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

    if (!config.enabled) {
      api.logger.info('Financial Datasets plugin is disabled');
      return;
    }

    // Check for API key
    const apiKey = process.env.FINANCIAL_DATASETS_API_KEY;
    if (!apiKey) {
      api.logger.warn(
        'FINANCIAL_DATASETS_API_KEY not set. Financial Datasets tools will not work without an API key.'
      );
      api.logger.info('Get your API key at https://financialdatasets.ai');
      return;
    }

    // Initialize service
    try {
      createFinancialDatasetsService({ apiKey });
      api.logger.info('Financial Datasets API initialized');
    } catch (error) {
      api.logger.error(`Failed to initialize Financial Datasets service: ${error}`);
      return;
    }

    // Create and register tools
    const tools = getFinancialDatasetsTools();

    for (const tool of tools) {
      api.registerTool(tool, { category: 'financial' });
    }

    api.logger.debug(`Registered ${tools.length} Financial Datasets tools`);
    api.logger.info(
      'Available tools: stock prices, crypto prices, company facts, financial statements, SEC filings, news, analyst estimates'
    );

    // Register cleanup service
    if (api.registerService) {
      api.registerService({
        id: 'financial-datasets-cleanup',
        stop: async () => {
          resetFinancialDatasetsService();
          api.logger.debug('Financial Datasets service cleaned up');
        },
      });
    }
  },
};

export default plugin;
