/**
 * Birdeye API Service
 * 
 * Comprehensive token data service for:
 * - OHLCV candlestick charts
 * - Real-time price data
 * - Token metadata and market data
 * - Trade history and volume
 * - Wallet portfolio
 */

const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';

// ============================================================================
// TYPES
// ============================================================================

export interface OHLCVCandle {
  o: number;        // Open
  h: number;        // High
  l: number;        // Low
  c: number;        // Close
  v: number;        // Volume (token amount)
  v_usd?: number;   // Volume in USD
  unix_time: number;
  address: string;
  type: string;
  currency?: string;
}

export interface OHLCVResponse {
  success: boolean;
  data: {
    is_scaled_ui_token?: boolean;
    items: OHLCVCandle[];
  };
}

export interface TokenPrice {
  value: number;
  updateUnixTime: number;
  updateHumanTime?: string;
  priceChange24h?: number;
}

export interface TokenPriceVolume {
  isScaledUiToken: boolean;
  price: number;
  updateUnixTime: number;
  updateHumanTime: string;
  volumeUSD: number;
  volumeChangePercent: number;
  priceChangePercent: number;
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_uri?: string;
  extensions?: {
    coingecko_id?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    description?: string;
  };
}

export interface TokenMarketData {
  address: string;
  price: number;
  liquidity: number;
  total_supply: number;
  circulating_supply: number;
  fdv: number;
  market_cap: number;
  holder: number;
}

export interface TokenOverview {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  marketCap: number;
  fdv: number;
  liquidity: number;
  lastTradeUnixTime: number;
  lastTradeHumanTime: string;
  price: number;
  logoURI?: string;
  extensions?: {
    coingeckoId?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    description?: string;
  };
  // Price history at different timeframes
  history1mPrice?: number;
  priceChange1mPercent?: number;
  history5mPrice?: number;
  priceChange5mPercent?: number;
  history30mPrice?: number;
  priceChange30mPercent?: number;
  history1hPrice?: number;
  priceChange1hPercent?: number;
  history2hPrice?: number;
  priceChange2hPercent?: number;
  history4hPrice?: number;
  priceChange4hPercent?: number;
  history8hPrice?: number;
  priceChange8hPercent?: number;
  history24hPrice?: number;
  priceChange24hPercent?: number;
  // Volume data
  volume1hUSD?: number;
  volume4hUSD?: number;
  volume24hUSD?: number;
  volume24hChangePercent?: number;
  // Trade data
  trade24h?: number;
  trade24hChangePercent?: number;
  uniqueWallet24h?: number;
  uniqueWallet24hChangePercent?: number;
}

export interface TokenTradeData {
  address: string;
  holder: number;
  market: number;
  last_trade_unix_time: number;
  last_trade_human_time: string;
  price: number;
  // Price history
  history_1m_price?: number;
  price_change_1m_percent?: number;
  history_5m_price?: number;
  price_change_5m_percent?: number;
  history_30m_price?: number;
  price_change_30m_percent?: number;
  history_1h_price?: number;
  price_change_1h_percent?: number;
  history_24h_price?: number;
  price_change_24h_percent?: number;
  // Volume
  volume_1h_usd?: number;
  volume_4h_usd?: number;
  volume_24h_usd?: number;
  volume_24h_change_percent?: number;
  // Unique wallets
  unique_wallet_1h?: number;
  unique_wallet_24h?: number;
  unique_wallet_24h_change_percent?: number;
}

export interface Trade {
  tx_hash: string;
  tx_type: string;
  block_unix_time: number;
  volume_usd: number;
  volume: number;
  owner: string;
  source: string;
  side?: string;
  price_pair?: number;
  from: {
    symbol: string;
    address: string;
    decimals: number;
    price: number;
    amount: string;
    ui_amount: number;
  };
  to: {
    symbol: string;
    address: string;
    decimals: number;
    price: number;
    amount: string;
    ui_amount: number;
  };
  pool_id?: string;
}

export interface WalletNetWorth {
  wallet_address: string;
  currency: string;
  total_value: string;
  current_timestamp: string;
  items: Array<{
    address: string;
    decimals: number;
    price: number;
    balance: string;
    amount: number;
    network: string;
    name: string;
    symbol: string;
    logo_uri?: string;
    value: string;
  }>;
}

export type OHLCVTimeframe = 
  | '1s' | '15s' | '30s'   // Sub-minute (V3 only)
  | '1m' | '5m' | '15m' | '30m'  // Minutes
  | '1h' | '2h' | '4h' | '8h' | '12h'  // Hours
  | '1d' | '3d' | '1w' | '1M';  // Days/weeks/months

