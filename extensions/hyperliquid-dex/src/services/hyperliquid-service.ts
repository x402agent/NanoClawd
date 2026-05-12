import { ethers } from 'ethers';
import axios, { AxiosInstance } from 'axios';
import {
  HyperliquidConfig,
  OrderRequest,
  OrderResponse,
  CancelOrderRequest,
  ClearinghouseState,
  AllMids,
  UserOpenOrders,
  UserFills,
  L2Book,
  CandleSnapshot,
  MetaAndAssetCtxs,
  SpotClearinghouseState,
  SpotMeta,
  PriceAlert,
  KlineInterval,
  Logger
} from '../types/index.js';

const BASE_URLS = {
  PRODUCTION: 'https://api.hyperliquid.xyz',
  TESTNET: 'https://api.hyperliquid-testnet.xyz',
};

const CHAIN_IDS = {
  ARBITRUM_MAINNET: '0xa4b1',
  ARBITRUM_TESTNET: '0x66eee',
};

/**
 * Hyperliquid DEX Service - handles all API communication
 */
export class HyperliquidService {
  private baseUrl: string;
  private wallet: ethers.Wallet;
  private walletAddress: string;
  private logger: Logger;
  private isMainnet: boolean;
  private client: AxiosInstance;
  private alerts: Map<string, PriceAlert> = new Map();
  private alertCheckInterval?: NodeJS.Timeout;

  // Nonce management
  private lastNonceTimestamp = 0;

  constructor(config: HyperliquidConfig, logger: Logger) {
    this.isMainnet = !config.testnet;
    this.baseUrl = this.isMainnet ? BASE_URLS.PRODUCTION : BASE_URLS.TESTNET;
    this.walletAddress = config.walletAddress;
    this.logger = logger;

    // Format private key
    const formattedKey = config.privateKey.startsWith('0x')
      ? config.privateKey
      : `0x${config.privateKey}`;
    this.wallet = new ethers.Wallet(formattedKey);

    // Create axios client
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.info('[hyperliquid] Service initialized');
  }

  /**
   * Generate unique nonce
   */
  private generateNonce(): number {
    const timestamp = Date.now();
    if (timestamp <= this.lastNonceTimestamp) {
      this.lastNonceTimestamp += 1;
      return this.lastNonceTimestamp;
    }
    this.lastNonceTimestamp = timestamp;
    return timestamp;
  }

