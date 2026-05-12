/**
 * Kalshi API Types
 */

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
}

export interface PluginContext {
  logger: Logger;
  registerTool: (tool: ClawdbotTool) => void;
}

export interface ClawdbotPlugin {
  name: string;
  version: string;
  description: string;
  activate: (context: PluginContext) => Promise<void>;
  deactivate?: () => Promise<void>;
  getStatus?: () => Promise<{ enabled: boolean; message: string; details?: Record<string, unknown> }>;
}

export interface ClawdbotTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface KalshiConfig {
  apiKey: string;
  privateKey: string;
  baseUrl?: string;
}

// Exchange Types
export interface ExchangeStatus {
  exchange_active: boolean;
  trading_active: boolean;
  exchange_estimated_resume_time?: string | null;
}

export interface ExchangeAnnouncement {
  type: 'info' | 'warning' | 'alert';
  message: string;
  delivery_time: string;
  status: 'active' | 'inactive';
}

// Market Types
export interface Market {
  ticker: string;
  event_ticker: string;
  subtitle: string;
  title: string;
  open_time: string;
  close_time: string;
  expiration_time: string;
  status: 'open' | 'closed' | 'settled';
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  volume_24h: number;
  open_interest: number;
  result?: 'yes' | 'no' | null;
  category?: string;
  series_ticker?: string;
}

export interface MarketOrderbook {
  ticker: string;
  yes: OrderbookSide[];
  no: OrderbookSide[];
}

export interface OrderbookSide {
  price: number;
  count: number;
}

export interface Trade {
  trade_id: string;
  ticker: string;
  count: number;
  price: number;
  side: 'yes' | 'no';
  created_time: string;
  taker_side: 'yes' | 'no';
}

// Event Types
export interface Event {
  event_ticker: string;
  series_ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  mutually_exclusive: boolean;
  status: 'open' | 'closed' | 'settled';
  markets: string[];
}

// Order Types
export interface Order {
  order_id: string;
  user_id: string;
  client_order_id?: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  type: 'limit' | 'market';
  status: 'resting' | 'canceled' | 'executed' | 'pending';
  yes_price?: number;
  no_price?: number;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  fill_count: number;
  fill_count_fp?: string;
  remaining_count: number;
  remaining_count_fp?: string;
  initial_count: number;
  initial_count_fp?: string;
  taker_fees: number;
  maker_fees: number;
  taker_fill_cost: number;
  maker_fill_cost: number;
  taker_fill_cost_dollars?: string;
  maker_fill_cost_dollars?: string;
  queue_position?: number;
  taker_fees_dollars?: string;
  maker_fees_dollars?: string;
  expiration_time?: string;
  created_time: string;
  last_update_time: string;
  self_trade_prevention_type?: 'taker_at_cross' | 'maker';
  order_group_id?: string;
  cancel_order_on_pause?: boolean;
}

export interface CreateOrderRequest {
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  type?: 'limit' | 'market';
  yes_price?: number;
  no_price?: number;
  client_order_id?: string;
  expiration_ts?: number;
  time_in_force?: 'fill_or_kill' | 'good_till_canceled' | 'immediate_or_cancel';
  buy_max_cost?: number;
  post_only?: boolean;
  reduce_only?: boolean;
  self_trade_prevention_type?: 'taker_at_cross' | 'maker';
  cancel_order_on_pause?: boolean;
  subaccount?: number;
}

// Portfolio Types
export interface Balance {
  balance: number;
  balance_dollars?: string;
  payout?: number;
  payout_dollars?: string;
}

export interface Position {
  ticker: string;
  event_ticker: string;
  event_title?: string;
  market_title?: string;
  market_subtitle?: string;
  position: number;
  position_fp?: string;
  total_cost: number;
  total_cost_dollars?: string;
  resting_orders_count?: number;
  realized_pnl?: number;
  realized_pnl_dollars?: string;
  fees_paid?: number;
  fees_paid_dollars?: string;
  market_exposure?: number;
  market_exposure_dollars?: string;
}

export interface Fill {
  trade_id: string;
  order_id: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  count_fp?: string;
  price: number;
  price_dollars?: string;
  is_taker: boolean;
  fee: number;
  fee_dollars?: string;
  created_time: string;
}

export interface Settlement {
  ticker: string;
  event_ticker: string;
  market_result: 'yes' | 'no';
  position_before_settlement: number;
  position_before_settlement_fp?: string;
  revenue: number;
  revenue_dollars?: string;
  settled_time: string;
}

// Series Types
export interface Series {
  series_ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  frequency?: string;
  tags?: string[];
}

// Candlestick Types
export interface Candlestick {
  ticker: string;
  period_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  yes_bid: number;
  yes_ask: number;
}

// API Response Types
export interface PaginatedResponse<T> {
  cursor?: string;
  [key: string]: T[] | string | undefined;
}

export interface MarketsResponse {
  markets: Market[];
  cursor?: string;
}

export interface EventsResponse {
  events: Event[];
  cursor?: string;
}

export interface OrdersResponse {
  orders: Order[];
  cursor?: string;
}

export interface PositionsResponse {
  positions: Position[];
  cursor?: string;
}

export interface FillsResponse {
  fills: Fill[];
  cursor?: string;
}

export interface SettlementsResponse {
  settlements: Settlement[];
  cursor?: string;
}

export interface TradesResponse {
  trades: Trade[];
  cursor?: string;
}
