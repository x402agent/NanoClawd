/**
 * Birdeye WebSocket Service
 * 
 * Real-time subscriptions for:
 * - Price updates (OHLCV)
 * - Token transactions
 * - New token listings (meme coins)
 * - New trading pairs
 * - Large trade alerts
 * - Wallet transaction monitoring
 * - Token stats updates
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionType =
  | 'SUBSCRIBE_PRICE'
  | 'SUBSCRIBE_TXS'
  | 'SUBSCRIBE_TOKEN_NEW_LISTING'
  | 'SUBSCRIBE_NEW_PAIR'
  | 'SUBSCRIBE_LARGE_TRADE_TXS'
  | 'SUBSCRIBE_WALLET_TXS'
  | 'SUBSCRIBE_TOKEN_STATS'
  | 'SUBSCRIBE_BASE_QUOTE_PRICE';

export interface PriceUpdate {
  type: 'PRICE_DATA';
  data: {
    o: number;      // Open
    h: number;      // High
    l: number;      // Low
    c: number;      // Close
    v: number;      // Volume
    unixTime: number;
    address: string;
    priceType: string;
    currency: string;
  };
}

export interface TransactionUpdate {
  type: 'TXS_DATA';
  data: {
    txHash: string;
    txType: string;
    blockUnixTime: number;
    source: string;
    volumeUSD: number;
    owner: string;
    side: 'buy' | 'sell';
    tokenAddress: string;
    from: {
      symbol: string;
      address: string;
      decimals: number;
      amount: string;
      uiAmount: number;
      price: number;
    };
    to: {
      symbol: string;
      address: string;
      decimals: number;
      amount: string;
      uiAmount: number;
      price: number;
    };
  };
}

export interface NewListingUpdate {
  type: 'TOKEN_NEW_LISTING';
  data: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    liquidity: number;
    mc: number;       // Market cap
    v24hUSD: number;  // 24h volume
    source: string;   // pumpfun, raydium, etc.
    createTime: number;
    logoURI?: string;
    pool?: string;
  };
}

export interface NewPairUpdate {
  type: 'NEW_PAIR_DATA';
  data: {
    address: string;
    name: string;
    source: string;
    base: {
      address: string;
      symbol: string;
      decimals: number;
    };
    quote: {
      address: string;
      symbol: string;
      decimals: number;
    };
    liquidity: number;
    createTime: number;
  };
}

export interface LargeTradeUpdate {
  type: 'LARGE_TRADE_TXS';
  data: {
    txHash: string;
    blockUnixTime: number;
    source: string;
    volumeUSD: number;
    owner: string;
    side: 'buy' | 'sell';
    from: {
      symbol: string;
      address: string;
      decimals: number;
      amount: string;
      uiAmount: number;
    };
    to: {
      symbol: string;
      address: string;
      decimals: number;
      amount: string;
      uiAmount: number;
    };
  };
}

export interface WalletTxUpdate {
  type: 'WALLET_TXS_DATA';
  data: {
    wallet: string;
    txHash: string;
    txType: string;
    blockUnixTime: number;
    source: string;
    volumeUSD: number;
    side: 'buy' | 'sell';
    tokenAddress: string;
    from: {
      symbol: string;
      address: string;
      amount: string;
      uiAmount: number;
    };
    to: {
      symbol: string;
      address: string;
      amount: string;
      uiAmount: number;
    };
  };
}

export interface TokenStatsUpdate {
  type: 'TOKEN_STATS_DATA';
  data: {
    address: string;
    price: number;
    priceChange24hPercent: number;
    liquidity: number;
    mc: number;
    v24hUSD: number;
    v24hChangePercent: number;
    trade24h: number;
    uniqueWallet24h: number;
    holder: number;
  };
}

export type WebSocketMessage =
  | PriceUpdate
  | TransactionUpdate
  | NewListingUpdate
  | NewPairUpdate
  | LargeTradeUpdate
  | WalletTxUpdate
  | TokenStatsUpdate
  | { type: 'SUBSCRIBE_SUCCESS'; data: { subscriptionId: string } }
  | { type: 'UNSUBSCRIBE_SUCCESS'; data: { subscriptionId: string } }
  | { type: 'ERROR'; data: { message: string } };

export interface SubscriptionOptions {
  // Common
  address?: string;   // Token or pair address
  addresses?: string[]; // Multiple addresses

  // Price subscription
  chartType?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  currency?: 'usd' | 'native';

  // New listing filters
  minLiquidity?: number;
  maxLiquidity?: number;
  sources?: string[];  // e.g., ['pumpfun', 'raydium']

  // Large trade threshold
  minVolumeUSD?: number;

  // Wallet tracking
  wallet?: string;
  wallets?: string[];
}

export interface Alert {
  id: string;
  type: 'price_above' | 'price_below' | 'volume_spike' | 'large_trade' | 'new_listing' | 'wallet_activity';
  tokenAddress?: string;
  walletAddress?: string;
  threshold: number;
  active: boolean;
  createdAt: number;
  triggeredAt?: number;
  callback?: (data: any) => void;
}

export interface BirdeyeWebSocketConfig {
  apiKey: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

// ============================================================================
// BIRDEYE WEBSOCKET SERVICE
// ============================================================================

export class BirdeyeWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private autoReconnect: boolean;
  private reconnectDelay: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  public isConnected = false;
  private subscriptions: Map<string, { type: SubscriptionType; options: SubscriptionOptions }> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private logger: any;

  constructor(config: BirdeyeWebSocketConfig, logger?: any) {
    super();
    this.apiKey = config.apiKey;
    this.autoReconnect = config.autoReconnect ?? true;
    this.reconnectDelay = config.reconnectDelay ?? 5000;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
    this.logger = logger || console;
  }

  // =========================================================================
  // CONNECTION MANAGEMENT
  // =========================================================================

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.isConnected) {
        resolve();
        return;
      }

      // Use BIRDEYE_WSS_URL from environment if available, otherwise construct URL
      const wsUrl = process.env.BIRDEYE_WSS_URL ||
        `wss://public-api.birdeye.so/socket/solana?x-api-key=${this.apiKey}`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.logger.info('[BirdeyeWS] Connected');
          this.emit('connected');
          this.startPing();

          // Resubscribe to all active subscriptions
          this.resubscribeAll();

          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as WebSocketMessage;
            this.handleMessage(message);
          } catch (error) {
            this.logger.error('[BirdeyeWS] Failed to parse message:', error);
          }
        });

        this.ws.on('close', (code, reason) => {
          this.isConnected = false;
          this.stopPing();
          this.logger.warn(`[BirdeyeWS] Disconnected: ${code} - ${reason}`);
          this.emit('disconnected', { code, reason: reason.toString() });

          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          this.logger.error('[BirdeyeWS] Error:', error);
          this.emit('error', error);

          if (!this.isConnected) {
            reject(error);
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.autoReconnect = false;
    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.subscriptions.clear();
    this.logger.info('[BirdeyeWS] Disconnected manually');
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    this.logger.info(`[BirdeyeWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error('[BirdeyeWS] Reconnect failed:', error);
      });
    }, delay);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private async resubscribeAll(): Promise<void> {
    for (const [id, sub] of this.subscriptions) {
      await this.sendSubscription(sub.type, sub.options, id);
    }
    this.logger.info(`[BirdeyeWS] Resubscribed to ${this.subscriptions.size} subscriptions`);
  }

  // =========================================================================
  // MESSAGE HANDLING
  // =========================================================================

  private handleMessage(message: WebSocketMessage): void {
    // Emit raw message for debugging
    this.emit('message', message);

    switch (message.type) {
      case 'SUBSCRIBE_SUCCESS':
        this.logger.debug(`[BirdeyeWS] Subscription success: ${message.data.subscriptionId}`);
        this.emit('subscribed', message.data.subscriptionId);
        break;

      case 'UNSUBSCRIBE_SUCCESS':
        this.logger.debug(`[BirdeyeWS] Unsubscription success: ${message.data.subscriptionId}`);
        this.emit('unsubscribed', message.data.subscriptionId);
        break;

      case 'ERROR':
        this.logger.error(`[BirdeyeWS] Error: ${message.data.message}`);
        this.emit('subscriptionError', message.data);
        break;

      case 'PRICE_DATA':
        this.emit('price', message.data);
        this.checkPriceAlerts(message.data);
        break;

      case 'TXS_DATA':
        this.emit('transaction', message.data);
        break;

      case 'TOKEN_NEW_LISTING':
        this.emit('newListing', message.data);
        this.checkNewListingAlerts(message.data);
        break;

      case 'NEW_PAIR_DATA':
        this.emit('newPair', message.data);
        break;

      case 'LARGE_TRADE_TXS':
        this.emit('largeTrade', message.data);
        this.checkLargeTradeAlerts(message.data);
        break;

      case 'WALLET_TXS_DATA':
        this.emit('walletTx', message.data);
        this.checkWalletAlerts(message.data);
        break;

      case 'TOKEN_STATS_DATA':
        this.emit('tokenStats', message.data);
        break;

      default:
        this.logger.debug('[BirdeyeWS] Unknown message type:', message);
    }
  }

  // =========================================================================
  // SUBSCRIPTIONS
  // =========================================================================

  private send(payload: any): void {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(payload));
  }

  private async sendSubscription(
    type: SubscriptionType,
    options: SubscriptionOptions,
    existingId?: string
  ): Promise<string> {
    const subscriptionId = existingId || `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload: any = {
      type,
      data: {
        subscriptionId,
        ...options,
      },
    };

    this.send(payload);

    if (!existingId) {
      this.subscriptions.set(subscriptionId, { type, options });
    }

    return subscriptionId;
  }

  /**
   * Subscribe to real-time price updates for a token
   */
  async subscribePrice(
    address: string,
    options: { chartType?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'; currency?: 'usd' | 'native' } = {}
  ): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_PRICE', {
      address,
      chartType: options.chartType || '1m',
      currency: options.currency || 'usd',
    });
  }

  /**
   * Subscribe to token transactions
   */
  async subscribeTransactions(address: string): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_TXS', { address });
  }

  /**
   * Subscribe to new token listings (meme coins from pumpfun, etc.)
   */
  async subscribeNewListings(
    options: { minLiquidity?: number; maxLiquidity?: number; sources?: string[] } = {}
  ): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_TOKEN_NEW_LISTING', {
      minLiquidity: options.minLiquidity,
      maxLiquidity: options.maxLiquidity,
      sources: options.sources,
    });
  }

  /**
   * Subscribe to new trading pairs
   */
  async subscribeNewPairs(options: { sources?: string[] } = {}): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_NEW_PAIR', {
      sources: options.sources,
    });
  }

  /**
   * Subscribe to large trades above a USD threshold
   */
  async subscribeLargeTrades(minVolumeUSD: number = 10000): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_LARGE_TRADE_TXS', {
      minVolumeUSD,
    });
  }

  /**
   * Subscribe to wallet transactions
   */
  async subscribeWalletTxs(wallet: string): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_WALLET_TXS', { wallet });
  }

  /**
   * Subscribe to multiple wallets
   */
  async subscribeWallets(wallets: string[]): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_WALLET_TXS', { wallets });
  }

  /**
   * Subscribe to token stats updates
   */
  async subscribeTokenStats(address: string): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_TOKEN_STATS', { address });
  }

  /**
   * Subscribe to base/quote pair price
   */
  async subscribeBaseQuotePrice(
    baseAddress: string,
    quoteAddress: string,
    options: { chartType?: '1m' | '5m' | '15m' | '1h' } = {}
  ): Promise<string> {
    if (!this.isConnected) await this.connect();
    return this.sendSubscription('SUBSCRIBE_BASE_QUOTE_PRICE', {
      addresses: [baseAddress, quoteAddress],
      chartType: options.chartType || '1m',
    });
  }

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subscriptionId: string): void {
    this.send({
      type: 'UNSUBSCRIBE',
      data: { subscriptionId },
    });
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    for (const id of this.subscriptions.keys()) {
      this.unsubscribe(id);
    }
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): Array<{ id: string; type: SubscriptionType; options: SubscriptionOptions }> {
    return Array.from(this.subscriptions.entries()).map(([id, sub]) => ({
      id,
      type: sub.type,
      options: sub.options,
    }));
  }

  // =========================================================================
  // ALERTS SYSTEM
  // =========================================================================

  /**
   * Create a price alert
   */
  createPriceAlert(
    tokenAddress: string,
    type: 'price_above' | 'price_below',
    threshold: number,
    callback?: (data: any) => void
  ): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const alert: Alert = {
      id: alertId,
      type,
      tokenAddress,
      threshold,
      active: true,
      createdAt: Date.now(),
      callback,
    };

    this.alerts.set(alertId, alert);
    this.logger.info(`[BirdeyeWS] Created price alert: ${type} $${threshold} for ${tokenAddress}`);

    // Ensure we're subscribed to the token's price
    this.subscribePrice(tokenAddress).catch((e) => {
      this.logger.error(`[BirdeyeWS] Failed to subscribe for alert: ${e}`);
    });

    return alertId;
  }

  /**
   * Create a large trade alert
   */
  createLargeTradeAlert(
    minVolumeUSD: number,
    callback?: (data: any) => void
  ): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const alert: Alert = {
      id: alertId,
      type: 'large_trade',
      threshold: minVolumeUSD,
      active: true,
      createdAt: Date.now(),
      callback,
    };

    this.alerts.set(alertId, alert);
    this.subscribeLargeTrades(minVolumeUSD).catch((e) => {
      this.logger.error(`[BirdeyeWS] Failed to subscribe for large trade alert: ${e}`);
    });

    return alertId;
  }

  /**
   * Create a new listing alert
   */
  createNewListingAlert(
    options: { minLiquidity?: number; maxLiquidity?: number; sources?: string[] } = {},
    callback?: (data: any) => void
  ): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const alert: Alert = {
      id: alertId,
      type: 'new_listing',
      threshold: options.minLiquidity || 0,
      active: true,
      createdAt: Date.now(),
      callback,
    };

    this.alerts.set(alertId, alert);
    this.subscribeNewListings(options).catch((e) => {
      this.logger.error(`[BirdeyeWS] Failed to subscribe for new listing alert: ${e}`);
    });

    return alertId;
  }

  /**
   * Create a wallet activity alert
   */
  createWalletAlert(
    walletAddress: string,
    callback?: (data: any) => void
  ): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const alert: Alert = {
      id: alertId,
      type: 'wallet_activity',
      walletAddress,
      threshold: 0,
      active: true,
      createdAt: Date.now(),
      callback,
    };

    this.alerts.set(alertId, alert);
    this.subscribeWalletTxs(walletAddress).catch((e) => {
      this.logger.error(`[BirdeyeWS] Failed to subscribe for wallet alert: ${e}`);
    });

    return alertId;
  }

  /**
   * Delete an alert
   */
  deleteAlert(alertId: string): boolean {
    return this.alerts.delete(alertId);
  }

  /**
   * Get all active alerts
   */
  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get active alerts (alias for getAlerts)
   */
  getActiveAlerts(): Alert[] {
    return this.getAlerts();
  }

  /**
   * Create a whale alert (alias for createLargeTradeAlert)
   */
  createWhaleAlert(
    tokenAddress: string,
    minVolumeUSD: number,
    callback?: (data: any) => void
  ): string {
    return this.createLargeTradeAlert(minVolumeUSD, callback);
  }

  /**
   * Deactivate an alert without deleting
   */
  deactivateAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.active = false;
    }
  }

  // Alert checking methods
  private checkPriceAlerts(data: PriceUpdate['data']): void {
    for (const alert of this.alerts.values()) {
      if (!alert.active || !alert.tokenAddress) continue;
      if (alert.tokenAddress !== data.address) continue;

      const price = data.c; // Close price
      let triggered = false;

      if (alert.type === 'price_above' && price >= alert.threshold) {
        triggered = true;
      } else if (alert.type === 'price_below' && price <= alert.threshold) {
        triggered = true;
      }

      if (triggered) {
        alert.triggeredAt = Date.now();
        alert.active = false; // One-shot alert

        const alertData = {
          alert,
          price,
          tokenAddress: data.address,
          timestamp: data.unixTime,
        };

        this.emit('alertTriggered', alertData);
        alert.callback?.(alertData);

        this.logger.info(`[BirdeyeWS] 🚨 Alert triggered: ${alert.type} at $${price}`);
      }
    }
  }

  private checkLargeTradeAlerts(data: LargeTradeUpdate['data']): void {
    for (const alert of this.alerts.values()) {
      if (!alert.active || alert.type !== 'large_trade') continue;

      if (data.volumeUSD >= alert.threshold) {
        const alertData = {
          alert,
          trade: data,
          timestamp: Date.now(),
        };

        this.emit('alertTriggered', alertData);
        alert.callback?.(alertData);

        this.logger.info(`[BirdeyeWS] 🐋 Large trade alert: $${data.volumeUSD.toFixed(0)} ${data.side}`);
      }
    }
  }

  private checkNewListingAlerts(data: NewListingUpdate['data']): void {
    for (const alert of this.alerts.values()) {
      if (!alert.active || alert.type !== 'new_listing') continue;

      // Already filtered by subscription options, just emit
      const alertData = {
        alert,
        token: data,
        timestamp: Date.now(),
      };

      this.emit('alertTriggered', alertData);
      alert.callback?.(alertData);

      this.logger.info(`[BirdeyeWS] 🆕 New listing: ${data.symbol} (${data.name}) - $${data.liquidity?.toFixed(0)} liquidity`);
    }
  }

  private checkWalletAlerts(data: WalletTxUpdate['data']): void {
    for (const alert of this.alerts.values()) {
      if (!alert.active || alert.type !== 'wallet_activity') continue;
      if (alert.walletAddress !== data.wallet) continue;

      const alertData = {
        alert,
        transaction: data,
        timestamp: Date.now(),
      };

      this.emit('alertTriggered', alertData);
      alert.callback?.(alertData);

      this.logger.info(`[BirdeyeWS] 👛 Wallet activity: ${data.wallet.slice(0, 8)}... ${data.side} $${data.volumeUSD?.toFixed(2)}`);
    }
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  getConnectionStatus(): { connected: boolean; subscriptions: number; alerts: number } {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      alerts: this.alerts.size,
    };
  }
}

// Singleton instance
let wsService: BirdeyeWebSocketService | null = null;

export function getBirdeyeWebSocket(): BirdeyeWebSocketService | null {
  return wsService;
}

export function setBirdeyeWebSocket(service: BirdeyeWebSocketService): void {
  wsService = service;
}

export function initBirdeyeWebSocket(apiKey: string, logger?: any): BirdeyeWebSocketService {
  wsService = new BirdeyeWebSocketService({ apiKey }, logger);
  return wsService;
}

export default BirdeyeWebSocketService;
