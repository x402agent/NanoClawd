/**
 * Birdeye Wallet & Portfolio Service
 * Provides net worth tracking, PnL analysis, and portfolio insights
 */

export interface BirdeyeConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface WalletNetWorth {
  walletAddress: string;
  currency: string;
  totalValue: string;
  currentTimestamp: string;
  items: Array<{
    address: string;
    decimals: number;
    price: number;
    balance: string;
    amount: number;
    network: string;
    name: string;
    symbol: string;
    logoUri: string;
    value: string;
  }>;
}

export interface NetWorthChart {
  walletAddress: string;
  currency: string;
  currentTimestamp: string;
  pastTimestamp: string;
  history: Array<{
    timestamp: string;
    netWorth: number;
    netWorthChange: number;
    netWorthChangePercent: number;
  }>;
}

export interface WalletPnL {
  summary: {
    uniqueTokens: number;
    counts: {
      totalBuy: number;
      totalSell: number;
      totalTrade: number;
      totalWin: number;
      totalLoss: number;
      winRate: number;
    };
    cashflowUsd: {
      totalInvested: number;
      totalSold: number;
    };
    pnl: {
      realizedProfitUsd: number;
      realizedProfitPercent: number;
      unrealizedUsd: number;
      totalUsd: number;
      avgProfitPerTradeUsd: number;
    };
  };
}

export interface WalletPortfolio {
  items: Array<{
    address: string;
    decimals: number;
    balance: number;
    uiAmount: number;
    chainId: string;
    name: string;
    symbol: string;
    icon: string;
    logoURI: string;
    priceUsd: number;
    valueUsd: number;
  }>;
}

export class BirdeyeWalletService {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: BirdeyeConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://public-api.birdeye.so';
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'accept': 'application/json',
        'x-chain': 'solana',
        'X-API-KEY': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { success: boolean; data: any };

    if (!data.success) {
      throw new Error(`Birdeye API returned error: ${JSON.stringify(data)}`);
    }

