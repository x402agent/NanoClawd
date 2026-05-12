/**
 * Financial Datasets Tools
 * AI-callable tools for stocks, crypto, macro data, and news
 */

import {
  getFinancialDatasetsService,
  type Price,
} from '../services/financial-datasets-service.js';

// Helper to format price data for display
function formatPrice(price: Price): string {
  return `Open: $${price.open.toFixed(2)}, Close: $${price.close.toFixed(2)}, High: $${price.high.toFixed(2)}, Low: $${price.low.toFixed(2)}, Volume: ${price.volume.toLocaleString()}`;
}

// Helper to format large numbers
function formatNumber(num: number | undefined): string {
  if (num === undefined) return 'N/A';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

// Tool type that matches what the plugin API expects
interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (params: unknown) => Promise<unknown>;
}

export const financialDatasetsTools: Record<string, Tool> = {
  // Stock Price Tools
  get_stock_price_snapshot: {
    name: 'get_stock_price_snapshot',
    description: 'Get the current real-time price snapshot for a stock ticker (e.g., AAPL, GOOGL, MSFT). Returns open, close, high, low prices and volume.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL, GOOGL, MSFT)',
        },
      },
      required: ['ticker'],
    },
    async execute(params: unknown) {
      const input = params as { ticker: string };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const price = await service.getStockPriceSnapshot(input.ticker.toUpperCase());
      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        price: formatPrice(price),
        raw: price,
      };
    },
  },

  get_stock_prices: {
    name: 'get_stock_prices',
    description: 'Get historical stock price data for a ticker over a date range. Use for price charts, backtesting, and analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        interval: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year'],
          description: 'Time interval for price data',
        },
        interval_multiplier: {
          type: 'number',
          description: 'Multiplier for interval (e.g., 1 for daily, 5 for 5-day)',
          default: 1,
        },
        start_date: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD format)',
        },
        end_date: {
          type: 'string',
          description: 'End date (YYYY-MM-DD format)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return (max 5000)',
          default: 100,
        },
      },
      required: ['ticker', 'interval', 'start_date', 'end_date'],
    },
    async execute(params: unknown) {
      const input = params as {
        ticker: string;
        interval: 'day' | 'week' | 'month' | 'year';
        interval_multiplier?: number;
        start_date: string;
        end_date: string;
        limit?: number;
      };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const prices = await service.getStockPrices({
        ticker: input.ticker.toUpperCase(),
        interval: input.interval,
        interval_multiplier: input.interval_multiplier || 1,
        start_date: input.start_date,
        end_date: input.end_date,
        limit: input.limit,
      });

      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        period: `${input.start_date} to ${input.end_date}`,
        count: prices.length,
        prices: prices.map(p => ({
          date: p.time,
          ...p,
        })),
      };
    },
  },

  // Crypto Price Tools
  get_crypto_price_snapshot: {
    name: 'get_crypto_price_snapshot',
    description: 'Get the current real-time price snapshot for a cryptocurrency (e.g., BTC-USD, ETH-USD, SOL-USD).',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Crypto ticker symbol (e.g., BTC-USD, ETH-USD, SOL-USD)',
        },
      },
      required: ['ticker'],
    },
    async execute(params: unknown) {
      const input = params as { ticker: string };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const price = await service.getCryptoPriceSnapshot(input.ticker.toUpperCase());
      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        price: formatPrice(price),
        raw: price,
      };
    },
  },

  get_crypto_prices: {
    name: 'get_crypto_prices',
    description: 'Get historical cryptocurrency price data over a date range. Data from Coinbase, Kraken, and Bitfinex.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Crypto ticker symbol (e.g., BTC-USD)',
        },
        interval: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year'],
          description: 'Time interval for price data',
        },
        interval_multiplier: {
          type: 'number',
          description: 'Multiplier for interval',
          default: 1,
        },
        start_date: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD format)',
        },
        end_date: {
          type: 'string',
          description: 'End date (YYYY-MM-DD format)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return (max 5000)',
          default: 100,
        },
      },
      required: ['ticker', 'interval', 'start_date', 'end_date'],
    },
    async execute(params: unknown) {
      const input = params as {
        ticker: string;
        interval: 'day' | 'week' | 'month' | 'year';
        interval_multiplier?: number;
        start_date: string;
        end_date: string;
        limit?: number;
      };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const prices = await service.getCryptoPrices({
        ticker: input.ticker.toUpperCase(),
        interval: input.interval,
        interval_multiplier: input.interval_multiplier || 1,
        start_date: input.start_date,
        end_date: input.end_date,
        limit: input.limit,
      });

      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        period: `${input.start_date} to ${input.end_date}`,
        count: prices.length,
        prices: prices.map(p => ({
          date: p.time,
          ...p,
        })),
      };
    },
  },

  get_available_crypto_tickers: {
    name: 'get_available_crypto_tickers',
    description: 'Get a list of all available cryptocurrency tickers that can be queried.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const tickers = await service.getAvailableCryptoTickers();
      return {
        success: true,
        count: tickers.length,
        tickers,
      };
    },
  },

  // Company Facts
  get_company_facts: {
    name: 'get_company_facts',
    description: 'Get comprehensive company facts including market cap, employees, sector, industry, listing date, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        cik: {
          type: 'string',
          description: 'SEC CIK number (alternative to ticker)',
        },
      },
    },
    async execute(params: unknown) {
      const input = params as { ticker?: string; cik?: string };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      if (!input.ticker && !input.cik) {
        throw new Error('Either ticker or cik must be provided');
      }

      const facts = await service.getCompanyFacts({
        ticker: input.ticker?.toUpperCase(),
        cik: input.cik,
      });

      return {
        success: true,
        company: {
          name: facts.name,
          ticker: facts.ticker,
          cik: facts.cik,
          exchange: facts.exchange,
          sector: facts.sector,
          industry: facts.industry,
          marketCap: formatNumber(facts.market_cap),
          employees: facts.number_of_employees?.toLocaleString(),
          isActive: facts.is_active,
          listingDate: facts.listing_date,
          location: facts.location,
          website: facts.website_url,
          secFilingsUrl: facts.sec_filings_url,
        },
        raw: facts,
      };
    },
  },

  // Financial Metrics
  get_financial_metrics_snapshot: {
    name: 'get_financial_metrics_snapshot',
    description: 'Get the most recent financial metrics snapshot including P/E ratio, market cap, margins, and valuation ratios.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
      },
      required: ['ticker'],
    },
    async execute(params: unknown) {
      const input = params as { ticker: string };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const metrics = await service.getFinancialMetricsSnapshot(input.ticker.toUpperCase());

      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        metrics: {
          marketCap: formatNumber(metrics.market_cap),
          enterpriseValue: formatNumber(metrics.enterprise_value),
          peRatio: metrics.pe_ratio?.toFixed(2),
          priceToBook: metrics.price_to_book?.toFixed(2),
          priceToSales: metrics.price_to_sales?.toFixed(2),
          evToEbitda: metrics.ev_to_ebitda?.toFixed(2),
          evToRevenue: metrics.ev_to_revenue?.toFixed(2),
          debtToEquity: metrics.debt_to_equity?.toFixed(2),
          currentRatio: metrics.current_ratio?.toFixed(2),
          quickRatio: metrics.quick_ratio?.toFixed(2),
          roe: metrics.roe ? `${(metrics.roe * 100).toFixed(2)}%` : undefined,
          roa: metrics.roa ? `${(metrics.roa * 100).toFixed(2)}%` : undefined,
          grossMargin: metrics.gross_margin ? `${(metrics.gross_margin * 100).toFixed(2)}%` : undefined,
          operatingMargin: metrics.operating_margin ? `${(metrics.operating_margin * 100).toFixed(2)}%` : undefined,
          netMargin: metrics.net_margin ? `${(metrics.net_margin * 100).toFixed(2)}%` : undefined,
          revenueGrowth: metrics.revenue_growth ? `${(metrics.revenue_growth * 100).toFixed(2)}%` : undefined,
          earningsGrowth: metrics.earnings_growth ? `${(metrics.earnings_growth * 100).toFixed(2)}%` : undefined,
          dividendYield: metrics.dividend_yield ? `${(metrics.dividend_yield * 100).toFixed(2)}%` : undefined,
        },
        raw: metrics,
      };
    },
  },

  get_financial_metrics: {
    name: 'get_financial_metrics',
    description: 'Get historical financial metrics for a company over time. Use for trend analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        period: {
          type: 'string',
          enum: ['annual', 'quarterly', 'ttm'],
          description: 'Reporting period type',
          default: 'annual',
        },
        limit: {
          type: 'number',
          description: 'Number of periods to return',
          default: 5,
        },
      },
      required: ['ticker'],
    },
    async execute(params: unknown) {
      const input = params as { ticker: string; period?: 'annual' | 'quarterly' | 'ttm'; limit?: number };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const metrics = await service.getFinancialMetrics({
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        limit: input.limit,
      });

      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        count: metrics.length,
        metrics,
      };
    },
  },

  // Financial Statements
  get_income_statement: {
    name: 'get_income_statement',
    description: 'Get historical income statement data including revenue, expenses, net income, and EPS.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        period: {
          type: 'string',
          enum: ['annual', 'quarterly', 'ttm'],
          description: 'Reporting period type',
          default: 'annual',
        },
        limit: {
          type: 'number',
          description: 'Number of statements to return',
          default: 4,
        },
      },
      required: ['ticker'],
    },
    async execute(params: unknown) {
      const input = params as { ticker: string; period?: 'annual' | 'quarterly' | 'ttm'; limit?: number };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const statements = await service.getIncomeStatement({
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        limit: input.limit,
      });

      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        count: statements.length,
        statements,
      };
    },
  },

  get_balance_sheet: {
    name: 'get_balance_sheet',
    description: 'Get historical balance sheet data including assets, liabilities, and equity.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        period: {
          type: 'string',
          enum: ['annual', 'quarterly'],
          description: 'Reporting period type',
          default: 'annual',
        },
        limit: {
          type: 'number',
          description: 'Number of statements to return',
          default: 4,
        },
      },
      required: ['ticker'],
    },
    async execute(params: unknown) {
      const input = params as { ticker: string; period?: 'annual' | 'quarterly'; limit?: number };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const statements = await service.getBalanceSheet({
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        limit: input.limit,
      });

      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        count: statements.length,
        statements,
      };
    },
  },

  get_cash_flow_statement: {
    name: 'get_cash_flow_statement',
    description: 'Get historical cash flow statement data including operating, investing, and financing activities.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        period: {
          type: 'string',
          enum: ['annual', 'quarterly', 'ttm'],
          description: 'Reporting period type',
          default: 'annual',
        },
        limit: {
          type: 'number',
          description: 'Number of statements to return',
          default: 4,
        },
      },
      required: ['ticker'],
    },
    async execute(params: unknown) {
      const input = params as { ticker: string; period?: 'annual' | 'quarterly' | 'ttm'; limit?: number };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const statements = await service.getCashFlowStatement({
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        limit: input.limit,
      });

      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        count: statements.length,
        statements,
      };
    },
  },

  // SEC Filings
  get_sec_filings: {
    name: 'get_sec_filings',
    description: 'Get a list of SEC filings (10-K, 10-Q, 8-K, etc.) for a company.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        cik: {
          type: 'string',
          description: 'SEC CIK number (alternative to ticker)',
        },
        form_type: {
          type: 'string',
          description: 'Filter by form type (e.g., 10-K, 10-Q, 8-K)',
        },
        limit: {
          type: 'number',
          description: 'Number of filings to return',
          default: 10,
        },
      },
    },
    async execute(params: unknown) {
      const input = params as { ticker?: string; cik?: string; form_type?: string; limit?: number };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const filings = await service.getFilings({
        ticker: input.ticker?.toUpperCase(),
        cik: input.cik,
        form_type: input.form_type,
        limit: input.limit,
      });

      return {
        success: true,
        count: filings.length,
        filings: filings.map(f => ({
          formType: f.form_type,
          filedDate: f.filed_date,
          periodOfReport: f.period_of_report,
          accessionNumber: f.accession_number,
          documentUrl: f.primary_document_url,
        })),
      };
    },
  },

  get_filing_items: {
    name: 'get_filing_items',
    description: 'Extract specific items from SEC filings (e.g., "Item 1A. Risk Factors" from a 10-K).',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        cik: {
          type: 'string',
          description: 'SEC CIK number (alternative to ticker)',
        },
        accession_number: {
          type: 'string',
          description: 'Filing accession number',
        },
        item: {
          type: 'string',
          description: 'Item to extract (e.g., "1A" for Risk Factors)',
        },
      },
      required: ['accession_number', 'item'],
    },
    async execute(params: unknown) {
      const input = params as { ticker?: string; cik?: string; accession_number: string; item: string };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const result = await service.getFilingItems({
        ticker: input.ticker?.toUpperCase(),
        cik: input.cik,
        accession_number: input.accession_number,
        item: input.item,
      });

      return {
        success: true,
        item: result.item,
        content: result.content,
      };
    },
  },

  get_available_filing_items: {
    name: 'get_available_filing_items',
    description: 'Get a list of all available items that can be extracted from 10-K and 10-Q filings.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const items = await service.getAvailableFilingItems();
      return {
        success: true,
        items,
      };
    },
  },

  // News
  get_financial_news: {
    name: 'get_financial_news',
    description: 'Get recent financial news articles. Can filter by ticker for company-specific news.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol to filter news (optional)',
        },
        limit: {
          type: 'number',
          description: 'Number of articles to return',
          default: 10,
        },
      },
    },
    async execute(params: unknown) {
      const input = params as { ticker?: string; limit?: number };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const news = await service.getNews({
        ticker: input.ticker?.toUpperCase(),
        limit: input.limit,
      });

      return {
        success: true,
        count: news.length,
        articles: news.map(n => ({
          title: n.title,
          description: n.description,
          source: n.source,
          publishedAt: n.published_at,
          url: n.url,
          sentiment: n.sentiment,
        })),
      };
    },
  },

  // Analyst Estimates
  get_analyst_estimates: {
    name: 'get_analyst_estimates',
    description: 'Get analyst earnings per share estimates for a company. Useful for earnings expectations and forecasts.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL)',
        },
        period: {
          type: 'string',
          enum: ['annual', 'quarterly'],
          description: 'Estimate period type',
          default: 'annual',
        },
      },
      required: ['ticker'],
    },
    async execute(params: unknown) {
      const input = params as { ticker: string; period?: 'annual' | 'quarterly' };
      const service = getFinancialDatasetsService();
      if (!service) throw new Error('Financial Datasets service not initialized');

      const estimates = await service.getAnalystEstimates({
        ticker: input.ticker.toUpperCase(),
        period: input.period,
      });

      return {
        success: true,
        ticker: input.ticker.toUpperCase(),
        period: input.period || 'annual',
        count: estimates.length,
        estimates,
      };
    },
  },
};

export function getFinancialDatasetsTools(): Tool[] {
  return Object.values(financialDatasetsTools);
}

export type FinancialDatasetsTool = (typeof financialDatasetsTools)[keyof typeof financialDatasetsTools];
