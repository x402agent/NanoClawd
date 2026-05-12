import { ClawdbotTool } from '../types/index.js';
import { KalshiService } from '../services/kalshi-service.js';

export function createTradingTools(service: KalshiService): Record<string, ClawdbotTool> {
  return {
    kalshi_get_balance: {
      name: 'kalshi_get_balance',
      description: 'Get your Kalshi account balance including available funds and any pending payouts',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const balance = await service.getBalance();
        return {
          balance_cents: balance.balance,
          balance_dollars: balance.balance_dollars || `$${(balance.balance / 100).toFixed(2)}`,
          payout_cents: balance.payout,
          payout_dollars: balance.payout_dollars,
        };
      },
    },

    kalshi_get_positions: {
      name: 'kalshi_get_positions',
      description: 'Get your current positions on Kalshi prediction markets. Shows your holdings in various markets with cost basis and P&L.',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Filter by specific market ticker',
          },
          event_ticker: {
            type: 'string',
            description: 'Filter by event ticker',
          },
          settlement_status: {
            type: 'string',
            enum: ['all', 'unsettled', 'settled'],
            description: 'Filter by settlement status (default: unsettled)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of positions to return (default: 100)',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const positions = await service.getPositions({
          ticker: params.ticker as string | undefined,
          event_ticker: params.event_ticker as string | undefined,
          settlement_status: params.settlement_status as 'all' | 'unsettled' | 'settled' | undefined,
          limit: params.limit as number | undefined,
        });
        return {
          positions: positions.positions.map((p) => ({
            ticker: p.ticker,
            event_ticker: p.event_ticker,
            market_title: p.market_title,
            position: p.position,
            total_cost_dollars: p.total_cost_dollars || `$${(p.total_cost / 100).toFixed(2)}`,
            realized_pnl_dollars: p.realized_pnl_dollars,
            market_exposure_dollars: p.market_exposure_dollars,
          })),
          cursor: positions.cursor,
        };
      },
    },

    kalshi_get_orders: {
      name: 'kalshi_get_orders',
      description: 'Get your orders on Kalshi. Can filter by status (resting, executed, canceled, pending).',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Filter by market ticker',
          },
          event_ticker: {
            type: 'string',
            description: 'Filter by event ticker',
          },
          status: {
            type: 'string',
            enum: ['resting', 'canceled', 'executed', 'pending', 'all'],
            description: 'Filter by order status (default: all)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of orders to return (default: 100)',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const orders = await service.getOrders({
          ticker: params.ticker as string | undefined,
          event_ticker: params.event_ticker as string | undefined,
          status: params.status as 'resting' | 'canceled' | 'executed' | 'pending' | 'all' | undefined,
          limit: params.limit as number | undefined,
        });
        return {
          orders: orders.orders.map((o) => ({
            order_id: o.order_id,
            ticker: o.ticker,
            side: o.side,
            action: o.action,
            type: o.type,
            status: o.status,
            yes_price_dollars: o.yes_price_dollars,
            no_price_dollars: o.no_price_dollars,
            initial_count: o.initial_count,
            remaining_count: o.remaining_count,
            fill_count: o.fill_count,
            created_time: o.created_time,
          })),
          cursor: orders.cursor,
        };
      },
    },

    kalshi_create_order: {
      name: 'kalshi_create_order',
      description:
        'Create a new order on Kalshi. Can be a limit or market order. For limit orders, specify the price in cents (1-99). For YES contracts, your max loss is the price you pay.',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'The market ticker to trade (e.g., "KXBTC-25JAN03-97000")',
          },
          side: {
            type: 'string',
            enum: ['yes', 'no'],
            description: 'Whether to buy YES or NO contracts',
          },
          action: {
            type: 'string',
            enum: ['buy', 'sell'],
            description: 'Whether to buy or sell contracts',
          },
          count: {
            type: 'number',
            description: 'Number of contracts to trade',
          },
          type: {
            type: 'string',
            enum: ['limit', 'market'],
            description: 'Order type (default: limit)',
          },
          yes_price: {
            type: 'number',
            description: 'Limit price in cents for YES contracts (1-99). Required for limit orders on YES side.',
          },
          no_price: {
            type: 'number',
            description: 'Limit price in cents for NO contracts (1-99). Required for limit orders on NO side.',
          },
          time_in_force: {
            type: 'string',
            enum: ['fill_or_kill', 'good_till_canceled', 'immediate_or_cancel'],
            description: 'Time in force policy (default: good_till_canceled)',
          },
          post_only: {
            type: 'boolean',
            description: 'If true, order will only be placed if it would be a maker order',
          },
        },
        required: ['ticker', 'side', 'action', 'count'],
      },
      execute: async (params: Record<string, unknown>) => {
        const order = await service.createOrder({
          ticker: params.ticker as string,
          side: params.side as 'yes' | 'no',
          action: params.action as 'buy' | 'sell',
          count: params.count as number,
          type: params.type as 'limit' | 'market' | undefined,
          yes_price: params.yes_price as number | undefined,
          no_price: params.no_price as number | undefined,
          time_in_force: params.time_in_force as
            | 'fill_or_kill'
            | 'good_till_canceled'
            | 'immediate_or_cancel'
            | undefined,
          post_only: params.post_only as boolean | undefined,
        });
        return {
          order_id: order.order_id,
          ticker: order.ticker,
          side: order.side,
          action: order.action,
          status: order.status,
          initial_count: order.initial_count,
          fill_count: order.fill_count,
          remaining_count: order.remaining_count,
          yes_price_dollars: order.yes_price_dollars,
          no_price_dollars: order.no_price_dollars,
          created_time: order.created_time,
        };
      },
    },

    kalshi_cancel_order: {
      name: 'kalshi_cancel_order',
      description: 'Cancel a resting order on Kalshi',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The ID of the order to cancel',
          },
        },
        required: ['order_id'],
      },
      execute: async (params: Record<string, unknown>) => {
        const result = await service.cancelOrder(params.order_id as string);
        return {
          order_id: result.order.order_id,
          status: result.order.status,
          reduced_by: result.reduced_by,
        };
      },
    },

    kalshi_cancel_all_orders: {
      name: 'kalshi_cancel_all_orders',
      description: 'Cancel all resting orders, optionally filtered by ticker or event',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Only cancel orders for this market ticker',
          },
          event_ticker: {
            type: 'string',
            description: 'Only cancel orders for markets in this event',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const result = await service.cancelAllOrders({
          ticker: params.ticker as string | undefined,
          event_ticker: params.event_ticker as string | undefined,
        });
        return {
          canceled_count: result.canceled_order_ids.length,
          canceled_order_ids: result.canceled_order_ids,
        };
      },
    },

    kalshi_get_fills: {
      name: 'kalshi_get_fills',
      description: 'Get your trade execution history (fills) on Kalshi',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Filter by market ticker',
          },
          order_id: {
            type: 'string',
            description: 'Filter by order ID',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of fills to return (default: 100)',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const fills = await service.getFills({
          ticker: params.ticker as string | undefined,
          order_id: params.order_id as string | undefined,
          limit: params.limit as number | undefined,
        });
        return {
          fills: fills.fills.map((f) => ({
            trade_id: f.trade_id,
            order_id: f.order_id,
            ticker: f.ticker,
            side: f.side,
            action: f.action,
            count: f.count,
            price_dollars: f.price_dollars || `$${(f.price / 100).toFixed(2)}`,
            fee_dollars: f.fee_dollars || `$${(f.fee / 100).toFixed(2)}`,
            is_taker: f.is_taker,
            created_time: f.created_time,
          })),
          cursor: fills.cursor,
        };
      },
    },

    kalshi_get_settlements: {
      name: 'kalshi_get_settlements',
      description: 'Get your settlement history - markets that have resolved and paid out',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of settlements to return (default: 100)',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const settlements = await service.getSettlements({
          limit: params.limit as number | undefined,
        });
        return {
          settlements: settlements.settlements.map((s) => ({
            ticker: s.ticker,
            event_ticker: s.event_ticker,
            market_result: s.market_result,
            position_before_settlement: s.position_before_settlement,
            revenue_dollars: s.revenue_dollars || `$${(s.revenue / 100).toFixed(2)}`,
            settled_time: s.settled_time,
          })),
          cursor: settlements.cursor,
        };
      },
    },
  };
}