    return data.data;
  }

  /**
   * Get current net worth and portfolio of a wallet
   */
  async getCurrentNetWorth(
    wallet: string,
    options: {
      filterValue?: number;
      sortBy?: 'value';
      sortType?: 'desc' | 'asc';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<WalletNetWorth> {
    const params = new URLSearchParams({
      wallet,
      sort_by: options.sortBy || 'value',
      sort_type: options.sortType || 'desc',
      limit: (options.limit || 20).toString(),
      offset: (options.offset || 0).toString(),
    });

    if (options.filterValue !== undefined) {
      params.append('filter_value', options.filterValue.toString());
    }

    return this.fetch<WalletNetWorth>(`/wallet/v2/current-net-worth?${params}`);
  }

  /**
   * Get historical net worth chart data
   */
  async getNetWorthChart(
    wallet: string,
    options: {
      count?: number;
      direction?: 'back' | 'forward';
      time?: string;
      type?: '1h' | '1d';
      sortType?: 'desc' | 'asc';
    } = {}
  ): Promise<NetWorthChart> {
    const params = new URLSearchParams({
      wallet,
      count: (options.count || 7).toString(),
      direction: options.direction || 'back',
      type: options.type || '1d',
      sort_type: options.sortType || 'desc',
    });

    if (options.time) {
      params.append('time', options.time);
    }

    return this.fetch<NetWorthChart>(`/wallet/v2/net-worth?${params}`);
  }

  /**
   * Get current net worth summary for multiple wallets
   */
  async getMultipleNetWorthSummary(wallets: string[]): Promise<{
    currency: string;
    currentTimestamp: string;
    wallets: Record<string, { value: string }>;
  }> {
    if (wallets.length > 100) {
      throw new Error('Maximum 100 wallets per request');
    }

    return this.fetch('/wallet/v2/net-worth-summary/multiple', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallets }),
    });
  }

  /**
   * Get asset details at a specific time
   */
  async getNetWorthDetails(
    wallet: string,
    options: {
      time?: string;
      type?: '1h' | '1d';
      sortType?: 'desc' | 'asc';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    walletAddress: string;
    currency: string;
    netWorth: number;
    requestedTimestamp: string;
    resolvedTimestamp: string;
    netAssets: Array<{
      symbol: string;
      tokenAddress: string;
      decimal: number;
      balance: string;
      price: number;
      value: number;
    }>;
  }> {
    const params = new URLSearchParams({
      wallet,
      sort_type: options.sortType || 'desc',
      limit: (options.limit || 20).toString(),
      offset: (options.offset || 0).toString(),
      type: options.type || '1d',
    });

    if (options.time) {
      params.append('time', options.time);
    }

    return this.fetch(`/wallet/v2/net-worth-details?${params}`);
  }

  /**
   * Get PnL summary for a wallet
   */
  async getPnL(
    wallet: string,
    duration: 'all' | '90d' | '30d' | '7d' | '24h' = 'all'
  ): Promise<WalletPnL> {
    const params = new URLSearchParams({ wallet, duration });
    return this.fetch<WalletPnL>(`/wallet/v2/pnl/summary?${params}`);
  }

  /**
   * Get detailed PnL broken down by token
   */
  async getPnLDetails(
    wallet: string,
    options: {
      tokenAddresses?: string[];
      sortType?: 'asc' | 'desc';
      sortBy?: 'value' | 'last_trade';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    meta: {
      address: string;
      currency: string;
      holdingCheck: boolean;
      time: string;
    };
    tokens: Array<{
      symbol: string;
      decimals: number;
      address: string;
      counts: {
        totalBuy: number;
        totalSell: number;
        totalTrade: number;
      };
      quantity: {
        totalBoughtAmount: number;
        totalSoldAmount: number;
        holding: number;
      };
      cashflowUsd: {
        costOfQuantitySold: number;
        totalInvested: number;
        totalSold: number;
        currentValue: number;
      };
      pnl: {
        realizedProfitUsd: number;
        realizedProfitPercent: number;
        unrealizedUsd: number;
        unrealizedPercent: number;
        totalUsd: number;
        totalPercent: number;
        avgProfitPerTradeUsd: number;
      };
      pricing: {
        currentPrice: number | null;
        avgBuyCost: number;
        avgSellCost: number;
      };
    }>;
  }> {
    return this.fetch('/wallet/v2/pnl/details', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        wallet,
        token_addresses: options.tokenAddresses,
        sort_type: options.sortType || 'desc',
        sort_by: options.sortBy || 'value',
        limit: options.limit || 10,
        offset: options.offset || 0,
      }),
    });
  }

  /**
   * Get wallet portfolio (beta)
   */
  async getWalletPortfolio(wallet: string): Promise<WalletPortfolio> {
    const params = new URLSearchParams({
      wallet,
      ui_amount_mode: 'scaled',
    });

    return this.fetch<WalletPortfolio>(`/v1/wallet/token_list?${params}`);
  }

  /**
   * Get transaction history (beta)
   */
  async getTransactionHistory(
    wallet: string,
    options: {
      limit?: number;
      before?: string;
    } = {}
  ): Promise<{
    solana: Array<{
      txHash: string;
      blockNumber: number;
      blockTime: string;
      status: boolean;
      from: string;
      to: string;
      fee: number;
      mainAction: string;
      balanceChange: Array<{
        amount: number;
        symbol: string;
        name: string;
        decimals: number;
        address: string;
        logoURI: string;
      }>;
    }>;
  }> {
    const params = new URLSearchParams({
      wallet,
      limit: (options.limit || 100).toString(),
      ui_amount_mode: 'scaled',
    });

    if (options.before) {
      params.append('before', options.before);
    }

    return this.fetch(`/v1/wallet/tx_list?${params}`);
  }

  /**
   * Get top traders for a token
   */
  async getTopTraders(
    tokenAddress: string,
    options: {
      timeFrame?: '24h' | '7d' | '30d';
      sortBy?: 'volume' | 'trade';
      sortType?: 'desc' | 'asc';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    items: Array<{
      tokenAddress: string;
      owner: string;
      tags: string[];
      type: string;
      volume: number;
      trade: number;
      tradeBuy: number;
      tradeSell: number;
      volumeBuy: number;
      volumeSell: number;
    }>;
  }> {
    const params = new URLSearchParams({
      address: tokenAddress,
      time_frame: options.timeFrame || '24h',
      sort_by: options.sortBy || 'volume',
      sort_type: options.sortType || 'desc',
      limit: (options.limit || 10).toString(),
      offset: (options.offset || 0).toString(),
      ui_amount_mode: 'scaled',
    });

    return this.fetch(`/defi/v2/tokens/top_traders?${params}`);
  }

  /**
   * Get top gainers/losers
   */
  async getGainersLosers(
    options: {
      type?: 'yesterday' | 'today' | '1W';
      sortBy?: 'PnL';
      sortType?: 'desc' | 'asc';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    items: Array<{
      network: string;
      address: string;
      pnl: number;
      tradeCount: number;
      volume: number;
    }>;
  }> {
    const params = new URLSearchParams({
      type: options.type || '1W',
      sort_by: options.sortBy || 'PnL',
      sort_type: options.sortType || 'desc',
      limit: (options.limit || 10).toString(),
      offset: (options.offset || 0).toString(),
    });

    return this.fetch(`/trader/gainers-losers?${params}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      // Test with a known Solana wallet
      await this.getCurrentNetWorth('So11111111111111111111111111111111111111112', { limit: 1 });
      return { ok: true, message: 'Birdeye Wallet API connected' };
    } catch (error) {
      return {
        ok: false,
        message: `Birdeye Wallet API error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Create service from environment variables
 */
export function createBirdeyeWalletServiceFromEnv(): BirdeyeWalletService {
  const apiKey = process.env.BIRDEYE_API_KEY;

  if (!apiKey) {
    throw new Error('BIRDEYE_API_KEY environment variable is required');
  }

  return new BirdeyeWalletService({ apiKey });
}
