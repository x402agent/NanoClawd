/**
 * Financial Datasets API Service
 * Provides access to stocks, crypto, macro data, SEC filings, and news
 */

const BASE_URL = 'https://api.financialdatasets.ai';

export interface FinancialDatasetsConfig {
  apiKey: string;
}

export interface Price {
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  time: string;
  time_milliseconds?: number;
}

export interface CompanyFacts {
  ticker: string;
  name: string;
  cik: string;
  industry: string;
  sector: string;
  category: string;
  exchange: string;
  is_active: boolean;
  listing_date: string;
  location: string;
  market_cap: number;
  number_of_employees: number;
  sec_filings_url: string;
  sic_code: string;
  sic_industry: string;
  sic_sector: string;
  website_url: string;
  weighted_average_shares: number;
}

export interface FinancialMetric {
  ticker: string;
  period: string;
  fiscal_period: string;
  market_cap?: number;
  enterprise_value?: number;
  pe_ratio?: number;
  price_to_book?: number;
  price_to_sales?: number;
  ev_to_ebitda?: number;
  ev_to_revenue?: number;
  debt_to_equity?: number;
  current_ratio?: number;
  quick_ratio?: number;
  roe?: number;
  roa?: number;
  gross_margin?: number;
  operating_margin?: number;
  net_margin?: number;
  revenue_growth?: number;
  earnings_growth?: number;
  dividend_yield?: number;
  payout_ratio?: number;
}

export interface FinancialStatement {
  ticker: string;
  period: string;
  fiscal_period: string;
  [key: string]: unknown;
}

export interface SECFiling {
  ticker: string;
  cik: string;
  form_type: string;
  filed_date: string;
  period_of_report: string;
  accession_number: string;
  primary_document: string;
  primary_document_url: string;
  items_url?: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
  ticker?: string;
  sentiment?: string;
}

export interface AnalystEstimate {
  fiscal_period: string;
  period: string;
  earnings_per_share: number;
}

export class FinancialDatasetsService {
  private apiKey: string;

  constructor(config: FinancialDatasetsConfig) {
    this.apiKey = config.apiKey;
  }

  private async request<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Financial Datasets API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  // Stock Prices
  async getStockPriceSnapshot(ticker: string): Promise<Price> {
    const data = await this.request<{ price: Price }>('/prices/snapshot', { ticker });
    return data.price;
  }

  async getStockPrices(params: {
    ticker: string;
    interval: 'day' | 'week' | 'month' | 'year';
    interval_multiplier: number;
    start_date: string;
    end_date: string;
    limit?: number;
  }): Promise<Price[]> {
    const data = await this.request<{ prices: Price[] }>('/prices', params);
    return data.prices;
  }

  // Crypto Prices
  async getCryptoPriceSnapshot(ticker: string): Promise<Price> {
    const data = await this.request<{ price: Price }>('/crypto/prices/snapshot', { ticker });
    return data.price;
  }

  async getCryptoPrices(params: {
    ticker: string;
    interval: 'day' | 'week' | 'month' | 'year';
    interval_multiplier: number;
    start_date: string;
    end_date: string;
    limit?: number;
  }): Promise<Price[]> {
    const data = await this.request<{ prices: Price[] }>('/crypto/prices', params);
    return data.prices;
  }

  async getAvailableCryptoTickers(): Promise<string[]> {
    const data = await this.request<{ tickers: string[] }>('/crypto/prices/tickers/');
    return data.tickers;
  }

  // Company Facts
  async getCompanyFacts(params: { ticker?: string; cik?: string }): Promise<CompanyFacts> {
    const data = await this.request<{ company_facts: CompanyFacts }>('/company/facts', params);
    return data.company_facts;
  }

  // Financial Metrics
  async getFinancialMetricsSnapshot(ticker: string): Promise<FinancialMetric> {
    const data = await this.request<{ financial_metrics: FinancialMetric }>('/financial-metrics/snapshot', { ticker });
    return data.financial_metrics;
  }

  async getFinancialMetrics(params: {
    ticker: string;
    period: 'annual' | 'quarterly' | 'ttm';
    limit?: number;
  }): Promise<FinancialMetric[]> {
    const data = await this.request<{ financial_metrics: FinancialMetric[] }>('/financial-metrics', params);
    return data.financial_metrics;
  }

  // Financial Statements
  async getIncomeStatement(params: {
    ticker: string;
    period: 'annual' | 'quarterly' | 'ttm';
    limit?: number;
  }): Promise<FinancialStatement[]> {
    const data = await this.request<{ income_statements: FinancialStatement[] }>('/financials/income-statements', params);
    return data.income_statements;
  }

  async getBalanceSheet(params: {
    ticker: string;
    period: 'annual' | 'quarterly';
    limit?: number;
  }): Promise<FinancialStatement[]> {
    const data = await this.request<{ balance_sheets: FinancialStatement[] }>('/financials/balance-sheets', params);
    return data.balance_sheets;
  }

  async getCashFlowStatement(params: {
    ticker: string;
    period: 'annual' | 'quarterly' | 'ttm';
    limit?: number;
  }): Promise<FinancialStatement[]> {
    const data = await this.request<{ cash_flow_statements: FinancialStatement[] }>('/financials/cash-flow-statements', params);
    return data.cash_flow_statements;
  }

  // SEC Filings
  async getFilings(params: {
    ticker?: string;
    cik?: string;
    form_type?: string;
    limit?: number;
  }): Promise<SECFiling[]> {
    const data = await this.request<{ filings: SECFiling[] }>('/filings', params);
    return data.filings;
  }

  async getFilingItems(params: {
    ticker?: string;
    cik?: string;
    accession_number: string;
    item: string;
  }): Promise<{ item: string; content: string }> {
    return this.request('/filings/items', params);
  }

  async getAvailableFilingItems(): Promise<string[]> {
    const data = await this.request<{ items: string[] }>('/filings/items/available');
    return data.items;
  }

  // News
  async getNews(params: {
    ticker?: string;
    limit?: number;
  }): Promise<NewsArticle[]> {
    const data = await this.request<{ news: NewsArticle[] }>('/news', params);
    return data.news;
  }

  // Analyst Estimates
  async getAnalystEstimates(params: {
    ticker: string;
    period?: 'annual' | 'quarterly';
  }): Promise<AnalystEstimate[]> {
    const data = await this.request<{ analyst_estimates: AnalystEstimate[] }>('/analyst-estimates', params);
    return data.analyst_estimates;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAvailableCryptoTickers();
      return true;
    } catch {
      return false;
    }
  }
}

let serviceInstance: FinancialDatasetsService | null = null;

export function createFinancialDatasetsService(config: FinancialDatasetsConfig): FinancialDatasetsService {
  serviceInstance = new FinancialDatasetsService(config);
  return serviceInstance;
}

export function getFinancialDatasetsService(): FinancialDatasetsService | null {
  return serviceInstance;
}

export function resetFinancialDatasetsService(): void {
  serviceInstance = null;
}
