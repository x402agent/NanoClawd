/**
 * CoinGecko Pro API Types
 */

export interface CoinGeckoConfig {
  enabled: boolean;
  defaultCurrency: string;
  chartWidth: number;
  chartHeight: number;
}

export const defaultConfig: CoinGeckoConfig = {
  enabled: true,
  defaultCurrency: "usd",
  chartWidth: 60,
  chartHeight: 15,
};

export function parseConfig(value: unknown): CoinGeckoConfig {
  const input = value as Partial<CoinGeckoConfig> | undefined;
  return {
    enabled: input?.enabled ?? defaultConfig.enabled,
    defaultCurrency: input?.defaultCurrency ?? defaultConfig.defaultCurrency,
    chartWidth: input?.chartWidth ?? defaultConfig.chartWidth,
    chartHeight: input?.chartHeight ?? defaultConfig.chartHeight,
  };
}

// API Response Types

// Price data for a single coin - keys are dynamic based on requested currencies
export interface CoinPriceData {
  [key: string]: number | undefined;
}

export interface SimplePriceResponse {
  [coinId: string]: CoinPriceData;
}

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  sparkline_in_7d?: {
    price: number[];
  };
}

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  web_slug: string;
  asset_platform_id: string | null;
  platforms: Record<string, string>;
  detail_platforms: Record<string, { decimal_place: number; contract_address: string }>;
  block_time_in_minutes: number;
  hashing_algorithm: string | null;
  categories: string[];
  description: {
    en: string;
  };
  links: {
    homepage: string[];
    whitepaper: string;
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    telegram_channel_identifier: string;
    subreddit_url: string;
    repos_url: {
      github: string[];
      bitbucket: string[];
    };
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  country_origin: string;
  genesis_date: string | null;
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  watchlist_portfolio_users: number;
  market_cap_rank: number;
  market_data: {
    current_price: Record<string, number>;
    ath: Record<string, number>;
    ath_change_percentage: Record<string, number>;
    ath_date: Record<string, string>;
    atl: Record<string, number>;
    atl_change_percentage: Record<string, number>;
    atl_date: Record<string, string>;
    market_cap: Record<string, number>;
    market_cap_rank: number;
    fully_diluted_valuation: Record<string, number>;
    market_cap_fdv_ratio: number;
    total_volume: Record<string, number>;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    price_change_percentage_60d: number;
    price_change_percentage_200d: number;
    price_change_percentage_1y: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    total_supply: number;
    max_supply: number | null;
    circulating_supply: number;
    last_updated: string;
  };
  community_data: {
    twitter_followers: number;
    reddit_average_posts_48h: number;
    reddit_average_comments_48h: number;
    reddit_subscribers: number;
    reddit_accounts_active_48h: number;
  };
  developer_data: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    pull_request_contributors: number;
    commit_count_4_weeks: number;
  };
  last_updated: string;
}

export interface TrendingResponse {
  coins: Array<{
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
      small: string;
      large: string;
      slug: string;
      price_btc: number;
      score: number;
      data: {
        price: number;
        price_btc: string;
        price_change_percentage_24h: Record<string, number>;
        market_cap: string;
        market_cap_btc: string;
        total_volume: string;
        total_volume_btc: string;
        sparkline: string;
      };
    };
  }>;
  nfts: Array<{
    id: string;
    name: string;
    symbol: string;
    thumb: string;
  }>;
  categories: Array<{
    id: number;
    name: string;
    market_cap_1h_change: number;
    slug: string;
    coins_count: number;
    data: {
      market_cap: number;
      market_cap_btc: number;
      total_volume: number;
      total_volume_btc: number;
      market_cap_change_percentage_24h: Record<string, number>;
      sparkline: string;
    };
  }>;
}

export interface MarketChartResponse {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface GlobalData {
  data: {
    active_cryptocurrencies: number;
    upcoming_icos: number;
    ongoing_icos: number;
    ended_icos: number;
    markets: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
    updated_at: number;
  };
}

export interface TopGainersLosersResponse {
  top_gainers: CoinMarketData[];
  top_losers: CoinMarketData[];
}

export interface SearchResponse {
  coins: Array<{
    id: string;
    name: string;
    api_symbol: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    large: string;
  }>;
  exchanges: Array<{
    id: string;
    name: string;
    market_type: string;
    thumb: string;
    large: string;
  }>;
  categories: Array<{
    id: number;
    name: string;
  }>;
  nfts: Array<{
    id: string;
    name: string;
    symbol: string;
    thumb: string;
  }>;
}

export interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string>;
}

export interface ApiKeyInfo {
  plan: string;
  rate_limit_request_per_minute: number;
  monthly_call_credit: number;
  current_total_monthly_calls: number;
  current_remaining_monthly_calls: number;
}
