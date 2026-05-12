import { ClawdbotTool } from '../types/index.js';
import { KalshiService } from '../services/kalshi-service.js';

export function createMarketTools(service: KalshiService): Record<string, ClawdbotTool> {
  return {
    kalshi_get_exchange_status: {
      name: 'kalshi_get_exchange_status',
      description: 'Get Kalshi exchange status - whether trading is active and any scheduled maintenance',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const status = await service.getExchangeStatus();
        return {
          exchange_active: status.exchange_active,
          trading_active: status.trading_active,
          estimated_resume_time: status.exchange_estimated_resume_time,
        };
      },
    },

    kalshi_get_announcements: {
      name: 'kalshi_get_announcements',
      description: 'Get Kalshi exchange announcements - important notices about the platform',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const announcements = await service.getAnnouncements();
        return {
          announcements: announcements.map((a) => ({
            type: a.type,
            message: a.message,
            status: a.status,
            delivery_time: a.delivery_time,
          })),
        };
      },
    },

    kalshi_search_markets: {
      name: 'kalshi_search_markets',
      description:
        'Search and browse Kalshi prediction markets. Can filter by event, series, status. Returns market details including current prices.',
      parameters: {
        type: 'object',
        properties: {
          event_ticker: {
            type: 'string',
            description: 'Filter by event ticker (e.g., "KXBTC" for Bitcoin price markets)',
          },
          series_ticker: {
            type: 'string',
            description: 'Filter by series ticker',
          },
          status: {
            type: 'string',
            enum: ['open', 'closed', 'settled'],
            description: 'Filter by market status (default: open)',
          },
          tickers: {
            type: 'string',
            description: 'Comma-separated list of specific market tickers to retrieve',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of markets to return (default: 100)',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const markets = await service.getMarkets({
          event_ticker: params.event_ticker as string | undefined,
          series_ticker: params.series_ticker as string | undefined,
          status: params.status as 'open' | 'closed' | 'settled' | undefined,
          tickers: params.tickers as string | undefined,
          limit: params.limit as number | undefined,
        });
        return {
          markets: markets.markets.map((m) => ({
            ticker: m.ticker,
            title: m.title,
            subtitle: m.subtitle,
            event_ticker: m.event_ticker,
            status: m.status,
            yes_bid: m.yes_bid,
            yes_ask: m.yes_ask,
            last_price: m.last_price,
            volume_24h: m.volume_24h,
            open_interest: m.open_interest,
            close_time: m.close_time,
            result: m.result,
          })),
          cursor: markets.cursor,
        };
      },
    },

    kalshi_get_market: {
      name: 'kalshi_get_market',
      description: 'Get detailed information about a specific Kalshi market by ticker',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'The market ticker (e.g., "KXBTC-25JAN03-97000")',
          },
        },
        required: ['ticker'],
      },
      execute: async (params: Record<string, unknown>) => {
        const market = await service.getMarket(params.ticker as string);
        return {
          ticker: market.ticker,
          title: market.title,
          subtitle: market.subtitle,
          event_ticker: market.event_ticker,
          status: market.status,
          yes_bid: market.yes_bid,
          yes_ask: market.yes_ask,
          no_bid: market.no_bid,
          no_ask: market.no_ask,
          last_price: market.last_price,
          volume: market.volume,
          volume_24h: market.volume_24h,
          open_interest: market.open_interest,
          open_time: market.open_time,
          close_time: market.close_time,
          expiration_time: market.expiration_time,
          result: market.result,
          category: market.category,
        };
      },
    },

    kalshi_get_orderbook: {
      name: 'kalshi_get_orderbook',
      description: 'Get the orderbook (bid/ask depth) for a specific market',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'The market ticker',
          },
          depth: {
            type: 'number',
            description: 'Number of price levels to return (default: 10)',
          },
        },
        required: ['ticker'],
      },
      execute: async (params: Record<string, unknown>) => {
        const orderbook = await service.getOrderbook(
          params.ticker as string,
          params.depth as number | undefined
        );
        return {
          ticker: orderbook.ticker,
          yes_bids: orderbook.yes.map((o) => ({ price_cents: o.price, count: o.count })),
          no_bids: orderbook.no.map((o) => ({ price_cents: o.price, count: o.count })),
        };
      },
    },

    kalshi_get_trades: {
      name: 'kalshi_get_trades',
      description: 'Get recent trades for a market - the public trade history',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Filter by market ticker',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of trades to return (default: 100)',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const trades = await service.getTrades({
          ticker: params.ticker as string | undefined,
          limit: params.limit as number | undefined,
        });
        return {
          trades: trades.trades.map((t) => ({
            trade_id: t.trade_id,
            ticker: t.ticker,
            count: t.count,
            price: t.price,
            side: t.side,
            taker_side: t.taker_side,
            created_time: t.created_time,
          })),
          cursor: trades.cursor,
        };
      },
    },

    kalshi_get_candlesticks: {
      name: 'kalshi_get_candlesticks',
      description: 'Get OHLCV candlestick data for a market - useful for charting price history',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'The market ticker',
          },
          period_interval: {
            type: 'number',
            description: 'Candle period in minutes (default: 60)',
          },
        },
        required: ['ticker'],
      },
      execute: async (params: Record<string, unknown>) => {
        const candlesticks = await service.getCandlesticks(params.ticker as string, {
          period_interval: params.period_interval as number | undefined,
        });
        return {
          candlesticks: candlesticks.map((c) => ({
            period_start: c.period_start,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            yes_bid: c.yes_bid,
            yes_ask: c.yes_ask,
          })),
        };
      },
    },

    kalshi_get_events: {
      name: 'kalshi_get_events',
      description:
        'Get Kalshi events - groups of related markets (e.g., "Bitcoin Price" event contains multiple strike price markets)',
      parameters: {
        type: 'object',
        properties: {
          series_ticker: {
            type: 'string',
            description: 'Filter by series ticker',
          },
          status: {
            type: 'string',
            enum: ['open', 'closed', 'settled'],
            description: 'Filter by event status',
          },
          with_nested_markets: {
            type: 'boolean',
            description: 'Include full market details in response',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of events to return (default: 100)',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const events = await service.getEvents({
          series_ticker: params.series_ticker as string | undefined,
          status: params.status as 'open' | 'closed' | 'settled' | undefined,
          with_nested_markets: params.with_nested_markets as boolean | undefined,
          limit: params.limit as number | undefined,
        });
        return {
          events: events.events.map((e) => ({
            event_ticker: e.event_ticker,
            series_ticker: e.series_ticker,
            title: e.title,
            subtitle: e.subtitle,
            category: e.category,
            status: e.status,
            mutually_exclusive: e.mutually_exclusive,
            market_count: e.markets.length,
          })),
          cursor: events.cursor,
        };
      },
    },

    kalshi_get_event: {
      name: 'kalshi_get_event',
      description: 'Get detailed information about a specific event and its markets',
      parameters: {
        type: 'object',
        properties: {
          event_ticker: {
            type: 'string',
            description: 'The event ticker (e.g., "KXBTC-25JAN03")',
          },
          with_nested_markets: {
            type: 'boolean',
            description: 'Include full market details in response',
          },
        },
        required: ['event_ticker'],
      },
      execute: async (params: Record<string, unknown>) => {
        const event = await service.getEvent(
          params.event_ticker as string,
          params.with_nested_markets as boolean | undefined
        );
        return {
          event_ticker: event.event_ticker,
          series_ticker: event.series_ticker,
          title: event.title,
          subtitle: event.subtitle,
          category: event.category,
          status: event.status,
          mutually_exclusive: event.mutually_exclusive,
          markets: event.markets,
        };
      },
    },

    kalshi_get_series: {
      name: 'kalshi_get_series',
      description:
        'Get Kalshi series - recurring event categories (e.g., "Bitcoin Price" series contains daily events)',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of series to return (default: 100)',
          },
        },
        required: [],
      },
      execute: async (params: Record<string, unknown>) => {
        const result = await service.getSeries({
          limit: params.limit as number | undefined,
        });
        return {
          series: result.series.map((s) => ({
            series_ticker: s.series_ticker,
            title: s.title,
            subtitle: s.subtitle,
            category: s.category,
            frequency: s.frequency,
            tags: s.tags,
          })),
          cursor: result.cursor,
        };
      },
    },
  };
}
