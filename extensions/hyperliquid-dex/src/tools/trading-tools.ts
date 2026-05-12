import { HyperliquidService } from '../services/hyperliquid-service.js';
import { OrderRequest } from '../types/index.js';

/**
 * AI Tools for Hyperliquid DEX Trading
 * Provides natural language interface to trading operations
 */
export function createTradingTools(service: HyperliquidService) {
  return {
    /**
     * Open a perpetual long position
     */
    hyperliquid_open_long: {
      name: 'hyperliquid_open_long',
      description: 'Open a long (buy) perpetual position on Hyperliquid DEX. Use this when user wants to go long, buy perpetuals, or enter a long position.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL - without USDT suffix)'
          },
          quantity: {
            type: 'number',
            description: 'Amount to buy (in base asset units)'
          },
          price: {
            type: 'number',
            description: 'Limit price (optional, omit for market order)'
          },
          leverage: {
            type: 'number',
            description: 'Leverage multiplier (e.g., 5 for 5x, 10 for 10x). Optional, defaults to current leverage'
          }
        },
        required: ['symbol', 'quantity']
      },
      handler: async (input: any) => {
        const { symbol, quantity, price, leverage } = input;

        try {
          // Set leverage if specified
          if (leverage && leverage > 1) {
            await service.setLeverage(symbol, leverage);
          }

          let order;
          if (price) {
            // Limit order
            const orderRequest: OrderRequest = {
              coin: symbol,
              is_buy: true,
              sz: quantity,
              limit_px: price,
              order_type: { limit: { tif: 'Gtc' } },
              reduce_only: false,
            };
            order = await service.placeOrder(orderRequest);
          } else {
            // Market order using helper
            order = await service.marketOpen(symbol, true, quantity);
          }

          return {
            success: true,
            message: `Opened LONG position: ${quantity} ${symbol} ${price ? `at $${price}` : 'at market price'} ${leverage ? `with ${leverage}x leverage` : ''}`,
            order
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to open long position: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Open a perpetual short position
     */
    hyperliquid_open_short: {
      name: 'hyperliquid_open_short',
      description: 'Open a short (sell) perpetual position on Hyperliquid DEX. Use this when user wants to go short, sell perpetuals, or enter a short position.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL - without USDT suffix)'
          },
          quantity: {
            type: 'number',
            description: 'Amount to sell (in base asset units)'
          },
          price: {
            type: 'number',
            description: 'Limit price (optional, omit for market order)'
          },
          leverage: {
            type: 'number',
            description: 'Leverage multiplier (e.g., 5 for 5x, 10 for 10x). Optional, defaults to current leverage'
          }
        },
        required: ['symbol', 'quantity']
      },
      handler: async (input: any) => {
        const { symbol, quantity, price, leverage } = input;

        try {
          // Set leverage if specified
          if (leverage && leverage > 1) {
            await service.setLeverage(symbol, leverage);
          }

          let order;
          if (price) {
            // Limit order
            const orderRequest: OrderRequest = {
              coin: symbol,
              is_buy: false,
              sz: quantity,
              limit_px: price,
              order_type: { limit: { tif: 'Gtc' } },
              reduce_only: false,
            };
            order = await service.placeOrder(orderRequest);
          } else {
            // Market order using helper
            order = await service.marketOpen(symbol, false, quantity);
          }

          return {
            success: true,
            message: `Opened SHORT position: ${quantity} ${symbol} ${price ? `at $${price}` : 'at market price'} ${leverage ? `with ${leverage}x leverage` : ''}`,
            order
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to open short position: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Close a perpetual position
     */
    hyperliquid_close_position: {
      name: 'hyperliquid_close_position',
      description: 'Close an existing perpetual position on Hyperliquid DEX. Use this when user wants to close, exit, or take profit on a position.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL)'
          },
          quantity: {
            type: 'number',
            description: 'Amount to close (optional, omit to close entire position)'
          },
          price: {
            type: 'number',
            description: 'Limit price (optional, omit for market order)'
          }
        },
        required: ['symbol']
      },
      handler: async (input: any) => {
        const { symbol, quantity, price } = input;

        try {
          if (price) {
            // Get current position to determine direction
            const state = await service.getClearinghouseState();
            const position = state.assetPositions.find(p => p.position.coin === symbol);

            if (!position || parseFloat(position.position.szi) === 0) {
              return {
                success: false,
                message: `No position found for ${symbol}`
              };
            }

            const szi = parseFloat(position.position.szi);
            const closeSize = quantity || Math.abs(szi);
            const isBuy = szi < 0;

            const orderRequest: OrderRequest = {
              coin: symbol,
              is_buy: isBuy,
              sz: closeSize,
              limit_px: price,
              order_type: { limit: { tif: 'Gtc' } },
              reduce_only: true,
            };
            const order = await service.placeOrder(orderRequest);

            return {
              success: true,
              message: `Closing position: ${closeSize} ${symbol} at $${price}`,
              order
            };
          } else {
            // Market close
            const order = await service.marketClose(symbol, quantity);
            return {
              success: true,
              message: `Closed position for ${symbol} at market price`,
              order
            };
          }
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to close position: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Place a limit order
     */
    hyperliquid_limit_order: {
      name: 'hyperliquid_limit_order',
      description: 'Place a limit order on Hyperliquid DEX. Use this for precise entry/exit at a specific price.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL)'
          },
          side: {
            type: 'string',
            enum: ['buy', 'sell'],
            description: 'Order side (buy or sell)'
          },
          quantity: {
            type: 'number',
            description: 'Amount to trade'
          },
          price: {
            type: 'number',
            description: 'Limit price'
          },
          reduceOnly: {
            type: 'boolean',
            description: 'Reduce only order (for closing positions)'
          }
        },
        required: ['symbol', 'side', 'quantity', 'price']
      },
      handler: async (input: any) => {
        const { symbol, side, quantity, price, reduceOnly = false } = input;

        try {
          const orderRequest: OrderRequest = {
            coin: symbol,
            is_buy: side === 'buy',
            sz: quantity,
            limit_px: price,
            order_type: { limit: { tif: 'Gtc' } },
            reduce_only: reduceOnly,
          };

          const order = await service.placeOrder(orderRequest);

          return {
            success: true,
            message: `Placed ${side.toUpperCase()} limit order: ${quantity} ${symbol} at $${price}`,
            order
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to place limit order: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Cancel an order
     */
    hyperliquid_cancel_order: {
      name: 'hyperliquid_cancel_order',
      description: 'Cancel a specific order on Hyperliquid DEX by order ID.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol'
          },
          orderId: {
            type: 'number',
            description: 'Order ID to cancel'
          }
        },
        required: ['symbol', 'orderId']
      },
      handler: async (input: any) => {
        const { symbol, orderId } = input;

        try {
          const result = await service.cancelOrder(symbol, orderId);
          return {
            success: true,
            message: `Canceled order ${orderId} for ${symbol}`,
            result
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to cancel order: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Cancel all open orders
     */
    hyperliquid_cancel_all_orders: {
      name: 'hyperliquid_cancel_all_orders',
      description: 'Cancel all open orders on Hyperliquid DEX. Optionally filter by symbol.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (optional, omit to cancel all orders)'
          }
        }
      },
      handler: async (input: any) => {
        const { symbol } = input;

        try {
          const result = await service.cancelAllOrders(symbol);
          return {
            success: true,
            message: symbol
              ? `Canceled ${result.cancelled} orders for ${symbol}`
              : `Canceled ${result.cancelled} orders`,
            result
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to cancel orders: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Get current positions
     */
    hyperliquid_get_positions: {
      name: 'hyperliquid_get_positions',
      description: 'Get current open positions on Hyperliquid DEX. Shows position size, entry price, PnL, and leverage.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (optional, omit to get all positions)'
          }
        }
      },
      handler: async (input: any) => {
        const { symbol } = input;

        try {
          const state = await service.getClearinghouseState();

          // Filter out positions with zero size
          let positions = state.assetPositions.filter(
            p => parseFloat(p.position.szi) !== 0
          );

          if (symbol) {
            positions = positions.filter(p => p.position.coin === symbol);
          }

          if (positions.length === 0) {
            return {
              success: true,
              message: symbol ? `No open positions for ${symbol}` : 'No open positions',
              positions: [],
              account: {
                accountValue: state.marginSummary.accountValue,
                totalMarginUsed: state.marginSummary.totalMarginUsed,
                withdrawable: state.withdrawable
              }
            };
          }

          const summary = positions.map(p => {
            const pos = p.position;
            const pnl = parseFloat(pos.unrealizedPnl);
            const roe = parseFloat(pos.returnOnEquity) * 100;
            const side = parseFloat(pos.szi) > 0 ? 'LONG' : 'SHORT';

            return `${pos.coin} ${side}: ${Math.abs(parseFloat(pos.szi))} @ $${pos.entryPx} (PnL: $${pnl.toFixed(2)} / ${roe.toFixed(2)}% ROE) [${pos.leverage.value}x ${pos.leverage.type}]`;
          }).join('\n');

          return {
            success: true,
            message: `Open positions:\n${summary}`,
            positions: positions.map(p => p.position),
            account: {
              accountValue: state.marginSummary.accountValue,
              totalMarginUsed: state.marginSummary.totalMarginUsed,
              withdrawable: state.withdrawable
            }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get positions: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Get open orders
     */
    hyperliquid_get_open_orders: {
      name: 'hyperliquid_get_open_orders',
      description: 'Get all open (unfilled) orders on Hyperliquid DEX.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (optional, omit to get all orders)'
          }
        }
      },
      handler: async (input: any) => {
        const { symbol } = input;

        try {
          let orders = await service.getUserOpenOrders();

          if (symbol) {
            orders = orders.filter(o => o.coin === symbol);
          }

          if (orders.length === 0) {
            return {
              success: true,
              message: symbol ? `No open orders for ${symbol}` : 'No open orders',
              orders: []
            };
          }

          const summary = orders.map(o =>
            `[${o.oid}] ${o.coin} ${o.side}: ${o.sz} @ $${o.limitPx}`
          ).join('\n');

          return {
            success: true,
            message: `Open orders:\n${summary}`,
            orders
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get open orders: ${error.message}`,
            error: error.message
          };
        }
      }
    },

    /**
     * Set leverage
     */
    hyperliquid_set_leverage: {
      name: 'hyperliquid_set_leverage',
      description: 'Set the leverage for a trading pair on Hyperliquid DEX.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTC, ETH, SOL)'
          },
          leverage: {
            type: 'number',
            description: 'Leverage multiplier (e.g., 5 for 5x, 10 for 10x)'
          },
          isCross: {
            type: 'boolean',
            description: 'Use cross margin (true) or isolated margin (false). Defaults to cross.'
          }
        },
        required: ['symbol', 'leverage']
      },
      handler: async (input: any) => {
        const { symbol, leverage, isCross = true } = input;

        try {
          const result = await service.setLeverage(symbol, leverage, isCross);
          return {
            success: true,
            message: `Set ${symbol} leverage to ${leverage}x (${isCross ? 'cross' : 'isolated'} margin)`,
            result
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to set leverage: ${error.message}`,
            error: error.message
          };
        }
      }
    }
  };
}
