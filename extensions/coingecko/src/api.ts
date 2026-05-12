/**
 * CoinGecko Pro API Client
 *
 * Uses the Pro API endpoint with x-cg-pro-api-key header authentication.
 * API key is read from COINGECKO_API_KEY environment variable.
 */

import type {
  SimplePriceResponse,
  CoinMarketData,
  CoinDetail,
  TrendingResponse,
  MarketChartResponse,
  OHLCData,
  GlobalData,
  TopGainersLosersResponse,
  SearchResponse,
  CoinListItem,
  ApiKeyInfo,
} from "./types.js";

const PRO_API_BASE = "https://pro-api.coingecko.com/api/v3";

export interface CoinGeckoApiOptions {
  apiKey?: string;
  logger?: { debug: (msg: string) => void; error: (msg: string) => void };
}

export class CoinGeckoApi {
  private apiKey: string;
  private logger?: CoinGeckoApiOptions["logger"];

  constructor(options: CoinGeckoApiOptions = {}) {
    this.apiKey = options.apiKey || process.env.COINGECKO_API_KEY || "";
    this.logger = options.logger;

    if (!this.apiKey) {
      this.logger?.error(
        "COINGECKO_API_KEY not set. CoinGecko Pro API features will not work."
      );
    }
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error(
        "CoinGecko API key not configured. Set COINGECKO_API_KEY environment variable."
      );
    }

