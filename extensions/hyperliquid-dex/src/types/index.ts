// Logger interface
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

// Plugin context
export interface PluginContext {
  logger: Logger;
  registerTool(tool: unknown): void;
  log(message: string, ...args: unknown[]): void;
}

// Clawdbot plugin interface
export interface ClawdbotPlugin {
  name: string;
  version: string;
  description: string;
  configSchema?: {
    type: string;
    properties: Record<string, unknown>;
    additionalProperties?: boolean;
  };
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
  getStatus(): Promise<{
    enabled: boolean;
    message: string;
    details?: Record<string, unknown>;
  }>;
}

// Hyperliquid Configuration
export interface HyperliquidConfig {
  walletAddress: string;
  privateKey: string;
  testnet?: boolean;
  enableWs?: boolean;
  rpcUrl?: string;
  wssUrl?: string;
}

// Order types
export type Tif = 'Alo' | 'Ioc' | 'Gtc';
export type TriggerType = 'tp' | 'sl';
export type OrderSide = 'BUY' | 'SELL';
export type PositionSide = 'LONG' | 'SHORT' | 'BOTH';

export interface LimitOrder {
  tif: Tif;
}

export interface TriggerOrder {
  triggerPx: string | number;
  isMarket: boolean;
  tpsl: TriggerType;
}

export type OrderType = {
  limit?: LimitOrder;
  trigger?: TriggerOrder;
};

// Order request
export interface OrderRequest {
  coin: string;
  is_buy: boolean;
  sz: number | string;
  limit_px: number | string;
  order_type: OrderType;
  reduce_only: boolean;
  cloid?: string;
}

// Order response
export interface OrderResponse {
  status: string;
  response: {
    type: string;
    data: {
      statuses: Array<{
        resting?: { oid: number };
        filled?: {
          oid: number;
          totalSz: string;
          avgPx: string;
        };
        error?: string;
      }>;
    };
  };
}

// Cancel order request
export interface CancelOrderRequest {
  coin: string;
  o: number;
}

// Position info
export interface PositionInfo {
  coin: string;
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  liquidationPx: string;
  leverage: {
    type: string;
    value: number;
    rawUsd: string;
  };
  marginUsed: string;
  maxLeverage: number;
  returnOnEquity: string;
  cumFunding: {
    allTime: string;
    sinceChange: string;
    sinceOpen: string;
  };
}

// Clearinghouse state (account state)
export interface ClearinghouseState {
  assetPositions: {
    position: PositionInfo;
    type: string;
  }[];
  crossMaintenanceMarginUsed: string;
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  marginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  time: number;
  withdrawable: string;
}

// All mids (prices)
export interface AllMids {
  [coin: string]: string;
}

// User open orders
export interface UserOpenOrder {
  coin: string;
  limitPx: string;
  oid: number;
  side: string;
  sz: string;
  timestamp: number;
}

export type UserOpenOrders = UserOpenOrder[];

// User fills
export interface UserFill {
  closedPnl: string;
  coin: string;
  crossed: boolean;
  dir: string;
  hash: string;
  oid: number;
  px: string;
  side: string;
  startPosition: string;
  sz: string;
  time: number;
  fee: string;
  feeToken: string;
  tid: number;
}

export type UserFills = UserFill[];

// L2 Order Book
export interface L2BookLevel {
  px: string;
  sz: string;
  n: number;
}

export interface L2Book {
  levels: [L2BookLevel[], L2BookLevel[]];
}

// Candle/Kline data
export interface Candle {
  t: number;  // open time
  T: number;  // close time
  s: string;  // symbol
  i: string;  // interval
  o: number;  // open
  c: number;  // close
  h: number;  // high
  l: number;  // low
  v: number;  // volume
  n: number;  // number of trades
}

export type CandleSnapshot = Candle[];

// Meta information
export interface AssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

export interface Meta {
  universe: AssetMeta[];
}

// Asset context (market data)
export interface AssetCtx {
  dayBaseVlm: string;
  dayNtlVlm: string;
  funding: string;
  impactPxs: [string, string];
  markPx: string;
  midPx: string;
  openInterest: string;
  oraclePx: string;
  premium: string;
  prevDayPx: string;
}

export type MetaAndAssetCtxs = [Meta, AssetCtx[]];

// Spot types
export interface SpotToken {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  tokenId: string;
  isCanonical: boolean;
}

export interface SpotMarket {
  name: string;
  tokens: [number, number];
  index: number;
  isCanonical: boolean;
}

export interface SpotMeta {
  tokens: SpotToken[];
  universe: SpotMarket[];
}

export interface SpotBalance {
  coin: string;
  hold: string;
  total: string;
}

export interface SpotClearinghouseState {
  balances: SpotBalance[];
}

// Price alert
export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: string;
  condition: 'ABOVE' | 'BELOW';
  active: boolean;
  createdAt: number;
  triggeredAt?: number;
}

// Kline interval
export type KlineInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';
