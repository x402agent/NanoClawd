/**
 * Birdeye AI Tools
 *
 * Conversational tools for token analysis and real-time alerts:
 * - Token analysis (price, volume, metadata, holders)
 * - OHLCV chart data
 * - Price alerts
 * - New listing alerts
 * - Large trade alerts
 * - Wallet monitoring
 */

import {
  BirdeyeService,
  initBirdeyeService,
} from '../services/birdeye-service.js';
import {
  BirdeyeWebSocketService,
  getBirdeyeWebSocket,
  initBirdeyeWebSocket,
} from '../services/birdeye-websocket.js';
import { getFirstSolanaAddress } from '../utils/address-detection.js';
import type { ToolDependencies } from './index.js';

// Service instances (lazy init)
let birdeyeService: BirdeyeService | null = null;
let birdeyeWs: BirdeyeWebSocketService | null = null;

function ensureBirdeyeService(deps: ToolDependencies): BirdeyeService {
  if (!birdeyeService) {
    const apiKey = process.env.BIRDEYE_API_KEY;
    if (!apiKey) {
      throw new Error('BIRDEYE_API_KEY environment variable is required');
    }
    birdeyeService = initBirdeyeService(apiKey, deps.logger);
  }
  return birdeyeService;
}

function ensureBirdeyeWs(deps: ToolDependencies): BirdeyeWebSocketService {
  if (!birdeyeWs) {
    const apiKey = process.env.BIRDEYE_API_KEY;
    if (!apiKey) {
      throw new Error('BIRDEYE_API_KEY environment variable is required');
    }
    birdeyeWs = initBirdeyeWebSocket(apiKey, deps.logger);
  }
  return birdeyeWs;
}

