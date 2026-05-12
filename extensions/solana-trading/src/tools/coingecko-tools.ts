/**
 * CoinGecko Tools
 *
 * Tools for fetching token data from CoinGecko's Solana Onchain API:
 * - OHLCV chart data
 * - Token prices
 * - Pool information
 */

import type { ToolDependencies } from './index.js';

// CoinGecko API configuration
const COINGECKO_DEMO_URL = 'https://api.coingecko.com/api/v3/onchain';
const COINGECKO_PRO_URL = 'https://pro-api.coingecko.com/api/v3/onchain';
const SOLANA_NETWORK = 'solana';

interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Simple rate limiter
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2100; // ~30 requests per minute for demo API

async function rateLimitedFetch(url: string, headers: Record<string, string>): Promise<Response> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLast));
  }
  lastRequestTime = Date.now();
  return fetch(url, { headers });
}

export function createCoinGeckoTools(deps: ToolDependencies): any[] {
  const apiKey = process.env.COINGECKO_API_KEY;
  const isPro = process.env.COINGECKO_API_TYPE === 'pro';
  const baseUrl = isPro ? COINGECKO_PRO_URL : COINGECKO_DEMO_URL;
  const headerKey = isPro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key';

  if (!apiKey) {
    deps.logger.warn('[CoinGecko] No API key configured, tools will not be available');
    return [];
  }

  const fetchApi = async <T>(endpoint: string, params?: Record<string, string>): Promise<T> => {
    const url = new URL(`${baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await rateLimitedFetch(url.toString(), {
      [headerKey]: apiKey,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CoinGecko API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  };

  return [
    // =========================================================================
    // OHLCV CHART DATA
    // =========================================================================
    {
      name: 'get_coingecko_chart',
      description: `Get OHLCV candlestick chart data from CoinGecko for a Solana token or pool.
Returns open, high, low, close, and volume for each candle.
Supports multiple timeframes: minute (1m, 5m, 15m), hour (1h, 4h), day.`,
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Solana token mint address or pool address',
          },
          timeframe: {
            type: 'string',
            description: 'Chart timeframe: minute, hour, or day',
            default: 'hour',
          },
          aggregate: {
            type: 'number',
            description: 'Aggregation period (e.g., 5 for 5-minute candles when timeframe=minute)',
            default: 1,
          },
          limit: {
            type: 'number',
            description: 'Number of candles to return (max 1000)',
            default: 100,
          },
        },
        required: ['address'],
      },
      async execute({
        address,
        timeframe = 'hour',
        aggregate = 1,
        limit = 100,
      }: {
        address: string;
        timeframe?: string;
        aggregate?: number;
        limit?: number;
      }) {
        deps.logger.info(`[CoinGecko] Fetching OHLCV chart: ${address} (${timeframe})`);

        // Try pool endpoint first, then token endpoint
        let data: any;
        let endpoint = 'pool';
        try {
          data = await fetchApi<any>(
            `/networks/${SOLANA_NETWORK}/pools/${address}/ohlcv/${timeframe}`,
            {
              aggregate: aggregate.toString(),
              limit: Math.min(limit, 1000).toString(),
              currency: 'usd',
            }
          );
        } catch {
          // Fall back to token endpoint
          endpoint = 'token';
          try {
            data = await fetchApi<any>(
              `/networks/${SOLANA_NETWORK}/tokens/${address}/ohlcv/${timeframe}`,
              {
                aggregate: aggregate.toString(),
                limit: Math.min(limit, 1000).toString(),
                currency: 'usd',
              }
            );
          } catch (err: any) {
            return {
              success: false,
              error: `Failed to fetch OHLCV data: ${err.message}`,
            };
          }
        }

        const ohlcvList = data.data?.attributes?.ohlcv_list || [];
        if (ohlcvList.length === 0) {
          return {
            success: false,
            error: 'No chart data available for this address',
          };
        }

        // Convert to standard candle format
        const candles: OHLCVCandle[] = ohlcvList.map((c: number[]) => ({
          timestamp: c[0],
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5],
        }));

        // Calculate summary stats
        const first = candles[0];
        const last = candles[candles.length - 1];
        const high = Math.max(...candles.map((c) => c.high));
        const low = Math.min(...candles.map((c) => c.low));
        const change = ((last.close - first.open) / first.open) * 100;
        const totalVolume = candles.reduce((sum, c) => sum + c.volume, 0);

        // Format timeframe string
        const timeframeStr =
          timeframe === 'minute' && aggregate > 1
            ? `${aggregate}m`
            : timeframe === 'hour' && aggregate > 1
              ? `${aggregate}h`
              : timeframe === 'minute'
                ? '1m'
                : timeframe === 'hour'
                  ? '1h'
                  : '1d';

        return {
          success: true,
          address,
          source: 'coingecko',
          endpoint,
          timeframe: timeframeStr,
          candleCount: candles.length,
          summary: {
            open: first.open,
            high,
            low,
            close: last.close,
            change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
            totalVolume: `$${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
          },
          // Chart format for UI rendering (extractChartData will pick this up)
          chart: {
            timeframe: timeframeStr,
            candles: candles.map((c) => ({
              time: new Date(c.timestamp * 1000).toISOString(),
              o: c.open,
              h: c.high,
              l: c.low,
              c: c.close,
              v: c.volume,
            })),
            summary: {
              open: first.open,
              high,
              low,
              close: last.close,
              change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
              totalVolume: `$${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
            },
          },
        };
      },
    },

    // =========================================================================
    // TOKEN PRICE
    // =========================================================================
    {
      name: 'get_coingecko_price',
      description: 'Get current price and market data for a Solana token from CoinGecko.',
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Solana token mint address',
          },
        },
        required: ['address'],
      },
      async execute({ address }: { address: string }) {
        deps.logger.info(`[CoinGecko] Fetching token price: ${address}`);

        try {
          const data = await fetchApi<any>(
            `/simple/networks/${SOLANA_NETWORK}/token_price/${address}`,
            {
              include_market_cap: 'true',
              include_24hr_vol: 'true',
              include_24hr_change: 'true',
            }
          );

          const tokenData = data.data?.attributes || {};

          return {
            success: true,
            address,
            price: tokenData.token_prices?.[address] || 0,
            marketCap: tokenData.market_caps?.[address] || null,
            volume24h: tokenData.total_volumes?.[address] || 0,
            priceChange24h: tokenData.price_change_24h?.[address] || 0,
          };
        } catch (err: any) {
          return {
            success: false,
            error: `Failed to fetch price: ${err.message}`,
          };
        }
      },
    },

    // =========================================================================
    // TRENDING POOLS
    // =========================================================================
    {
      name: 'get_coingecko_trending',
      description: 'Get trending Solana pools from CoinGecko sorted by volume or transactions.',
      inputSchema: {
        type: 'object',
        properties: {
          duration: {
            type: 'string',
            description: 'Trending duration: 5m, 1h, 6h, 24h',
            default: '24h',
          },
          limit: {
            type: 'number',
            description: 'Number of pools to return',
            default: 10,
          },
        },
        required: [],
      },
      async execute({ duration = '24h', limit = 10 }: { duration?: string; limit?: number }) {
        deps.logger.info(`[CoinGecko] Fetching trending pools: ${duration}`);

        try {
          const data = await fetchApi<any>(`/networks/${SOLANA_NETWORK}/trending_pools`, {
            duration,
            page: '1',
          });

          const pools = (data.data || []).slice(0, limit).map((item: any) => ({
            address: item.id,
            name: item.attributes.name,
            dex: item.relationships?.dex?.data?.id || 'unknown',
            priceUsd: parseFloat(item.attributes.base_token_price_usd || '0'),
            priceChange24h: parseFloat(item.attributes.price_change_percentage?.h24 || '0'),
            volume24h: parseFloat(item.attributes.volume_usd?.h24 || '0'),
            liquidityUsd: parseFloat(item.attributes.reserve_in_usd || '0'),
          }));

          return {
            success: true,
            duration,
            count: pools.length,
            pools,
          };
        } catch (err: any) {
          return {
            success: false,
            error: `Failed to fetch trending pools: ${err.message}`,
          };
        }
      },
    },
  ];
}
