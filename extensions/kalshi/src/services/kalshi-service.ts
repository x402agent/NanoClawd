import axios, { AxiosInstance } from 'axios';
import * as crypto from 'node:crypto';

import {
  KalshiConfig,
  Logger,
  ExchangeStatus,
  ExchangeAnnouncement,
  Market,
  MarketOrderbook,
  Trade,
  Event,
  Order,
  CreateOrderRequest,
  Balance,
  Position,
  Fill,
  Settlement,
  Series,
  Candlestick,
  MarketsResponse,
  EventsResponse,
  OrdersResponse,
  PositionsResponse,
  FillsResponse,
  SettlementsResponse,
  TradesResponse,
} from '../types/index.js';

const DEFAULT_BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

export class KalshiService {
  private client: AxiosInstance;
  private apiKey: string;
  private privateKey: string;
  private logger: Logger;

  constructor(config: KalshiConfig, logger: Logger) {
    this.apiKey = config.apiKey;
    this.privateKey = config.privateKey;
    this.logger = logger;

    this.client = axios.create({
      baseURL: config.baseUrl || DEFAULT_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use((requestConfig) => {
      const timestamp = Date.now();
      const method = requestConfig.method?.toUpperCase() || 'GET';
      const path = requestConfig.url || '';
      const body = requestConfig.data ? JSON.stringify(requestConfig.data) : '';

      const signature = this.generateSignature(timestamp, method, path, body);

      requestConfig.headers['KALSHI-ACCESS-KEY'] = this.apiKey;
      requestConfig.headers['KALSHI-ACCESS-SIGNATURE'] = signature;
      requestConfig.headers['KALSHI-ACCESS-TIMESTAMP'] = timestamp.toString();

      return requestConfig;
    });
  }

  /**
   * Generate RSA-PSS signature for Kalshi API authentication
   */
  private generateSignature(
    timestamp: number,
    method: string,
    path: string,
    body: string = ''
  ): string {
    // Message format: timestamp + method + path + body
    const message = `${timestamp}${method}${path}${body}`;

    try {
      // Create RSA-PSS signature
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(message);
      sign.end();

      const signature = sign.sign(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        },
        'base64'
      );

      return signature;
    } catch (error) {
      this.logger.error(`[kalshi] Failed to generate signature: ${error}`);
      throw error;
    }
  }

  // ==================== Exchange Methods ====================

  /**
   * Get exchange status
   */
  async getExchangeStatus(): Promise<ExchangeStatus> {
    const response = await this.client.get<ExchangeStatus>('/exchange/status');
    return response.data;
  }

  /**
   * Get exchange announcements
   */
  async getAnnouncements(): Promise<ExchangeAnnouncement[]> {
    const response = await this.client.get<{ announcements: ExchangeAnnouncement[] }>(
      '/exchange/announcements'
    );
    return response.data.announcements;
  }

  // ==================== Market Methods ====================

  /**
   * Get markets with optional filtering
   */
  async getMarkets(params?: {
    limit?: number;
    cursor?: string;
    event_ticker?: string;
    series_ticker?: string;
    status?: 'open' | 'closed' | 'settled';
    tickers?: string;
    min_close_ts?: number;
    max_close_ts?: number;
  }): Promise<MarketsResponse> {
    const response = await this.client.get<MarketsResponse>('/markets', { params });
    return response.data;
  }

  /**
   * Get a single market by ticker
   */
  async getMarket(ticker: string): Promise<Market> {
    const response = await this.client.get<{ market: Market }>(`/markets/${ticker}`);
    return response.data.market;
  }

  /**
   * Get market orderbook
   */
  async getOrderbook(ticker: string, depth?: number): Promise<MarketOrderbook> {
    const response = await this.client.get<{ orderbook: MarketOrderbook }>(
      `/markets/${ticker}/orderbook`,
      { params: { depth } }
    );
    return response.data.orderbook;
  }

  /**
   * Get market trades history
   */
  async getTrades(params?: {
    ticker?: string;
    limit?: number;
    cursor?: string;
    min_ts?: number;
    max_ts?: number;
  }): Promise<TradesResponse> {
    const response = await this.client.get<TradesResponse>('/markets/trades', { params });
    return response.data;
  }

  /**
   * Get market candlesticks
   */
  async getCandlesticks(
    ticker: string,
    params?: {
      start_ts?: number;
      end_ts?: number;
      period_interval?: number;
    }
  ): Promise<Candlestick[]> {
    const response = await this.client.get<{ candlesticks: Candlestick[] }>(
      `/markets/${ticker}/candlesticks`,
      { params }
    );
    return response.data.candlesticks;
  }

  // ==================== Event Methods ====================

  /**
   * Get events with optional filtering
   */
  async getEvents(params?: {
    limit?: number;
    cursor?: string;
    status?: 'open' | 'closed' | 'settled';
    series_ticker?: string;
    with_nested_markets?: boolean;
  }): Promise<EventsResponse> {
    const response = await this.client.get<EventsResponse>('/events', { params });
    return response.data;
  }

  /**
   * Get a single event by ticker
   */
  async getEvent(eventTicker: string, withNestedMarkets?: boolean): Promise<Event> {
    const response = await this.client.get<{ event: Event }>(`/events/${eventTicker}`, {
      params: { with_nested_markets: withNestedMarkets },
    });
    return response.data.event;
  }

  // ==================== Series Methods ====================

  /**
   * Get all series
   */
  async getSeries(params?: { limit?: number; cursor?: string }): Promise<{ series: Series[]; cursor?: string }> {
    const response = await this.client.get<{ series: Series[]; cursor?: string }>('/series', { params });
    return response.data;
  }

  /**
   * Get a single series by ticker
   */
  async getSeriesByTicker(seriesTicker: string): Promise<Series> {
    const response = await this.client.get<{ series: Series }>(`/series/${seriesTicker}`);
    return response.data.series;
  }

  // ==================== Portfolio Methods ====================

  /**
   * Get account balance
   */
  async getBalance(): Promise<Balance> {
    const response = await this.client.get<Balance>('/portfolio/balance');
    return response.data;
  }

  /**
   * Get portfolio positions
   */
  async getPositions(params?: {
    limit?: number;
    cursor?: string;
    settlement_status?: 'all' | 'unsettled' | 'settled';
    ticker?: string;
    event_ticker?: string;
    count_filter?: 'all' | 'position' | 'resting_order';
  }): Promise<PositionsResponse> {
    const response = await this.client.get<PositionsResponse>('/portfolio/positions', { params });
    return response.data;
  }

  /**
   * Get fills (trade executions)
   */
  async getFills(params?: {
    ticker?: string;
    order_id?: string;
    min_ts?: number;
    max_ts?: number;
    limit?: number;
    cursor?: string;
  }): Promise<FillsResponse> {
    const response = await this.client.get<FillsResponse>('/portfolio/fills', { params });
    return response.data;
  }

  /**
   * Get settlements
   */
  async getSettlements(params?: {
    limit?: number;
    cursor?: string;
    min_ts?: number;
    max_ts?: number;
  }): Promise<SettlementsResponse> {
    const response = await this.client.get<SettlementsResponse>('/portfolio/settlements', { params });
    return response.data;
  }

  // ==================== Order Methods ====================

  /**
   * Get orders
   */
  async getOrders(params?: {
    ticker?: string;
    event_ticker?: string;
    status?: 'resting' | 'canceled' | 'executed' | 'pending' | 'all';
    limit?: number;
    cursor?: string;
    min_ts?: number;
    max_ts?: number;
  }): Promise<OrdersResponse> {
    const response = await this.client.get<OrdersResponse>('/portfolio/orders', { params });
    return response.data;
  }

  /**
   * Get a single order by ID
   */
  async getOrder(orderId: string): Promise<Order> {
    const response = await this.client.get<{ order: Order }>(`/portfolio/orders/${orderId}`);
    return response.data.order;
  }

  /**
   * Create a new order
   */
  async createOrder(order: CreateOrderRequest): Promise<Order> {
    const response = await this.client.post<{ order: Order }>('/portfolio/orders', order);
    return response.data.order;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<{ order: Order; reduced_by: number }> {
    const response = await this.client.delete<{ order: Order; reduced_by: number }>(
      `/portfolio/orders/${orderId}`
    );
    return response.data;
  }

  /**
   * Amend an order (modify price or count)
   */
  async amendOrder(
    orderId: string,
    params: { price?: number; count?: number }
  ): Promise<Order> {
    const response = await this.client.post<{ order: Order }>(
      `/portfolio/orders/${orderId}/amend`,
      params
    );
    return response.data.order;
  }

  /**
   * Cancel all resting orders
   */
  async cancelAllOrders(params?: { ticker?: string; event_ticker?: string }): Promise<{ canceled_order_ids: string[] }> {
    const response = await this.client.delete<{ canceled_order_ids: string[] }>(
      '/portfolio/orders',
      { params }
    );
    return response.data;
  }

  // ==================== Utility Methods ====================

  /**
   * Test API connectivity
   */
  async ping(): Promise<boolean> {
    try {
      await this.getExchangeStatus();
      return true;
    } catch (error) {
      this.logger.error(`[kalshi] Ping failed: ${error}`);
      return false;
    }
  }

  /**
   * Get API key ID (for status display)
   */
  getApiKeyId(): string {
    return this.apiKey;
  }
}