export function createBirdeyeTools(deps: ToolDependencies): any[] {
  return [
    // =========================================================================
    // AUTO TOKEN LOOKUP (for when users paste addresses)
    // =========================================================================
    {
      name: 'token_lookup',
      description: `Quick token lookup when a user pastes any Solana contract address or token address.
Automatically detects Solana addresses in the input text and returns comprehensive token details including:
- Real-time price with multi-timeframe changes (5m, 1h, 4h, 24h)
- Market data (market cap, FDV, liquidity)
- Volume analysis (1h, 4h, 24h)
- Trading activity (trades, unique wallets)
- OHLCV chart data (15m candles for last 24h by default)
- Social links and metadata
- Recent trades

This tool is optimized for displaying token information in chat interfaces like Telegram.
Use this when someone pastes a contract address or asks "what is this token?"`,
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text containing a Solana token address (will auto-detect the address)',
          },
        },
        required: ['text'],
      },
      async execute({ text }: { text: string }) {
        const service = ensureBirdeyeService(deps);

        // Auto-detect Solana address from text
        const address = getFirstSolanaAddress(text.trim());

        if (!address) {
          return {
            success: false,
            error: 'No valid Solana address found in the text. Please provide a valid base58 token address.',
          };
        }

        deps.logger.info(`[Birdeye] Token lookup: ${address}`);

        const analysis = await service.getTokenAnalysis(address);

        if (!analysis.overview) {
          return {
            success: false,
            error: 'Token not found or no data available. The address may be invalid or the token may not have sufficient trading data.',
          };
        }

        const { overview, recentTrades } = analysis;

        // Format price changes across multiple timeframes
        const priceChanges: Record<string, string> = {};
        if (overview.priceChange5mPercent !== undefined) {
          priceChanges['5m'] = `${overview.priceChange5mPercent >= 0 ? '+' : ''}${overview.priceChange5mPercent.toFixed(2)}%`;
        }
        if (overview.priceChange1hPercent !== undefined) {
          priceChanges['1h'] = `${overview.priceChange1hPercent >= 0 ? '+' : ''}${overview.priceChange1hPercent.toFixed(2)}%`;
        }
        if (overview.priceChange4hPercent !== undefined) {
          priceChanges['4h'] = `${overview.priceChange4hPercent >= 0 ? '+' : ''}${overview.priceChange4hPercent.toFixed(2)}%`;
        }
        if (overview.priceChange24hPercent !== undefined) {
          priceChanges['24h'] = `${overview.priceChange24hPercent >= 0 ? '+' : ''}${overview.priceChange24hPercent.toFixed(2)}%`;
        }

        // Fetch OHLCV chart data (15m candles for last 24h)
        let chartData = null;
        try {
          const now = Math.floor(Date.now() / 1000);
          const timeFrom = now - (24 * 3600);

          const candles = await service.getOHLCV(address, '15m', {
            timeFrom,
            timeTo: now,
          });

          if (candles.length > 0) {
            const high = Math.max(...candles.map(c => c.h));
            const low = Math.min(...candles.map(c => c.l));
            const open = candles[0].o;
            const close = candles[candles.length - 1].c;
            const change = ((close - open) / open) * 100;
            const totalVolume = candles.reduce((sum, c) => sum + (c.v_usd || 0), 0);

            chartData = {
              timeframe: '15m',
              period: '24h',
              candleCount: candles.length,
              summary: {
                open,
                high,
                low,
                close,
                change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
                totalVolume: `$${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
              },
              recentCandles: candles.slice(-10).map(c => ({
                time: new Date(c.unix_time * 1000).toISOString(),
                o: c.o,
                h: c.h,
                l: c.l,
                c: c.c,
                v: c.v_usd,
              })),
            };
          }
        } catch (error: any) {
          deps.logger.warn(`[Birdeye] Failed to fetch chart data: ${error.message}`);
        }

        // Build a formatted message optimized for Telegram/chat display
        const formatted = {
          header: `🔍 **${overview.symbol}** (${overview.name})`,
          price: `💰 **$${overview.price.toFixed(overview.price < 0.01 ? 8 : 4)}**`,
          priceChanges: Object.entries(priceChanges).map(([tf, change]) => {
            const emoji = change.startsWith('+') ? '📈' : '📉';
            return `${emoji} ${tf}: ${change}`;
          }).join(' | '),
          market: [
            `📊 Market Cap: $${(overview.marketCap || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
            `💧 Liquidity: $${(overview.liquidity || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
            overview.fdv ? `🏦 FDV: $${overview.fdv.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null,
          ].filter(Boolean).join('\n'),
          volume: [
            `📦 Volume 1h: $${(overview.volume1hUSD || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
            `📦 Volume 24h: $${(overview.volume24hUSD || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
            overview.volume24hChangePercent !== undefined ? `(${overview.volume24hChangePercent >= 0 ? '+' : ''}${overview.volume24hChangePercent.toFixed(2)}%)` : '',
          ].join(' '),
          trading: [
            `🔄 Trades 24h: ${(overview.trade24h || 0).toLocaleString('en-US')}`,
            `👥 Unique Wallets: ${(overview.uniqueWallet24h || 0).toLocaleString('en-US')}`,
            overview.lastTradeHumanTime ? `⏰ Last Trade: ${overview.lastTradeHumanTime}` : null,
          ].filter(Boolean).join(' | '),
          socials: [
            overview.extensions?.website ? `🌐 [Website](${overview.extensions.website})` : null,
            overview.extensions?.twitter ? `🐦 [Twitter](${overview.extensions.twitter})` : null,
            overview.extensions?.telegram ? `💬 [Telegram](${overview.extensions.telegram})` : null,
          ].filter(Boolean).join(' | '),
          address: `📍 \`${address}\``,
        };

        const result = {
          success: true,
          address,
          token: {
            address,
            name: overview.name,
            symbol: overview.symbol,
            decimals: overview.decimals,
            logo: overview.logoURI,
          },
          price: {
            current: overview.price,
            changes: priceChanges,
          },
          market: {
            marketCap: overview.marketCap,
            fdv: overview.fdv,
            liquidity: overview.liquidity,
          },
          volume: {
            volume1h: overview.volume1hUSD,
            volume4h: overview.volume4hUSD,
            volume24h: overview.volume24hUSD,
            volume24hChange: overview.volume24hChangePercent,
          },
          trading: {
            trades24h: overview.trade24h,
            uniqueWallets24h: overview.uniqueWallet24h,
            lastTradeTime: overview.lastTradeHumanTime,
          },
          socials: {
            website: overview.extensions?.website,
            twitter: overview.extensions?.twitter,
            telegram: overview.extensions?.telegram,
            discord: overview.extensions?.discord,
            description: overview.extensions?.description,
          },
          recentTrades: recentTrades.slice(0, 3).map(t => ({
            type: t.side || t.tx_type,
            volumeUSD: t.volume_usd,
            source: t.source,
            from: `${t.from.ui_amount.toFixed(4)} ${t.from.symbol}`,
            to: `${t.to.ui_amount.toFixed(4)} ${t.to.symbol}`,
          })),
          formatted,
        };

        // Add chart data if available
        if (chartData) {
          (result as any).chart = chartData;
        }

        return result;
      },
    },

    // =========================================================================
    // TOKEN ANALYSIS
    // =========================================================================
    {
      name: 'analyze_token',
      description: `Analyze a Solana token by its mint address. Returns comprehensive data including:
- Current price with 24h change
- Market cap and FDV
- Liquidity depth
- 24h volume and trade count
- Holder count and unique wallets
- Social links (Twitter, Telegram, Website)
- Recent price history
- Real-time OHLCV chart data (15m candles for last 24h)

Use this when someone pastes a token address or asks about a specific token.`,
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Solana token mint address (base58)',
          },
          includeChart: {
            type: 'boolean',
            description: 'Include OHLCV chart data (default: true)',
            default: true,
          },
          chartTimeframe: {
            type: 'string',
            description: 'Chart timeframe: 1m, 5m, 15m, 30m, 1h, 4h (default: 15m)',
            default: '15m',
          },
          chartHours: {
            type: 'number',
            description: 'Hours of chart data (default: 24)',
            default: 24,
          },
        },
        required: ['address'],
      },
      async execute({ address, includeChart = true, chartTimeframe = '15m', chartHours = 24 }: { address: string; includeChart?: boolean; chartTimeframe?: string; chartHours?: number }) {
        const service = ensureBirdeyeService(deps);

        deps.logger.info(`[Birdeye] Analyzing token: ${address}`);

        const analysis = await service.getTokenAnalysis(address);

        if (!analysis.overview) {
          return {
            success: false,
            error: 'Token not found or no data available',
          };
        }

        const { overview, recentTrades } = analysis;

        // Format price changes
        const priceChanges: Record<string, string> = {};
        if (overview.priceChange5mPercent !== undefined) {
          priceChanges['5m'] = `${overview.priceChange5mPercent >= 0 ? '+' : ''}${overview.priceChange5mPercent.toFixed(2)}%`;
        }
        if (overview.priceChange1hPercent !== undefined) {
          priceChanges['1h'] = `${overview.priceChange1hPercent >= 0 ? '+' : ''}${overview.priceChange1hPercent.toFixed(2)}%`;
        }
        if (overview.priceChange24hPercent !== undefined) {
          priceChanges['24h'] = `${overview.priceChange24hPercent >= 0 ? '+' : ''}${overview.priceChange24hPercent.toFixed(2)}%`;
        }

        // Fetch OHLCV chart data if requested
        let chartData = null;
        if (includeChart) {
          try {
            const now = Math.floor(Date.now() / 1000);
            const timeFrom = now - (chartHours * 3600);

            const candles = await service.getOHLCV(address, chartTimeframe as any, {
              timeFrom,
              timeTo: now,
            });

            if (candles.length > 0) {
              // Calculate chart summary
              const high = Math.max(...candles.map(c => c.h));
              const low = Math.min(...candles.map(c => c.l));
              const open = candles[0].o;
              const close = candles[candles.length - 1].c;
              const change = ((close - open) / open) * 100;
              const totalVolume = candles.reduce((sum, c) => sum + (c.v_usd || 0), 0);

              chartData = {
                timeframe: chartTimeframe,
                period: `${chartHours}h`,
                candleCount: candles.length,
                summary: {
                  open,
                  high,
                  low,
                  close,
                  change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
                  totalVolume: `$${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                },
                candles: candles.map(c => ({
                  time: new Date(c.unix_time * 1000).toISOString(),
                  o: c.o,
                  h: c.h,
                  l: c.l,
                  c: c.c,
                  v: c.v_usd,
                })),
              };
            }
          } catch (error: any) {
            deps.logger.warn(`[Birdeye] Failed to fetch chart data: ${error.message}`);
          }
        }

        const result = {
          success: true,
          token: {
            address,
            name: overview.name,
            symbol: overview.symbol,
            decimals: overview.decimals,
            logo: overview.logoURI,
          },
          price: {
            current: overview.price,
            changes: priceChanges,
          },
          market: {
            marketCap: overview.marketCap,
            fdv: overview.fdv,
            liquidity: overview.liquidity,
          },
          volume: {
            volume1h: overview.volume1hUSD,
            volume24h: overview.volume24hUSD,
            volume24hChange: overview.volume24hChangePercent,
          },
          trading: {
            trades24h: overview.trade24h,
            uniqueWallets24h: overview.uniqueWallet24h,
            lastTradeTime: overview.lastTradeHumanTime,
          },
          socials: {
            website: overview.extensions?.website,
            twitter: overview.extensions?.twitter,
            telegram: overview.extensions?.telegram,
            discord: overview.extensions?.discord,
            description: overview.extensions?.description,
          },
          recentTrades: recentTrades.slice(0, 5).map(t => ({
            type: t.side || t.tx_type,
            volumeUSD: t.volume_usd,
            source: t.source,
            from: `${t.from.ui_amount.toFixed(4)} ${t.from.symbol}`,
            to: `${t.to.ui_amount.toFixed(4)} ${t.to.symbol}`,
          })),
          formatted: service.formatTokenSummary(overview),
        };

        // Add chart data if available
        if (chartData) {
          (result as any).chart = chartData;
        }

        return result;
      },
    },

    // =========================================================================
    // PRICE & CHART
    // =========================================================================
    {
      name: 'get_token_price',
      description: 'Get the current price of a Solana token with volume data.',
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
        const service = ensureBirdeyeService(deps);
        
        const priceData = await service.getPriceVolume(address, '24h');
        
        if (!priceData) {
          return { success: false, error: 'Price data not available' };
        }

        return {
          success: true,
          price: priceData.price,
          priceChange24h: `${priceData.priceChangePercent >= 0 ? '+' : ''}${priceData.priceChangePercent.toFixed(2)}%`,
          volume24h: priceData.volumeUSD,
          volumeChange24h: `${priceData.volumeChangePercent >= 0 ? '+' : ''}${priceData.volumeChangePercent.toFixed(2)}%`,
          updatedAt: priceData.updateHumanTime,
        };
      },
    },

    {
      name: 'get_token_chart',
      description: `Get OHLCV candlestick chart data for a token. Supports timeframes from 1 second to 1 month.
Returns open, high, low, close, and volume for each candle.`,
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Solana token mint address',
          },
          timeframe: {
            type: 'string',
            description: 'Chart timeframe: 1s, 15s, 30s, 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w',
            default: '15m',
          },
          hours: {
            type: 'number',
            description: 'Number of hours of data to fetch (default: 24)',
            default: 24,
          },
        },
        required: ['address'],
      },
      async execute({ address, timeframe = '15m', hours = 24 }: { address: string; timeframe?: string; hours?: number }) {
        const service = ensureBirdeyeService(deps);
        
        const now = Math.floor(Date.now() / 1000);
        const timeFrom = now - (hours * 3600);
        
        const candles = await service.getOHLCV(address, timeframe as any, {
          timeFrom,
          timeTo: now,
        });

        if (candles.length === 0) {
          return { success: false, error: 'No chart data available' };
        }

        // Calculate summary stats
        const high = Math.max(...candles.map(c => c.h));
        const low = Math.min(...candles.map(c => c.l));
        const open = candles[0].o;
        const close = candles[candles.length - 1].c;
        const change = ((close - open) / open) * 100;
        const totalVolume = candles.reduce((sum, c) => sum + (c.v_usd || 0), 0);

        return {
          success: true,
          address,
          timeframe,
          period: `${hours}h`,
          candleCount: candles.length,
          summary: {
            open,
            high,
            low,
            close,
            change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
            totalVolume,
          },
          candles: candles.map(c => ({
            time: new Date(c.unix_time * 1000).toISOString(),
            o: c.o,
            h: c.h,
            l: c.l,
            c: c.c,
            v: c.v_usd,
          })),
        };
      },
    },

    // =========================================================================
    // DISCOVERY
    // =========================================================================
    {
      name: 'get_trending_tokens',
      description: 'Get trending/top tokens on Solana sorted by volume, liquidity, or price change.',
      inputSchema: {
        type: 'object',
        properties: {
          sortBy: {
            type: 'string',
            description: 'Sort by: volume_24h_usd, liquidity, price_change_24h_percent, market_cap',
            default: 'volume_24h_usd',
          },
          limit: {
            type: 'number',
            description: 'Number of tokens to return (max 50)',
            default: 10,
          },
          minLiquidity: {
            type: 'number',
            description: 'Minimum liquidity in USD',
          },
        },
        required: [],
      },
      async execute({ sortBy = 'volume_24h_usd', limit = 10, minLiquidity }: { sortBy?: string; limit?: number; minLiquidity?: number }) {
        const service = ensureBirdeyeService(deps);
        
        const tokens = await service.getTokenList({
          sortBy: sortBy as any,
          limit: Math.min(limit, 50),
          minLiquidity,
        });

        return {
          success: true,
          sortedBy: sortBy,
          count: tokens.length,
          tokens: tokens.map((t: any) => ({
            address: t.address,
            symbol: t.symbol,
            name: t.name,
            price: t.price,
            priceChange24h: t.price_change_24h_percent,
            volume24h: t.volume_24h_usd,
            liquidity: t.liquidity,
            marketCap: t.market_cap,
          })),
        };
      },
    },

    {
      name: 'get_new_listings',
      description: 'Get newly listed tokens on Solana including meme coins from Pump.fun and Raydium.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of listings to return (default: 20)',
            default: 20,
          },
          includeMemePlatforms: {
            type: 'boolean',
            description: 'Include Pump.fun and other meme platforms',
            default: true,
          },
        },
        required: [],
      },
      async execute({ limit = 20, includeMemePlatforms = true }: { limit?: number; includeMemePlatforms?: boolean }) {
        const service = ensureBirdeyeService(deps);
        
        const listings = await service.getNewListings({
          limit,
          memePlatformEnabled: includeMemePlatforms,
        });

        return {
          success: true,
          count: listings.length,
          listings: listings.map((t: any) => ({
            address: t.address,
            symbol: t.symbol,
            name: t.name,
            price: t.price,
            liquidity: t.liquidity,
            marketCap: t.mc,
            source: t.source,
            createdAt: t.created_time,
          })),
        };
      },
    },

    {
      name: 'get_recent_trades',
      description: 'Get recent trades for a specific token or across all of Solana.',
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Token address (optional - if omitted, gets global trades)',
          },
          limit: {
            type: 'number',
            description: 'Number of trades to return',
            default: 20,
          },
          txType: {
            type: 'string',
            description: 'Filter by type: swap, buy, sell, all',
            default: 'swap',
          },
        },
        required: [],
      },
      async execute({ address, limit = 20, txType = 'swap' }: { address?: string; limit?: number; txType?: string }) {
        const service = ensureBirdeyeService(deps);
        
        let trades;
        if (address) {
          trades = await service.getTokenTrades(address, { limit, txType: txType as any });
        } else {
          trades = await service.getRecentTrades({ limit, txType: txType as any });
        }

        return {
          success: true,
          tokenAddress: address || 'global',
          count: trades.length,
          trades: trades.map(t => ({
            txHash: t.tx_hash,
            type: t.side || t.tx_type,
            volumeUSD: t.volume_usd,
            source: t.source,
            owner: t.owner,
            from: {
              symbol: t.from.symbol,
              amount: t.from.ui_amount,
            },
            to: {
              symbol: t.to.symbol,
              amount: t.to.ui_amount,
            },
            time: new Date(t.block_unix_time * 1000).toISOString(),
          })),
        };
      },
    },

    // =========================================================================
    // WALLET
    // =========================================================================
    {
      name: 'get_wallet_portfolio',
      description: 'Get the token portfolio and net worth of a Solana wallet.',
      inputSchema: {
        type: 'object',
        properties: {
          wallet: {
            type: 'string',
            description: 'Solana wallet address',
          },
        },
        required: ['wallet'],
      },
      async execute({ wallet }: { wallet: string }) {
        const service = ensureBirdeyeService(deps);
        
        const portfolio = await service.getWalletNetWorth(wallet);
        
        if (!portfolio) {
          return { success: false, error: 'Wallet not found or no holdings' };
        }

        return {
          success: true,
          wallet: portfolio.wallet_address,
          netWorth: portfolio.total_value,
          currency: portfolio.currency,
          tokenCount: portfolio.items.length,
          holdings: portfolio.items.slice(0, 20).map(t => ({
            symbol: t.symbol,
            name: t.name,
            address: t.address,
            balance: t.amount,
            price: t.price,
            value: t.value,
            logo: t.logo_uri,
          })),
        };
      },
    },

    // =========================================================================
    // ALERTS - Price
    // =========================================================================
    {
      name: 'create_price_alert',
      description: `Create a price alert for a token. You'll be notified when the price goes above or below your target.`,
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Token mint address',
          },
          condition: {
            type: 'string',
            description: 'Alert condition: "above" or "below"',
          },
          targetPrice: {
            type: 'number',
            description: 'Target price in USD',
          },
        },
        required: ['address', 'condition', 'targetPrice'],
      },
      async execute({ address, condition, targetPrice }: { address: string; condition: string; targetPrice: number }) {
        const ws = ensureBirdeyeWs(deps);
        
        const alertType = condition === 'above' ? 'price_above' : 'price_below';
        
        const alertId = ws.createPriceAlert(address, alertType, targetPrice, (data) => {
          deps.logger.info(`[Birdeye] 🚨 Price alert triggered for ${address}: $${data.price}`);
        });

        return {
          success: true,
          alertId,
          message: `Price alert created: notify when price goes ${condition} $${targetPrice}`,
          tokenAddress: address,
          condition,
          targetPrice,
        };
      },
    },

    // =========================================================================
    // ALERTS - Large Trades
    // =========================================================================
    {
      name: 'create_whale_alert',
      description: 'Create an alert for large trades (whale activity) above a USD threshold.',
      inputSchema: {
        type: 'object',
        properties: {
          minVolumeUSD: {
            type: 'number',
            description: 'Minimum trade volume in USD to trigger alert',
            default: 10000,
          },
        },
        required: [],
      },
      async execute({ minVolumeUSD = 10000 }: { minVolumeUSD?: number }) {
        const ws = ensureBirdeyeWs(deps);
        
        const alertId = ws.createLargeTradeAlert(minVolumeUSD, (data) => {
          deps.logger.info(`[Birdeye] 🐋 Whale alert: $${data.trade.volumeUSD.toFixed(0)} ${data.trade.side}`);
        });

        return {
          success: true,
          alertId,
          message: `Whale alert created: notify on trades >= $${minVolumeUSD.toLocaleString()}`,
          threshold: minVolumeUSD,
        };
      },
    },

    // =========================================================================
    // ALERTS - New Listings
    // =========================================================================
    {
      name: 'create_new_listing_alert',
      description: 'Create an alert for new token listings. Great for catching new meme coins early.',
      inputSchema: {
        type: 'object',
        properties: {
          minLiquidity: {
            type: 'number',
            description: 'Minimum liquidity in USD (filter out rugs)',
          },
          maxLiquidity: {
            type: 'number',
            description: 'Maximum liquidity (catch early listings)',
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by sources: pumpfun, raydium, etc.',
          },
        },
        required: [],
      },
      async execute({ minLiquidity, maxLiquidity, sources }: { minLiquidity?: number; maxLiquidity?: number; sources?: string[] }) {
        const ws = ensureBirdeyeWs(deps);
        
        const alertId = ws.createNewListingAlert({ minLiquidity, maxLiquidity, sources }, (data) => {
          deps.logger.info(`[Birdeye] 🆕 New listing: ${data.token.symbol} - $${data.token.liquidity?.toFixed(0)} liquidity`);
        });

        return {
          success: true,
          alertId,
          message: 'New listing alert created',
          filters: {
            minLiquidity,
            maxLiquidity,
            sources,
          },
        };
      },
    },

    // =========================================================================
    // ALERTS - Wallet Tracking
    // =========================================================================
    {
      name: 'create_wallet_alert',
      description: 'Create an alert to monitor a wallet address for any trading activity.',
      inputSchema: {
        type: 'object',
        properties: {
          wallet: {
            type: 'string',
            description: 'Wallet address to monitor',
          },
        },
        required: ['wallet'],
      },
      async execute({ wallet }: { wallet: string }) {
        const ws = ensureBirdeyeWs(deps);
        
        const alertId = ws.createWalletAlert(wallet, (data) => {
          deps.logger.info(`[Birdeye] 👛 Wallet activity: ${wallet.slice(0, 8)}... ${data.transaction.side}`);
        });

        return {
          success: true,
          alertId,
          message: `Wallet alert created for ${wallet.slice(0, 8)}...${wallet.slice(-4)}`,
          wallet,
        };
      },
    },

    // =========================================================================
    // ALERT MANAGEMENT
    // =========================================================================
    {
      name: 'list_alerts',
      description: 'List all active alerts.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      async execute() {
        const ws = getBirdeyeWebSocket();
        
        if (!ws) {
          return { success: true, alerts: [], message: 'No WebSocket connection - no active alerts' };
        }

        const alerts = ws.getAlerts();
        const status = ws.getConnectionStatus();

        return {
          success: true,
          connected: status.connected,
          subscriptionCount: status.subscriptions,
          alertCount: alerts.length,
          alerts: alerts.map(a => ({
            id: a.id,
            type: a.type,
            active: a.active,
            tokenAddress: a.tokenAddress,
            walletAddress: a.walletAddress,
            threshold: a.threshold,
            createdAt: new Date(a.createdAt).toISOString(),
            triggeredAt: a.triggeredAt ? new Date(a.triggeredAt).toISOString() : null,
          })),
        };
      },
    },

    {
      name: 'delete_alert',
      description: 'Delete an alert by its ID.',
      inputSchema: {
        type: 'object',
        properties: {
          alertId: {
            type: 'string',
            description: 'Alert ID to delete',
          },
        },
        required: ['alertId'],
      },
      async execute({ alertId }: { alertId: string }) {
        const ws = getBirdeyeWebSocket();
        
        if (!ws) {
          return { success: false, error: 'No WebSocket connection' };
        }

        const deleted = ws.deleteAlert(alertId);

        return {
          success: deleted,
          message: deleted ? `Alert ${alertId} deleted` : `Alert ${alertId} not found`,
        };
      },
    },

    // =========================================================================
    // REAL-TIME SUBSCRIPTIONS
    // =========================================================================
    {
      name: 'subscribe_token_price',
      description: 'Subscribe to real-time price updates for a token.',
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Token mint address',
          },
          interval: {
            type: 'string',
            description: 'Update interval: 1m, 5m, 15m, 1h',
            default: '1m',
          },
        },
        required: ['address'],
      },
      async execute({ address, interval = '1m' }: { address: string; interval?: string }) {
        const ws = ensureBirdeyeWs(deps);
        
        const subscriptionId = await ws.subscribePrice(address, {
          chartType: interval as any,
        });

        return {
          success: true,
          subscriptionId,
          message: `Subscribed to ${address} price updates (${interval} interval)`,
        };
      },
    },

    {
      name: 'get_birdeye_status',
      description: 'Get the status of Birdeye WebSocket connection and active subscriptions.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      async execute() {
        const ws = getBirdeyeWebSocket();
        
        if (!ws) {
          return {
            success: true,
            connected: false,
            subscriptions: 0,
            alerts: 0,
            message: 'WebSocket not initialized',
          };
        }

        const status = ws.getConnectionStatus();
        const subscriptions = ws.getActiveSubscriptions();

        return {
          success: true,
          connected: status.connected,
          subscriptionCount: status.subscriptions,
          alertCount: status.alerts,
          subscriptions: subscriptions.map(s => ({
            id: s.id,
            type: s.type,
            address: s.options.address,
          })),
        };
      },
    },
  ];
}
