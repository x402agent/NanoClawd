import { HyperliquidService } from '../services/hyperliquid-service.js';
import { KlineInterval } from '../types/index.js';

/**
 * AI Tools for Hyperliquid DEX Market Data & Analysis
 * Provides natural language interface to price data, charts, and alerts
 */
export function createMarketTools(service: HyperliquidService) {
  return {
    /**
     * Get current price
     */
    hyperliquid_get_price: {
      name: 'hyperliquid_get_price',
      description: 'Get the current market price for a trading pair on Hyperliquid DEX. Use this when user asks about price, current value, or "how much is X?"',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL - without USDT suffix)'
          }
        },
        required: ['symbol']
      },
      handler: async (input: any) => {
        const { symbol } = input;

        try {
          const mids = await service.getAllMids();
          const price = mids[symbol];

          if (!price) {
            return {
              success: false,
              message: `Symbol ${symbol} not found. Try using the asset name without USDT suffix (e.g., BTC, ETH, SOL).`
            };
          }

          return {
            success: true,
            message: `${symbol} current price: $${price}`,
            price,
            symbol
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get price: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Get market data and statistics
     */
    hyperliquid_get_market_data: {
      name: 'hyperliquid_get_market_data',
      description: 'Get detailed market data including funding rate, open interest, and 24h volume. Use this when user asks about market conditions, funding, or volume.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL)'
          }
        },
        required: ['symbol']
      },
      handler: async (input: any) => {
        const { symbol } = input;

        try {
          const data = await service.getMetaAndAssetCtxs();
          const meta = data[0];
          const assetCtxs = data[1];

          const assetIndex = meta.universe.findIndex(a => a.name === symbol);
          if (assetIndex === -1) {
            return {
              success: false,
              message: `Symbol ${symbol} not found`
            };
          }

          const ctx = assetCtxs[assetIndex];
          const assetMeta = meta.universe[assetIndex];

          const funding = parseFloat(ctx.funding) * 100;
          const fundingAnnualized = funding * 24 * 365;
          const priceChange = ((parseFloat(ctx.markPx) - parseFloat(ctx.prevDayPx)) / parseFloat(ctx.prevDayPx)) * 100;

          const summary = [
            `${symbol} Market Data:`,
            ``,
            `Price: $${ctx.markPx} (Mid: $${ctx.midPx})`,
            `Oracle: $${ctx.oraclePx}`,
            `24h Change: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`,
            ``,
            `Funding Rate: ${funding >= 0 ? '+' : ''}${funding.toFixed(4)}% (${fundingAnnualized.toFixed(2)}% APR)`,
            `Premium: ${(parseFloat(ctx.premium) * 100).toFixed(4)}%`,
            ``,
            `Open Interest: $${parseFloat(ctx.openInterest).toLocaleString()}`,
            `24h Volume: $${parseFloat(ctx.dayNtlVlm).toLocaleString()}`,
            ``,
            `Max Leverage: ${assetMeta.maxLeverage}x`,
            `Size Decimals: ${assetMeta.szDecimals}`
          ].join('\n');

          return {
            success: true,
            message: summary,
            data: {
              ...ctx,
              maxLeverage: assetMeta.maxLeverage,
              szDecimals: assetMeta.szDecimals
            }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get market data: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Get order book
     */
    hyperliquid_get_orderbook: {
      name: 'hyperliquid_get_orderbook',
      description: 'Get the order book (L2 book) for a trading pair. Shows bid and ask levels with sizes.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL)'
          },
          levels: {
            type: 'number',
            description: 'Number of price levels to show (default 5)'
          }
        },
        required: ['symbol']
      },
      handler: async (input: any) => {
        const { symbol, levels = 5 } = input;

        try {
          const book = await service.getL2Book(symbol);

          const bids = book.levels[0].slice(0, levels);
          const asks = book.levels[1].slice(0, levels);

          const bidSummary = bids.map(b => `  $${b.px} - ${b.sz} (${b.n} orders)`).join('\n');
          const askSummary = asks.map(a => `  $${a.px} - ${a.sz} (${a.n} orders)`).join('\n');

          const spread = parseFloat(asks[0]?.px || '0') - parseFloat(bids[0]?.px || '0');
          const spreadPercent = (spread / parseFloat(bids[0]?.px || '1')) * 100;

          const summary = [
            `${symbol} Order Book:`,
            ``,
            `ASKS (Sell Orders):`,
            askSummary,
            ``,
            `--- Spread: $${spread.toFixed(2)} (${spreadPercent.toFixed(4)}%) ---`,
            ``,
            `BIDS (Buy Orders):`,
            bidSummary
          ].join('\n');

          return {
            success: true,
            message: summary,
            book: {
              bids,
              asks,
              spread,
              spreadPercent
            }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get order book: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Get chart/candlestick data
     */
    hyperliquid_get_chart: {
      name: 'hyperliquid_get_chart',
      description: 'Get candlestick/kline chart data for technical analysis. Use this when user asks about charts, candles, OHLCV data, or historical price action.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL)'
          },
          interval: {
            type: 'string',
            enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
            description: 'Candlestick interval'
          },
          limit: {
            type: 'number',
            description: 'Number of candles to retrieve (default 100)'
          }
        },
        required: ['symbol', 'interval']
      },
      handler: async (input: any) => {
        const { symbol, interval, limit = 100 } = input;

        try {
          const endTime = Date.now();
          // Calculate start time based on interval
          const intervalMs: Record<string, number> = {
            '1m': 60000,
            '5m': 300000,
            '15m': 900000,
            '30m': 1800000,
            '1h': 3600000,
            '4h': 14400000,
            '1d': 86400000,
          };
          const startTime = endTime - (intervalMs[interval] || 3600000) * limit;

          const candles = await service.getCandleSnapshot(symbol, interval as KlineInterval, startTime, endTime);

          if (candles.length === 0) {
            return {
              success: false,
              message: `No chart data found for ${symbol}`
            };
          }

          // Calculate statistics
          const closes = candles.map(c => c.c);
          const high = Math.max(...candles.map(c => c.h));
          const low = Math.min(...candles.map(c => c.l));
          const latest = closes[closes.length - 1];
          const oldest = closes[0];
          const change = ((latest - oldest) / oldest) * 100;
          const totalVolume = candles.reduce((sum, c) => sum + c.v, 0);

          const summary = [
            `${symbol} ${interval} Chart (${candles.length} candles):`,
            ``,
            `Latest: $${latest.toFixed(2)}`,
            `Period High: $${high.toFixed(2)}`,
            `Period Low: $${low.toFixed(2)}`,
            `Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
            `Volume: ${totalVolume.toLocaleString()}`,
            ``,
            `Time range: ${new Date(candles[0].t).toISOString()} to ${new Date(candles[candles.length - 1].T).toISOString()}`
          ].join('\n');

          return {
            success: true,
            message: summary,
            candles,
            stats: {
              high,
              low,
              change,
              totalVolume
            }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get chart data: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Get account balance
     */
    hyperliquid_get_balance: {
      name: 'hyperliquid_get_balance',
      description: 'Get account balance and margin information on Hyperliquid DEX. Use this when user asks about balance, funds, wallet, equity, or available capital.',
      input_schema: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        try {
          const state = await service.getClearinghouseState();

          const accountValue = parseFloat(state.marginSummary.accountValue);
          const marginUsed = parseFloat(state.marginSummary.totalMarginUsed);
          const withdrawable = parseFloat(state.withdrawable);
          const totalPnl = state.assetPositions.reduce(
            (sum, p) => sum + parseFloat(p.position.unrealizedPnl),
            0
          );

          const summary = [
            `Hyperliquid Account Balance:`,
            ``,
            `Account Value: $${accountValue.toFixed(2)}`,
            `Margin Used: $${marginUsed.toFixed(2)}`,
            `Available: $${(accountValue - marginUsed).toFixed(2)}`,
            `Withdrawable: $${withdrawable.toFixed(2)}`,
            ``,
            `Unrealized PnL: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`,
            ``,
            `Network: ${service.getIsMainnet() ? 'Mainnet' : 'Testnet'}`,
            `Wallet: ${service.getWalletAddress()}`
          ].join('\n');

          return {
            success: true,
            message: summary,
            balance: {
              accountValue,
              marginUsed,
              available: accountValue - marginUsed,
              withdrawable,
              unrealizedPnl: totalPnl
            }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get balance: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Get spot balances
     */
    hyperliquid_get_spot_balance: {
      name: 'hyperliquid_get_spot_balance',
      description: 'Get spot token balances on Hyperliquid DEX.',
      input_schema: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        try {
          const state = await service.getSpotClearinghouseState();

          if (!state.balances || state.balances.length === 0) {
            return {
              success: true,
              message: 'No spot balances',
              balances: []
            };
          }

          const nonZeroBalances = state.balances.filter(
            b => parseFloat(b.total) > 0
          );

          if (nonZeroBalances.length === 0) {
            return {
              success: true,
              message: 'No spot balances',
              balances: []
            };
          }

          const summary = nonZeroBalances.map(b => {
            const total = parseFloat(b.total);
            const hold = parseFloat(b.hold);
            const available = total - hold;
            return `${b.coin}: ${total.toFixed(8)} (Available: ${available.toFixed(8)}, Hold: ${hold.toFixed(8)})`;
          }).join('\n');

          return {
            success: true,
            message: `Spot Balances:\n${summary}`,
            balances: nonZeroBalances
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get spot balances: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Get recent fills/trades
     */
    hyperliquid_get_fills: {
      name: 'hyperliquid_get_fills',
      description: 'Get recent trade fills/executions on Hyperliquid DEX. Use this when user asks about recent trades or order history.',
      input_schema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of fills to show (default 10)'
          }
        }
      },
      handler: async (input: any) => {
        const { limit = 10 } = input;

        try {
          const fills = await service.getUserFills();
          const recentFills = fills.slice(0, limit);

          if (recentFills.length === 0) {
            return {
              success: true,
              message: 'No recent fills',
              fills: []
            };
          }

          const summary = recentFills.map(f => {
            const time = new Date(f.time).toLocaleString();
            const pnl = parseFloat(f.closedPnl);
            return `[${time}] ${f.coin} ${f.side}: ${f.sz} @ $${f.px} (Fee: $${f.fee}${pnl !== 0 ? `, PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : ''})`;
          }).join('\n');

          return {
            success: true,
            message: `Recent Fills:\n${summary}`,
            fills: recentFills
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get fills: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Create price alert
     */
    hyperliquid_create_alert: {
      name: 'hyperliquid_create_alert',
      description: 'Create a price alert that triggers when a symbol reaches a target price. Use this when user wants to be notified when price goes above/below a certain level.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL)'
          },
          targetPrice: {
            type: 'string',
            description: 'Target price to trigger alert'
          },
          condition: {
            type: 'string',
            enum: ['ABOVE', 'BELOW'],
            description: 'Alert when price goes ABOVE or BELOW target'
          }
        },
        required: ['symbol', 'targetPrice', 'condition']
      },
      handler: async (input: any) => {
        const { symbol, targetPrice, condition } = input;

        try {
          const alert = service.createAlert(symbol, targetPrice, condition);
          return {
            success: true,
            message: `Alert created: Notify when ${symbol} goes ${condition} $${targetPrice} (Alert ID: ${alert.id})`,
            alert
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to create alert: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Remove price alert
     */
    hyperliquid_remove_alert: {
      name: 'hyperliquid_remove_alert',
      description: 'Remove/cancel a price alert by its ID.',
      input_schema: {
        type: 'object',
        properties: {
          alertId: {
            type: 'string',
            description: 'Alert ID to remove'
          }
        },
        required: ['alertId']
      },
      handler: async (input: any) => {
        const { alertId } = input;
        const removed = service.removeAlert(alertId);

        if (removed) {
          return {
            success: true,
            message: `Alert ${alertId} removed`
          };
        } else {
          return {
            success: false,
            message: `Alert ${alertId} not found`
          };
        }
      }
    },

    /**
     * List all active alerts
     */
    hyperliquid_list_alerts: {
      name: 'hyperliquid_list_alerts',
      description: 'List all active price alerts.',
      input_schema: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const alerts = service.getAlerts();

        if (alerts.length === 0) {
          return {
            success: true,
            message: 'No active alerts',
            alerts: []
          };
        }

        const summary = alerts.map(a =>
          `[${a.id}] ${a.symbol} ${a.condition} $${a.targetPrice} (Created: ${new Date(a.createdAt).toLocaleString()})`
        ).join('\n');

        return {
          success: true,
          message: `Active Alerts:\n${summary}`,
          alerts
        };
      }
    },

    /**
     * Get available assets
     */
    hyperliquid_get_assets: {
      name: 'hyperliquid_get_assets',
      description: 'Get list of available trading pairs/assets on Hyperliquid DEX.',
      input_schema: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        try {
          const data = await service.getMetaAndAssetCtxs();
          const meta = data[0];

          const assets = meta.universe.map(a => ({
            name: a.name,
            maxLeverage: a.maxLeverage,
            szDecimals: a.szDecimals,
            onlyIsolated: a.onlyIsolated
          }));

          const summary = assets.map(a =>
            `${a.name} (Max: ${a.maxLeverage}x${a.onlyIsolated ? ', Isolated Only' : ''})`
          ).join(', ');

          return {
            success: true,
            message: `Available Assets (${assets.length}):\n${summary}`,
            assets
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get assets: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Analyze market conditions
     */
    hyperliquid_analyze_market: {
      name: 'hyperliquid_analyze_market',
      description: 'Perform basic technical analysis on a symbol including trend detection, funding analysis, and key levels. Use this when user asks for market analysis or trading insights.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL)'
          }
        },
        required: ['symbol']
      },
      handler: async (input: any) => {
        const { symbol } = input;

        try {
          // Get market data and chart
          const [metaData, candles] = await Promise.all([
            service.getMetaAndAssetCtxs(),
            service.getCandleSnapshot(symbol, '1h', Date.now() - 86400000, Date.now())
          ]);

          const meta = metaData[0];
          const assetCtxs = metaData[1];
          const assetIndex = meta.universe.findIndex(a => a.name === symbol);

          if (assetIndex === -1) {
            return {
              success: false,
              message: `Symbol ${symbol} not found`
            };
          }

          const ctx = assetCtxs[assetIndex];

          // Calculate from candles
          const closes = candles.map(c => c.c);
          const highs = candles.map(c => c.h);
          const lows = candles.map(c => c.l);
          const volumes = candles.map(c => c.v);

          const currentPrice = parseFloat(ctx.markPx);
          const high24h = Math.max(...highs);
          const low24h = Math.min(...lows);
          const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
          const currentVolume = volumes[volumes.length - 1];

          // Trend detection (last 6 candles)
          const recent = closes.slice(-6);
          const recentTrend = recent[recent.length - 1] > recent[0] ? 'UPTREND' : 'DOWNTREND';

          // Volume analysis
          const volumeStatus = currentVolume > avgVolume * 1.2 ? 'HIGH' : currentVolume < avgVolume * 0.8 ? 'LOW' : 'NORMAL';

          // Price position in range
          const pricePosition = ((currentPrice - low24h) / (high24h - low24h)) * 100;

          // Funding analysis
          const funding = parseFloat(ctx.funding) * 100;
          const fundingSentiment = funding > 0.01 ? 'Bullish (longs paying shorts)' : funding < -0.01 ? 'Bearish (shorts paying longs)' : 'Neutral';

          const analysis = [
            `${symbol} Market Analysis:`,
            ``,
            `Current Price: $${currentPrice}`,
            `24h Range: $${low24h.toFixed(2)} - $${high24h.toFixed(2)}`,
            `Price Position: ${pricePosition.toFixed(1)}% of 24h range`,
            ``,
            `Trend (6h): ${recentTrend}`,
            `Volume: ${volumeStatus} (Current: ${currentVolume.toLocaleString()}, Avg: ${avgVolume.toLocaleString()})`,
            ``,
            `Funding Rate: ${funding >= 0 ? '+' : ''}${funding.toFixed(4)}%`,
            `Funding Sentiment: ${fundingSentiment}`,
            ``,
            `Open Interest: $${parseFloat(ctx.openInterest).toLocaleString()}`,
            ``,
            `Support Level: ~$${low24h.toFixed(2)}`,
            `Resistance Level: ~$${high24h.toFixed(2)}`
          ].join('\n');

          return {
            success: true,
            message: analysis,
            data: {
              currentPrice,
              high24h,
              low24h,
              trend: recentTrend,
              volumeStatus,
              pricePosition,
              funding,
              fundingSentiment,
              openInterest: ctx.openInterest
            }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to analyze market: ${error.message}`,
            error: error.message
          };
        }
      }
    }
  };
}
