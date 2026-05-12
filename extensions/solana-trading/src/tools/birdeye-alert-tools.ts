/**
 * Birdeye Alert Tools
 * Real-time WebSocket alerts for price movements, whale trades, new listings, and wallet activity
 */

import { z } from 'zod';
import type { ToolDependencies } from './index.js';
import { BirdeyeWebSocketService } from '../services/birdeye-websocket.js';

// Singleton service instance
let birdeyeWS: BirdeyeWebSocketService | null = null;

export function setBirdeyeWebSocketService(service: BirdeyeWebSocketService) {
  birdeyeWS = service;
}

export function createBirdeyeAlertTools(deps: ToolDependencies) {
  return [
    {
      name: 'birdeye_create_price_alert',
      description: 'Create a real-time price alert for a Solana token. Get notified when price crosses a threshold.',
      inputSchema: z.object({
        tokenAddress: z.string().describe('Token mint address'),
        type: z.enum(['price_above', 'price_below']).describe('Alert when price goes above or below threshold'),
        threshold: z.number().describe('Price threshold in USD (e.g., 0.0001)'),
      }),
      async execute({ tokenAddress, type, threshold }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized. Set BIRDEYE_API_KEY and restart gateway.');
        }

        try {
          if (!birdeyeWS.isConnected) {
            await birdeyeWS.connect();
          }

          const alertId = birdeyeWS.createPriceAlert(tokenAddress, type, threshold);

          return {
            success: true,
            alertId,
            tokenAddress,
            type,
            threshold,
            message: `✅ Price alert created! You'll be notified when ${tokenAddress} ${type === 'price_above' ? 'exceeds' : 'drops below'} $${threshold}`,
          };
        } catch (error: any) {
          deps.logger.error(`[birdeye-alerts] Failed to create price alert: ${error.message}`);
          throw new Error(`Failed to create price alert: ${error.message}`);
        }
      },
    },

    {
      name: 'birdeye_create_whale_alert',
      description: 'Monitor large trades (whale activity) for a Solana token. Get notified of significant buys/sells.',
      inputSchema: z.object({
        tokenAddress: z.string().describe('Token mint address to monitor'),
        minAmountUSD: z.number().describe('Minimum trade size in USD to alert on (e.g., 10000 for $10k+ trades)'),
      }),
      async execute({ tokenAddress, minAmountUSD }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized. Set BIRDEYE_API_KEY and restart gateway.');
        }

        try {
          if (!birdeyeWS.isConnected) {
            await birdeyeWS.connect();
          }

          const alertId = birdeyeWS.createWhaleAlert(tokenAddress, minAmountUSD);

          return {
            success: true,
            alertId,
            tokenAddress,
            minAmountUSD,
            message: `🐳 Whale alert created! You'll be notified of trades ≥$${minAmountUSD.toLocaleString()} on ${tokenAddress}`,
          };
        } catch (error: any) {
          deps.logger.error(`[birdeye-alerts] Failed to create whale alert: ${error.message}`);
          throw new Error(`Failed to create whale alert: ${error.message}`);
        }
      },
    },

    {
      name: 'birdeye_create_new_listing_alert',
      description: 'Get notified of new Solana token listings on DEXs. Catch new launches early.',
      inputSchema: z.object({
        minLiquidityUSD: z.number().optional().describe('Minimum initial liquidity in USD (e.g., 5000). Filters out low-quality launches.'),
      }),
      async execute({ minLiquidityUSD = 1000 }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized. Set BIRDEYE_API_KEY and restart gateway.');
        }

        try {
          if (!birdeyeWS.isConnected) {
            await birdeyeWS.connect();
          }

          const alertId = birdeyeWS.createNewListingAlert({ minLiquidity: minLiquidityUSD });

          return {
            success: true,
            alertId,
            minLiquidityUSD,
            message: `🆕 New listing alerts enabled! You'll be notified of new tokens with ≥$${minLiquidityUSD.toLocaleString()} liquidity`,
          };
        } catch (error: any) {
          deps.logger.error(`[birdeye-alerts] Failed to create new listing alert: ${error.message}`);
          throw new Error(`Failed to create new listing alert: ${error.message}`);
        }
      },
    },

    {
      name: 'birdeye_create_wallet_alert',
      description: 'Track a specific Solana wallet and get notified of their trades. Follow smart money.',
      inputSchema: z.object({
        walletAddress: z.string().describe('Wallet address to track'),
        minAmountUSD: z.number().optional().describe('Minimum trade size to alert on (default: $1000)'),
      }),
      async execute({ walletAddress, minAmountUSD = 1000 }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized. Set BIRDEYE_API_KEY and restart gateway.');
        }

        try {
          if (!birdeyeWS.isConnected) {
            await birdeyeWS.connect();
          }

          const alertId = birdeyeWS.createWalletAlert(walletAddress);

          return {
            success: true,
            alertId,
            walletAddress,
            minAmountUSD,
            message: `👛 Wallet alert created! You'll be notified when ${walletAddress} makes trades ≥$${minAmountUSD.toLocaleString()}`,
          };
        } catch (error: any) {
          deps.logger.error(`[birdeye-alerts] Failed to create wallet alert: ${error.message}`);
          throw new Error(`Failed to create wallet alert: ${error.message}`);
        }
      },
    },

    {
      name: 'birdeye_list_alerts',
      description: 'List all active Birdeye alerts (price, whale, new listing, wallet tracking)',
      inputSchema: z.object({
        type: z.enum(['price', 'whale', 'new_listing', 'wallet', 'all']).optional()
          .describe('Filter by alert type (default: all)'),
      }),
      async execute({ type = 'all' }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized');
        }

        const alerts = birdeyeWS.getActiveAlerts();

        const filtered = type === 'all'
          ? alerts
          : alerts.filter((a: any) => {
            if (type === 'price') return a.type === 'price_above' || a.type === 'price_below';
            if (type === 'whale') return a.type === 'large_trade';
            if (type === 'new_listing') return a.type === 'new_listing';
            if (type === 'wallet') return a.type === 'wallet_activity';
            return false;
          });

        return {
          success: true,
          totalAlerts: alerts.length,
          filteredAlerts: filtered.length,
          alerts: filtered.map((alert: any) => ({
            id: alert.id,
            type: alert.type,
            tokenAddress: alert.tokenAddress,
            threshold: alert.threshold,
            active: alert.active,
            triggered: alert.triggeredAt ? true : false,
            createdAt: new Date(alert.createdAt).toISOString(),
          })),
          isConnected: birdeyeWS.isConnected,
        };
      },
    },

    {
      name: 'birdeye_delete_alert',
      description: 'Delete an active Birdeye alert by ID',
      inputSchema: z.object({
        alertId: z.string().describe('Alert ID to delete'),
      }),
      async execute({ alertId }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized');
        }

        const deleted = birdeyeWS.deleteAlert(alertId);

        if (!deleted) {
          throw new Error(`Alert ${alertId} not found`);
        }

        return {
          success: true,
          alertId,
          message: `Alert ${alertId} deleted successfully`,
        };
      },
    },

    {
      name: 'birdeye_subscribe_price',
      description: 'Subscribe to real-time OHLCV price updates for a token (1m, 5m, 15m, 1H, 4H, 1D)',
      inputSchema: z.object({
        tokenAddress: z.string().describe('Token mint address'),
        chartType: z.enum(['1m', '5m', '15m', '1H', '4H', '1D']).optional()
          .describe('Candlestick interval (default: 1m)'),
      }),
      async execute({ tokenAddress, chartType = '1m' }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized');
        }

        try {
          if (!birdeyeWS.isConnected) {
            await birdeyeWS.connect();
          }

          const subscriptionId = await birdeyeWS.subscribePrice(tokenAddress, { chartType });

          return {
            success: true,
            subscriptionId,
            tokenAddress,
            chartType,
            message: `📊 Subscribed to ${chartType} price updates for ${tokenAddress}`,
          };
        } catch (error: any) {
          deps.logger.error(`[birdeye-alerts] Failed to subscribe to price: ${error.message}`);
          throw new Error(`Failed to subscribe to price: ${error.message}`);
        }
      },
    },

    {
      name: 'birdeye_subscribe_transactions',
      description: 'Subscribe to real-time transaction feed for a token',
      inputSchema: z.object({
        tokenAddress: z.string().describe('Token mint address'),
      }),
      async execute({ tokenAddress }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized');
        }

        try {
          if (!birdeyeWS.isConnected) {
            await birdeyeWS.connect();
          }

          const subscriptionId = await birdeyeWS.subscribeTransactions(tokenAddress);

          return {
            success: true,
            subscriptionId,
            tokenAddress,
            message: `🔄 Subscribed to transaction feed for ${tokenAddress}`,
          };
        } catch (error: any) {
          deps.logger.error(`[birdeye-alerts] Failed to subscribe to transactions: ${error.message}`);
          throw new Error(`Failed to subscribe to transactions: ${error.message}`);
        }
      },
    },

    {
      name: 'birdeye_unsubscribe',
      description: 'Unsubscribe from a price/transaction feed',
      inputSchema: z.object({
        subscriptionId: z.string().describe('Subscription ID to cancel'),
      }),
      async execute({ subscriptionId }: any) {
        if (!birdeyeWS) {
          throw new Error('Birdeye WebSocket service not initialized');
        }

        birdeyeWS.unsubscribe(subscriptionId);

        return {
          success: true,
          subscriptionId,
          message: `Unsubscribed from ${subscriptionId}`,
        };
      },
    },

    {
      name: 'birdeye_connection_status',
      description: 'Check Birdeye WebSocket connection status and active subscriptions',
      inputSchema: z.object({}),
      async execute() {
        if (!birdeyeWS) {
          return {
            initialized: false,
            message: 'Birdeye WebSocket service not initialized. Set BIRDEYE_API_KEY environment variable.',
          };
        }

        const alerts = birdeyeWS.getActiveAlerts();
        const subscriptions = birdeyeWS.getActiveSubscriptions();

        return {
          initialized: true,
          connected: birdeyeWS.isConnected,
          activeAlerts: alerts.length,
          alerts: alerts.map((a: any) => ({ id: a.id, type: a.type, active: a.active })),
          activeSubscriptions: subscriptions.length,
          subscriptions: subscriptions.map(s => ({ id: s.id, type: s.type })),
          message: birdeyeWS.isConnected
            ? `✅ Connected with ${alerts.length} alerts and ${subscriptions.length} subscriptions`
            : '⚠️ Not connected',
        };
      },
    },
  ];
}