    const url = new URL(`${PRO_API_BASE}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    this.logger?.debug(`CoinGecko API request: ${url.pathname}`);

    const response = await fetch(url.toString(), {
      headers: {
        "x-cg-pro-api-key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `CoinGecko API error (${response.status}): ${errorText}`
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Check API server status
   */
  async ping(): Promise<{ gecko_says: string }> {
    return this.request<{ gecko_says: string }>("/ping");
  }

  /**
   * Check API key usage and limits
   */
  async getApiUsage(): Promise<ApiKeyInfo> {
    return this.request<ApiKeyInfo>("/key");
  }

  /**
   * Get simple price for one or more coins
   */
  async getSimplePrice(options: {
    ids: string[];
    vsCurrencies: string[];
    includeMarketCap?: boolean;
    include24hrVol?: boolean;
    include24hrChange?: boolean;
    includeLastUpdatedAt?: boolean;
    precision?: string;
  }): Promise<SimplePriceResponse> {
    return this.request<SimplePriceResponse>("/simple/price", {
      ids: options.ids.join(","),
      vs_currencies: options.vsCurrencies.join(","),
      include_market_cap: options.includeMarketCap,
      include_24hr_vol: options.include24hrVol,
      include_24hr_change: options.include24hrChange,
      include_last_updated_at: options.includeLastUpdatedAt,
      precision: options.precision,
    });
  }

  /**
   * Get token price by contract address
   */
  async getTokenPrice(options: {
    platform: string;
    contractAddresses: string[];
    vsCurrencies: string[];
    includeMarketCap?: boolean;
    include24hrVol?: boolean;
    include24hrChange?: boolean;
    includeLastUpdatedAt?: boolean;
    precision?: string;
  }): Promise<SimplePriceResponse> {
    return this.request<SimplePriceResponse>(
      `/simple/token_price/${options.platform}`,
      {
        contract_addresses: options.contractAddresses.join(","),
        vs_currencies: options.vsCurrencies.join(","),
        include_market_cap: options.includeMarketCap,
        include_24hr_vol: options.include24hrVol,
        include_24hr_change: options.include24hrChange,
        include_last_updated_at: options.includeLastUpdatedAt,
        precision: options.precision,
      }
    );
  }

  /**
   * Get supported vs currencies
   */
  async getSupportedCurrencies(): Promise<string[]> {
    return this.request<string[]>("/simple/supported_vs_currencies");
  }

  /**
   * Get list of all coins
   */
  async getCoinsList(includePlatform = false): Promise<CoinListItem[]> {
    return this.request<CoinListItem[]>("/coins/list", {
      include_platform: includePlatform,
    });
  }

  /**
   * Get coins market data
   */
  async getCoinsMarkets(options: {
    vsCurrency: string;
    ids?: string[];
    category?: string;
    order?:
      | "market_cap_desc"
      | "market_cap_asc"
      | "volume_desc"
      | "volume_asc"
      | "id_desc"
      | "id_asc";
    perPage?: number;
    page?: number;
    sparkline?: boolean;
    priceChangePercentage?: string;
  }): Promise<CoinMarketData[]> {
    return this.request<CoinMarketData[]>("/coins/markets", {
      vs_currency: options.vsCurrency,
      ids: options.ids?.join(","),
      category: options.category,
      order: options.order,
      per_page: options.perPage,
      page: options.page,
      sparkline: options.sparkline,
      price_change_percentage: options.priceChangePercentage,
    });
  }

  /**
   * Get coin details by ID
   */
  async getCoinById(
    id: string,
    options?: {
      localization?: boolean;
      tickers?: boolean;
      marketData?: boolean;
      communityData?: boolean;
      developerData?: boolean;
      sparkline?: boolean;
    }
  ): Promise<CoinDetail> {
    return this.request<CoinDetail>(`/coins/${id}`, {
      localization: options?.localization ?? false,
      tickers: options?.tickers ?? false,
      market_data: options?.marketData ?? true,
      community_data: options?.communityData ?? false,
      developer_data: options?.developerData ?? false,
      sparkline: options?.sparkline ?? false,
    });
  }

  /**
   * Get coin market chart data
   */
  async getCoinMarketChart(options: {
    id: string;
    vsCurrency: string;
    days: number | "max";
    interval?: "daily" | "hourly";
    precision?: string;
  }): Promise<MarketChartResponse> {
    return this.request<MarketChartResponse>(
      `/coins/${options.id}/market_chart`,
      {
        vs_currency: options.vsCurrency,
        days: options.days,
        interval: options.interval,
        precision: options.precision,
      }
    );
  }

  /**
   * Get coin OHLC data
   */
  async getCoinOHLC(options: {
    id: string;
    vsCurrency: string;
    days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | "max";
    precision?: string;
  }): Promise<OHLCData[]> {
    const rawData = await this.request<number[][]>(
      `/coins/${options.id}/ohlc`,
      {
        vs_currency: options.vsCurrency,
        days: options.days,
        precision: options.precision,
      }
    );

    // Transform [timestamp, open, high, low, close] arrays to objects
    return rawData.map((item) => ({
      timestamp: item[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
    }));
  }

  /**
   * Get trending coins
   */
  async getTrending(): Promise<TrendingResponse> {
    return this.request<TrendingResponse>("/search/trending");
  }

  /**
   * Get top gainers and losers (Analyst plan required)
   */
  async getTopGainersLosers(options?: {
    vsCurrency?: string;
    duration?: "1h" | "24h" | "7d" | "14d" | "30d" | "60d" | "1y";
    topCoins?: "300" | "500" | "1000" | "all";
  }): Promise<TopGainersLosersResponse> {
    return this.request<TopGainersLosersResponse>("/coins/top_gainers_losers", {
      vs_currency: options?.vsCurrency ?? "usd",
      duration: options?.duration ?? "24h",
      top_coins: options?.topCoins ?? "1000",
    });
  }

  /**
   * Search for coins, categories, and markets
   */
  async search(query: string): Promise<SearchResponse> {
    return this.request<SearchResponse>("/search", { query });
  }

  /**
   * Get global cryptocurrency data
   */
  async getGlobal(): Promise<GlobalData> {
    return this.request<GlobalData>("/global");
  }

  /**
   * Get global DeFi data
   */
  async getGlobalDefi(): Promise<{
    data: {
      defi_market_cap: string;
      eth_market_cap: string;
      defi_to_eth_ratio: string;
      trading_volume_24h: string;
      defi_dominance: string;
      top_coin_name: string;
      top_coin_defi_dominance: number;
    };
  }> {
    return this.request("/global/decentralized_finance_defi");
  }

  /**
   * Get asset platforms (blockchain networks)
   */
  async getAssetPlatforms(): Promise<
    Array<{
      id: string;
      chain_identifier: number | null;
      name: string;
      shortname: string;
      native_coin_id: string;
    }>
  > {
    return this.request("/asset_platforms");
  }

  /**
   * Get BTC exchange rates
   */
  async getExchangeRates(): Promise<{
    rates: Record<
      string,
      {
        name: string;
        unit: string;
        value: number;
        type: "crypto" | "fiat" | "commodity";
      }
    >;
  }> {
    return this.request("/exchange_rates");
  }
}

// Singleton instance
let apiInstance: CoinGeckoApi | null = null;

export function getCoinGeckoApi(options?: CoinGeckoApiOptions): CoinGeckoApi {
  if (!apiInstance) {
    apiInstance = new CoinGeckoApi(options);
  }
  return apiInstance;
}

export function resetCoinGeckoApi(): void {
  apiInstance = null;
}