export interface BirdeyeConfig {
  apiKey: string;
  chain?: 'solana' | 'ethereum' | 'bsc' | 'base';
}

// ============================================================================
// BIRDEYE SERVICE
// ============================================================================

export class BirdeyeService {
  private apiKey: string;
  private chain: string;
  private logger: any;

  constructor(config: BirdeyeConfig, logger?: any) {
    this.apiKey = config.apiKey;
    this.chain = config.chain || 'solana';
    this.logger = logger || console;
  }

  private async fetch<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${BIRDEYE_BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'accept': 'application/json',
        'x-chain': this.chain,
        'X-API-KEY': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Birdeye API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // =========================================================================
  // PRICE & OHLCV
  // =========================================================================

  /**
   * Get current price of a token
   */
  async getPrice(address: string): Promise<number | null> {
    try {
      const result = await this.fetch<{ success: boolean; data: { value: number } }>(
        '/defi/price',
        { address }
      );
      return result.success ? result.data.value : null;
    } catch (error) {
      this.logger.error(`[Birdeye] getPrice error: ${error}`);
      return null;
    }
  }

  /**
   * Get price with volume data
   */
  async getPriceVolume(address: string, type: '1h' | '2h' | '4h' | '8h' | '24h' = '24h'): Promise<TokenPriceVolume | null> {
    try {
      const result = await this.fetch<{ success: boolean; data: TokenPriceVolume }>(
        '/defi/price_volume/single',
        { address, type }
      );
      return result.success ? result.data : null;
    } catch (error) {
      this.logger.error(`[Birdeye] getPriceVolume error: ${error}`);
      return null;
    }
  }

  /**
   * Get OHLCV candlestick data (V3 - supports 1s, 15s, 30s intervals)
   */
  async getOHLCV(
    address: string,
    timeframe: OHLCVTimeframe,
    options: {
      timeFrom?: number;
      timeTo?: number;
      currency?: 'usd' | 'native';
      mode?: 'range' | 'count';
      countLimit?: number;
    } = {}
  ): Promise<OHLCVCandle[]> {
    try {
      // Default to last 24 hours if no time specified
      const now = Math.floor(Date.now() / 1000);
      const timeFrom = options.timeFrom || now - 86400;
      const timeTo = options.timeTo || now;

      const result = await this.fetch<OHLCVResponse>(
        '/defi/v3/ohlcv',
        {
          address,
          type: timeframe,
          time_from: timeFrom,
          time_to: timeTo,
          currency: options.currency || 'usd',
          mode: options.mode || 'range',
          count_limit: options.countLimit,
        }
      );
      return result.success ? result.data.items : [];
    } catch (error) {
      this.logger.error(`[Birdeye] getOHLCV error: ${error}`);
      return [];
    }
  }

  /**
   * Get OHLCV for a specific pair
   */
  async getPairOHLCV(
    pairAddress: string,
    timeframe: OHLCVTimeframe,
    options: {
      timeFrom?: number;
      timeTo?: number;
    } = {}
  ): Promise<OHLCVCandle[]> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = await this.fetch<OHLCVResponse>(
        '/defi/v3/ohlcv/pair',
        {
          address: pairAddress,
          type: timeframe,
          time_from: options.timeFrom || now - 86400,
          time_to: options.timeTo || now,
        }
      );
      return result.success ? result.data.items : [];
    } catch (error) {
      this.logger.error(`[Birdeye] getPairOHLCV error: ${error}`);
      return [];
    }
  }

  /**
   * Get historical price at a specific unix timestamp
   */
  async getHistoricalPrice(address: string, unixtime: number): Promise<TokenPrice | null> {
    try {
      const result = await this.fetch<{ success: boolean; data: TokenPrice }>(
        '/defi/historical_price_unix',
        { address, unixtime }
      );
      return result.success ? result.data : null;
    } catch (error) {
      this.logger.error(`[Birdeye] getHistoricalPrice error: ${error}`);
      return null;
    }
  }

  // =========================================================================
  // TOKEN STATS & METADATA
  // =========================================================================

  /**
   * Get comprehensive token overview
   */
  async getTokenOverview(address: string, frames?: string): Promise<TokenOverview | null> {
    try {
      const result = await this.fetch<{ success: boolean; data: TokenOverview }>(
        '/defi/token_overview',
        { address, frames }
      );
      return result.success ? result.data : null;
    } catch (error) {
      this.logger.error(`[Birdeye] getTokenOverview error: ${error}`);
      return null;
    }
  }

  /**
   * Get token metadata (name, symbol, logo, socials)
   */
  async getTokenMetadata(address: string): Promise<TokenMetadata | null> {
    try {
      const result = await this.fetch<{ success: boolean; data: TokenMetadata }>(
        '/defi/v3/token/meta-data/single',
        { address }
      );
      return result.success ? result.data : null;
    } catch (error) {
      this.logger.error(`[Birdeye] getTokenMetadata error: ${error}`);
      return null;
    }
  }

  /**
   * Get token market data (price, liquidity, mcap, holders)
   */
  async getTokenMarketData(address: string): Promise<TokenMarketData | null> {
    try {
      const result = await this.fetch<{ success: boolean; data: TokenMarketData }>(
        '/defi/v3/token/market-data/single',
        { address }
      );
      return result.success ? result.data : null;
    } catch (error) {
      this.logger.error(`[Birdeye] getTokenMarketData error: ${error}`);
      return null;
    }
  }

  /**
   * Get token trade data (volume, trades, unique wallets)
   */
  async getTokenTradeData(address: string, frames?: string): Promise<TokenTradeData | null> {
    try {
      const result = await this.fetch<{ success: boolean; data: TokenTradeData }>(
        '/defi/v3/token/trade-data/single',
        { address, frames }
      );
      return result.success ? result.data : null;
    } catch (error) {
      this.logger.error(`[Birdeye] getTokenTradeData error: ${error}`);
      return null;
    }
  }

  // =========================================================================
  // TRADES & TRANSACTIONS
  // =========================================================================

  /**
   * Get recent trades for a token
   */
  async getTokenTrades(
    address: string,
    options: {
      limit?: number;
      offset?: number;
      txType?: 'swap' | 'buy' | 'sell' | 'add' | 'remove' | 'all';
      owner?: string;
      beforeTime?: number;
      afterTime?: number;
    } = {}
  ): Promise<Trade[]> {
    try {
      const result = await this.fetch<{ success: boolean; data: { items: Trade[] } }>(
        '/defi/v3/token/txs',
        {
          address,
          limit: options.limit || 50,
          offset: options.offset || 0,
          tx_type: options.txType || 'swap',
          owner: options.owner,
          before_time: options.beforeTime,
          after_time: options.afterTime,
        }
      );
      return result.success ? result.data.items : [];
    } catch (error) {
      this.logger.error(`[Birdeye] getTokenTrades error: ${error}`);
      return [];
    }
  }

  /**
   * Get recent trades globally
   */
  async getRecentTrades(
    options: {
      limit?: number;
      offset?: number;
      txType?: 'swap' | 'add' | 'remove' | 'all';
    } = {}
  ): Promise<Trade[]> {
    try {
      const result = await this.fetch<{ success: boolean; data: { items: Trade[] } }>(
        '/defi/v3/txs/recent',
        {
          limit: options.limit || 100,
          offset: options.offset || 0,
          tx_type: options.txType || 'swap',
        }
      );
      return result.success ? result.data.items : [];
    } catch (error) {
      this.logger.error(`[Birdeye] getRecentTrades error: ${error}`);
      return [];
    }
  }

  // =========================================================================
  // TOKEN LISTS & DISCOVERY
  // =========================================================================

  /**
   * Get trending/top tokens
   */
  async getTokenList(
    options: {
      sortBy?: 'liquidity' | 'volume_24h_usd' | 'price_change_24h_percent' | 'market_cap';
      sortType?: 'desc' | 'asc';
      limit?: number;
      offset?: number;
      minLiquidity?: number;
      minVolume24h?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const result = await this.fetch<{ success: boolean; data: { items: any[] } }>(
        '/defi/v3/token/list',
        {
          sort_by: options.sortBy || 'volume_24h_usd',
          sort_type: options.sortType || 'desc',
          limit: options.limit || 50,
          offset: options.offset || 0,
          min_liquidity: options.minLiquidity,
          min_volume_24h_usd: options.minVolume24h,
        }
      );
      return result.success ? result.data.items : [];
    } catch (error) {
      this.logger.error(`[Birdeye] getTokenList error: ${error}`);
      return [];
    }
  }

  /**
   * Get newly listed tokens
   */
  async getNewListings(
    options: {
      limit?: number;
      timeTo?: number;
      memePlatformEnabled?: boolean;
    } = {}
  ): Promise<any[]> {
    try {
      const result = await this.fetch<{ success: boolean; data: { items: any[] } }>(
        '/defi/v2/tokens/new_listing',
        {
          limit: options.limit || 20,
          time_to: options.timeTo,
          meme_platform_enabled: options.memePlatformEnabled ?? true,
        }
      );
      return result.success ? result.data.items : [];
    } catch (error) {
      this.logger.error(`[Birdeye] getNewListings error: ${error}`);
      return [];
    }
  }

  // =========================================================================
  // WALLET
  // =========================================================================

  /**
   * Get wallet portfolio/net worth
   */
  async getWalletNetWorth(
    wallet: string,
    options: {
      limit?: number;
      offset?: number;
      filterValue?: number;
    } = {}
  ): Promise<WalletNetWorth | null> {
    try {
      const result = await this.fetch<{ success: boolean; data: WalletNetWorth }>(
        '/wallet/v2/current-net-worth',
        {
          wallet,
          limit: options.limit || 100,
          offset: options.offset || 0,
          filter_value: options.filterValue,
        }
      );
      return result.success ? result.data : null;
    } catch (error) {
      this.logger.error(`[Birdeye] getWalletNetWorth error: ${error}`);
      return null;
    }
  }

  // =========================================================================
  // COMBINED DATA HELPERS
  // =========================================================================

  /**
   * Get complete token analysis (overview + chart + trades)
   */
  async getTokenAnalysis(address: string): Promise<{
    overview: TokenOverview | null;
    metadata: TokenMetadata | null;
    marketData: TokenMarketData | null;
    tradeData: TokenTradeData | null;
    recentTrades: Trade[];
    chart1h: OHLCVCandle[];
    chart24h: OHLCVCandle[];
  }> {
    const [overview, metadata, marketData, tradeData, recentTrades, chart1h, chart24h] = await Promise.all([
      this.getTokenOverview(address),
      this.getTokenMetadata(address),
      this.getTokenMarketData(address),
      this.getTokenTradeData(address, '1h,24h'),
      this.getTokenTrades(address, { limit: 20 }),
      this.getOHLCV(address, '1m', { 
        timeFrom: Math.floor(Date.now() / 1000) - 3600,  // Last 1 hour
      }),
      this.getOHLCV(address, '15m', {
        timeFrom: Math.floor(Date.now() / 1000) - 86400,  // Last 24 hours
      }),
    ]);

    return {
      overview,
      metadata,
      marketData,
      tradeData,
      recentTrades,
      chart1h,
      chart24h,
    };
  }

  /**
   * Format token data for display
   */
  formatTokenSummary(overview: TokenOverview): string {
    const priceChange = overview.priceChange24hPercent ?? 0;
    const changeEmoji = priceChange >= 0 ? '📈' : '📉';
    const changeColor = priceChange >= 0 ? '+' : '';

    return [
      `**${overview.name}** (${overview.symbol})`,
      ``,
      `💰 **Price:** $${this.formatPrice(overview.price)}`,
      `${changeEmoji} **24h Change:** ${changeColor}${priceChange.toFixed(2)}%`,
      ``,
      `📊 **Market Data:**`,
      `  • Market Cap: $${this.formatNumber(overview.marketCap)}`,
      `  • FDV: $${this.formatNumber(overview.fdv)}`,
      `  • Liquidity: $${this.formatNumber(overview.liquidity)}`,
      ``,
      `📈 **Volume (24h):** $${this.formatNumber(overview.volume24hUSD || 0)}`,
      `👥 **Unique Wallets (24h):** ${this.formatNumber(overview.uniqueWallet24h || 0)}`,
      `🔄 **Trades (24h):** ${this.formatNumber(overview.trade24h || 0)}`,
      ``,
      overview.extensions?.website ? `🌐 ${overview.extensions.website}` : '',
      overview.extensions?.twitter ? `🐦 ${overview.extensions.twitter}` : '',
    ].filter(Boolean).join('\n');
  }

  private formatPrice(price: number): string {
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    return price.toExponential(4);
  }

  private formatNumber(num: number): string {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  }
}

// Singleton instance
let birdeyeService: BirdeyeService | null = null;

export function getBirdeyeService(): BirdeyeService | null {
  return birdeyeService;
}

export function setBirdeyeService(service: BirdeyeService): void {
  birdeyeService = service;
}

export function initBirdeyeService(apiKey: string, logger?: any): BirdeyeService {
  birdeyeService = new BirdeyeService({ apiKey }, logger);
  return birdeyeService;
}

export default BirdeyeService;