  /**
   * Sign L1 action
   */
  private async signL1Action(action: any, vaultAddress: string | null, nonce: number): Promise<string> {
    const phantomAgent = {
      source: this.isMainnet ? 'a' : 'b',
      connectionId: vaultAddress
        ? ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address'],
            [this.wallet.address, vaultAddress]
          ))
        : ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ['address'],
            [this.wallet.address]
          )),
    };

    const actionHash = this.actionHash(action, vaultAddress, nonce);
    const toSign = ethers.solidityPackedKeccak256(
      ['bytes32', 'bytes32'],
      [actionHash, ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(phantomAgent)))]
    );

    const signature = await this.wallet.signMessage(ethers.getBytes(toSign));
    return signature;
  }

  /**
   * Create action hash
   */
  private actionHash(action: any, vaultAddress: string | null, nonce: number): string {
    const actionData = JSON.stringify(action);
    if (vaultAddress) {
      return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['string', 'uint64', 'address'],
          [actionData, nonce, vaultAddress]
        )
      );
    }
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'uint64'],
        [actionData, nonce]
      )
    );
  }

  /**
   * Test connectivity
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.post('/info', { type: 'meta' });
      return true;
    } catch (error) {
      this.logger.error('[hyperliquid] Ping failed:', error);
      return false;
    }
  }

  /**
   * INFO API METHODS
   */

  /**
   * Get all mid prices
   */
  async getAllMids(): Promise<AllMids> {
    const response = await this.client.post('/info', { type: 'allMids' });
    return response.data;
  }

  /**
   * Get perpetuals meta and asset contexts
   */
  async getMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs> {
    const response = await this.client.post('/info', { type: 'metaAndAssetCtxs' });
    return response.data;
  }

  /**
   * Get clearinghouse state (positions)
   */
  async getClearinghouseState(user?: string): Promise<ClearinghouseState> {
    const response = await this.client.post('/info', {
      type: 'clearinghouseState',
      user: user || this.walletAddress,
    });
    return response.data;
  }

  /**
   * Get user open orders
   */
  async getUserOpenOrders(user?: string): Promise<UserOpenOrders> {
    const response = await this.client.post('/info', {
      type: 'openOrders',
      user: user || this.walletAddress,
    });
    return response.data;
  }

  /**
   * Get user fills
   */
  async getUserFills(user?: string): Promise<UserFills> {
    const response = await this.client.post('/info', {
      type: 'userFills',
      user: user || this.walletAddress,
    });
    return response.data;
  }

  /**
   * Get L2 order book
   */
  async getL2Book(coin: string, nSigFigs: number = 5): Promise<L2Book> {
    const response = await this.client.post('/info', {
      type: 'l2Book',
      coin,
      nSigFigs,
    });
    return response.data;
  }

  /**
   * Get candle snapshot (OHLCV)
   */
  async getCandleSnapshot(
    coin: string,
    interval: KlineInterval,
    startTime: number,
    endTime: number
  ): Promise<CandleSnapshot> {
    const response = await this.client.post('/info', {
      type: 'candleSnapshot',
      req: {
        coin,
        interval,
        startTime,
        endTime,
      },
    });
    return response.data;
  }

  /**
   * Get spot metadata
   */
  async getSpotMeta(): Promise<SpotMeta> {
    const response = await this.client.post('/info', { type: 'spotMeta' });
    return response.data;
  }

  /**
   * Get spot clearinghouse state
   */
  async getSpotClearinghouseState(user?: string): Promise<SpotClearinghouseState> {
    const response = await this.client.post('/info', {
      type: 'spotClearinghouseState',
      user: user || this.walletAddress,
    });
    return response.data;
  }

  /**
   * EXCHANGE API METHODS
   */

  /**
   * Place an order
   */
  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    this.logger.info(`[hyperliquid] Placing ${orderRequest.is_buy ? 'BUY' : 'SELL'} order for ${orderRequest.coin}`);

    // Get asset index
    const meta = await this.getMetaAndAssetCtxs();
    const assetIndex = meta[0].universe.findIndex(a => a.name === orderRequest.coin);
    if (assetIndex === -1) {
      throw new Error(`Unknown asset: ${orderRequest.coin}`);
    }

    // Convert order to wire format
    const orderWire = {
      a: assetIndex,
      b: orderRequest.is_buy,
      p: String(orderRequest.limit_px),
      s: String(orderRequest.sz),
      r: orderRequest.reduce_only,
      t: orderRequest.order_type,
      c: orderRequest.cloid,
    };

    const action = {
      type: 'order',
      orders: [orderWire],
      grouping: 'na',
    };

    const nonce = this.generateNonce();
    const signature = await this.signL1Action(action, null, nonce);

    const response = await this.client.post('/exchange', {
      action,
      nonce,
      signature,
    });

    return response.data;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(coin: string, oid: number): Promise<OrderResponse> {
    this.logger.info(`[hyperliquid] Canceling order ${oid} for ${coin}`);

    // Get asset index
    const meta = await this.getMetaAndAssetCtxs();
    const assetIndex = meta[0].universe.findIndex(a => a.name === coin);
    if (assetIndex === -1) {
      throw new Error(`Unknown asset: ${coin}`);
    }

    const action = {
      type: 'cancel',
      cancels: [{ a: assetIndex, o: oid }],
    };

    const nonce = this.generateNonce();
    const signature = await this.signL1Action(action, null, nonce);

    const response = await this.client.post('/exchange', {
      action,
      nonce,
      signature,
    });

    return response.data;
  }

  /**
   * Cancel all orders for a symbol
   */
  async cancelAllOrders(coin?: string): Promise<{ cancelled: number }> {
    const orders = await this.getUserOpenOrders();
    const toCancel = coin ? orders.filter(o => o.coin === coin) : orders;

    let cancelled = 0;
    for (const order of toCancel) {
      try {
        await this.cancelOrder(order.coin, order.oid);
        cancelled++;
      } catch (error) {
        this.logger.error(`[hyperliquid] Failed to cancel order ${order.oid}:`, error);
      }
    }

    return { cancelled };
  }

  /**
   * Update leverage
   */
  async setLeverage(coin: string, leverage: number, isCross: boolean = true): Promise<any> {
    this.logger.info(`[hyperliquid] Setting leverage ${leverage}x for ${coin}`);

    // Get asset index
    const meta = await this.getMetaAndAssetCtxs();
    const assetIndex = meta[0].universe.findIndex(a => a.name === coin);
    if (assetIndex === -1) {
      throw new Error(`Unknown asset: ${coin}`);
    }

    const action = {
      type: 'updateLeverage',
      asset: assetIndex,
      isCross,
      leverage,
    };

    const nonce = this.generateNonce();
    const signature = await this.signL1Action(action, null, nonce);

    const response = await this.client.post('/exchange', {
      action,
      nonce,
      signature,
    });

    return response.data;
  }

  /**
   * Market open helper - places IOC order at slippage price
   */
  async marketOpen(
    coin: string,
    isBuy: boolean,
    size: number,
    slippage: number = 0.05
  ): Promise<OrderResponse> {
    // Get current price
    const mids = await this.getAllMids();
    let price = parseFloat(mids[coin]);

    // Apply slippage
    price = isBuy ? price * (1 + slippage) : price * (1 - slippage);

    // Round to reasonable decimals
    const decimals = price.toString().split('.')[1]?.length || 2;
    price = Number(price.toFixed(Math.max(0, decimals - 1)));

    const orderRequest: OrderRequest = {
      coin,
      is_buy: isBuy,
      sz: size,
      limit_px: price,
      order_type: { limit: { tif: 'Ioc' } },
      reduce_only: false,
    };

    return this.placeOrder(orderRequest);
  }

  /**
   * Market close helper - closes position with IOC order
   */
  async marketClose(
    coin: string,
    size?: number,
    slippage: number = 0.05
  ): Promise<OrderResponse> {
    // Get current position
    const state = await this.getClearinghouseState();
    const position = state.assetPositions.find(p => p.position.coin === coin);

    if (!position || parseFloat(position.position.szi) === 0) {
      throw new Error(`No position found for ${coin}`);
    }

    const szi = parseFloat(position.position.szi);
    const closeSize = size || Math.abs(szi);
    const isBuy = szi < 0; // If short, we need to buy to close

    // Get current price and apply slippage
    const mids = await this.getAllMids();
    let price = parseFloat(mids[coin]);
    price = isBuy ? price * (1 + slippage) : price * (1 - slippage);

    const decimals = price.toString().split('.')[1]?.length || 2;
    price = Number(price.toFixed(Math.max(0, decimals - 1)));

    const orderRequest: OrderRequest = {
      coin,
      is_buy: isBuy,
      sz: closeSize,
      limit_px: price,
      order_type: { limit: { tif: 'Ioc' } },
      reduce_only: true,
    };

    return this.placeOrder(orderRequest);
  }

  /**
   * ALERT SYSTEM
   */

  /**
   * Create a price alert
   */
  createAlert(
    symbol: string,
    targetPrice: string,
    condition: 'ABOVE' | 'BELOW'
  ): PriceAlert {
    const alert: PriceAlert = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      targetPrice,
      condition,
      active: true,
      createdAt: Date.now()
    };

    this.alerts.set(alert.id, alert);
    this.logger.info(`[hyperliquid] Created alert: ${symbol} ${condition} ${targetPrice}`);

    if (!this.alertCheckInterval) {
      this.startAlertMonitoring();
    }

    return alert;
  }

  /**
   * Remove an alert
   */
  removeAlert(alertId: string): boolean {
    const removed = this.alerts.delete(alertId);
    if (removed) {
      this.logger.info(`[hyperliquid] Removed alert: ${alertId}`);
    }

    if (this.alerts.size === 0 && this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
    }

    return removed;
  }

  /**
   * Get all active alerts
   */
  getAlerts(): PriceAlert[] {
    return Array.from(this.alerts.values()).filter(a => a.active);
  }

  /**
   * Start monitoring alerts
   */
  private startAlertMonitoring(): void {
    this.alertCheckInterval = setInterval(async () => {
      for (const alert of this.alerts.values()) {
        if (!alert.active) continue;

        try {
          const mids = await this.getAllMids();
          const currentPrice = parseFloat(mids[alert.symbol]);
          const targetPrice = parseFloat(alert.targetPrice);

          let triggered = false;
          if (alert.condition === 'ABOVE' && currentPrice >= targetPrice) {
            triggered = true;
          } else if (alert.condition === 'BELOW' && currentPrice <= targetPrice) {
            triggered = true;
          }

          if (triggered) {
            alert.triggeredAt = Date.now();
            alert.active = false;
            this.logger.info(
              `[hyperliquid] ALERT: ${alert.symbol} is ${alert.condition} ${alert.targetPrice} (current: ${currentPrice})`
            );
          }
        } catch (error) {
          this.logger.error(`[hyperliquid] Alert check failed for ${alert.symbol}:`, error);
        }
      }
    }, 10000);
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.walletAddress;
  }

  /**
   * Check if mainnet
   */
  getIsMainnet(): boolean {
    return this.isMainnet;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
    }
    this.alerts.clear();
    this.logger.info('[hyperliquid] Service destroyed');
  }
}
