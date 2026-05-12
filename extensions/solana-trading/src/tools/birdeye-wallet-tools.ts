import { createBirdeyeWalletServiceFromEnv } from '../services/birdeye-wallet-service.js';
import { extractChatIdFromSession, formatAddress } from '../types.js';
import type { ToolDependencies } from './index.js';

export function createBirdeyeWalletTools(deps: ToolDependencies): any[] {
  return [
    {
      name: 'birdeye_wallet_networth',
      description:
        'Get the current net worth and portfolio breakdown of a Solana wallet. ' +
        'Shows total value in USD and all token holdings with current prices.',
      parameters: {
        type: 'object',
        properties: {
          wallet_address: {
            type: 'string',
            description: 'Solana wallet address to check (base58 encoded)',
          },
          limit: {
            type: 'number',
            description: 'Number of top holdings to return (1-100, default 20)',
          },
        },
        required: ['wallet_address'],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { wallet_address: string; limit?: number },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          const service = createBirdeyeWalletServiceFromEnv();
          const data = await service.getCurrentNetWorth(params.wallet_address, {
            limit: params.limit || 20,
            sortType: 'desc',
          });

          const totalValue = parseFloat(data.totalValue);
          let response = `**Wallet Net Worth**: ${formatAddress(data.walletAddress)}\n\n`;
          response += `💰 **Total Value**: $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          response += `🕒 **Updated**: ${new Date(data.currentTimestamp).toLocaleString()}\n\n`;

          if (data.items.length === 0) {
            response += 'No holdings found.';
          } else {
            response += `**Top ${data.items.length} Holdings**:\n\n`;
            for (const item of data.items.slice(0, 10)) {
              const value = parseFloat(item.value);
              const percentage = (value / totalValue) * 100;
              response += `${item.symbol} (${item.name})\n`;
              response += `  • Amount: ${item.amount.toLocaleString()}\n`;
              response += `  • Price: $${item.price.toFixed(6)}\n`;
              response += `  • Value: $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage.toFixed(1)}%)\n`;
              response += `  • Address: ${formatAddress(item.address)}\n\n`;
            }
          }

          return { content: [{ type: 'text', text: response }] };
        } catch (error) {
          return {
            content: [
              { type: 'text', text: `Error fetching net worth: ${error instanceof Error ? error.message : String(error)}` },
            ],
          };
        }
      },
    },

    {
      name: 'birdeye_wallet_networth_chart',
      description:
        'Get historical net worth chart data for a wallet over time. ' +
        'Shows net worth changes day by day or hour by hour.',
      parameters: {
        type: 'object',
        properties: {
          wallet_address: {
            type: 'string',
            description: 'Solana wallet address to check',
          },
          days: {
            type: 'number',
            description: 'Number of days of history (1-30, default 7)',
          },
          interval: {
            type: 'string',
            description: 'Time interval: "1d" for daily or "1h" for hourly (default "1d")',
          },
        },
        required: ['wallet_address'],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { wallet_address: string; days?: number; interval?: string },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          const service = createBirdeyeWalletServiceFromEnv();
          const data = await service.getNetWorthChart(params.wallet_address, {
            count: params.days || 7,
            type: (params.interval as '1h' | '1d') || '1d',
            direction: 'back',
          });

          let response = `**Net Worth Chart**: ${formatAddress(data.walletAddress)}\n\n`;
          response += `📊 **Period**: ${data.pastTimestamp} to ${data.currentTimestamp}\n\n`;

          if (data.history.length === 0) {
            response += 'No historical data available.';
          } else {
            response += '**Net Worth History**:\n\n';
            for (const point of data.history) {
              const date = new Date(point.timestamp).toLocaleDateString();
              const netWorth = point.netWorth.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              const change = point.netWorthChange >= 0 ? '+' : '';
              const changeStr = `${change}$${point.netWorthChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              const percentStr = `${change}${point.netWorthChangePercent.toFixed(2)}%`;
              const emoji = point.netWorthChange >= 0 ? '📈' : '📉';

              response += `${date}: $${netWorth} ${emoji}\n`;
              response += `  Change: ${changeStr} (${percentStr})\n\n`;
            }
          }

          return { content: [{ type: 'text', text: response }] };
        } catch (error) {
          return {
            content: [
              { type: 'text', text: `Error fetching net worth chart: ${error instanceof Error ? error.message : String(error)}` },
            ],
          };
        }
      },
    },

    {
      name: 'birdeye_wallet_pnl',
      description:
        'Get profit and loss (PnL) summary for a wallet. ' +
        'Shows total trades, win rate, realized/unrealized profits.',
      parameters: {
        type: 'object',
        properties: {
          wallet_address: {
            type: 'string',
            description: 'Solana wallet address to check',
          },
          duration: {
            type: 'string',
            description: 'Time period: "all", "90d", "30d", "7d", or "24h" (default "all")',
          },
        },
        required: ['wallet_address'],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { wallet_address: string; duration?: string },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          const service = createBirdeyeWalletServiceFromEnv();
          const data = await service.getPnL(
            params.wallet_address,
            (params.duration as any) || 'all'
          );

          const summary = data.summary;
          const winRate = (summary.counts.winRate * 100).toFixed(1);

          let response = `**Wallet PnL Summary**: ${formatAddress(params.wallet_address)}\n\n`;
          response += `📊 **Period**: ${params.duration || 'All Time'}\n\n`;

          response += `**Trading Stats**:\n`;
          response += `  • Unique Tokens: ${summary.uniqueTokens}\n`;
          response += `  • Total Trades: ${summary.counts.totalTrade}\n`;
          response += `  • Buys: ${summary.counts.totalBuy}\n`;
          response += `  • Sells: ${summary.counts.totalSell}\n`;
          response += `  • Wins: ${summary.counts.totalWin} | Losses: ${summary.counts.totalLoss}\n`;
          response += `  • Win Rate: ${winRate}%\n\n`;

          response += `**Cash Flow (USD)**:\n`;
          response += `  • Total Invested: $${summary.cashflowUsd.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          response += `  • Total Sold: $${summary.cashflowUsd.totalSold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;

          const totalPnL = summary.pnl.totalUsd;
          const pnlEmoji = totalPnL >= 0 ? '📈' : '📉';

          response += `**Profit & Loss** ${pnlEmoji}:\n`;
          response += `  • Realized: $${summary.pnl.realizedProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${(summary.pnl.realizedProfitPercent * 100).toFixed(2)}%)\n`;
          response += `  • Unrealized: $${summary.pnl.unrealizedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          response += `  • **Total PnL**: $${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          response += `  • Avg Per Trade: $${summary.pnl.avgProfitPerTradeUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;

          return { content: [{ type: 'text', text: response }] };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error fetching PnL: ${error instanceof Error ? error.message : String(error)}` }],
          };
        }
      },
    },

    {
      name: 'birdeye_wallet_portfolio',
      description: 'Get the full portfolio of a wallet with all token holdings, prices, and values',
      parameters: {
        type: 'object',
        properties: {
          wallet_address: {
            type: 'string',
            description: 'Solana wallet address to check',
          },
        },
        required: ['wallet_address'],
        additionalProperties: false,
      },
      async execute(_id: string, params: { wallet_address: string }, _ctx?: { sessionKey?: string }) {
        try {
          const service = createBirdeyeWalletServiceFromEnv();
          const data = await service.getWalletPortfolio(params.wallet_address);

          let response = `**Wallet Portfolio**: ${formatAddress(params.wallet_address)}\n\n`;

          if (data.items.length === 0) {
            response += 'No holdings found.';
          } else {
            const totalValue = data.items.reduce((sum, item) => sum + item.valueUsd, 0);
            response += `💰 **Total Value**: $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            response += `📦 **Holdings**: ${data.items.length} tokens\n\n`;

            // Sort by value descending
            const sorted = data.items.sort((a, b) => b.valueUsd - a.valueUsd);

            for (const item of sorted.slice(0, 15)) {
              const percentage = (item.valueUsd / totalValue) * 100;
              response += `${item.symbol} (${item.name})\n`;
              response += `  • Amount: ${item.uiAmount.toLocaleString()}\n`;
              response += `  • Price: $${item.priceUsd.toFixed(6)}\n`;
              response += `  • Value: $${item.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage.toFixed(1)}%)\n\n`;
            }

            if (sorted.length > 15) {
              response += `...and ${sorted.length - 15} more tokens`;
            }
          }

          return { content: [{ type: 'text', text: response }] };
        } catch (error) {
          return {
            content: [
              { type: 'text', text: `Error fetching portfolio: ${error instanceof Error ? error.message : String(error)}` },
            ],
          };
        }
      },
    },

    {
      name: 'birdeye_wallet_transactions',
      description: 'Get recent transaction history for a wallet',
      parameters: {
        type: 'object',
        properties: {
          wallet_address: {
            type: 'string',
            description: 'Solana wallet address to check',
          },
          limit: {
            type: 'number',
            description: 'Number of transactions to return (1-100, default 10)',
          },
        },
        required: ['wallet_address'],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { wallet_address: string; limit?: number },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          const service = createBirdeyeWalletServiceFromEnv();
          const data = await service.getTransactionHistory(params.wallet_address, {
            limit: params.limit || 10,
          });

          let response = `**Transaction History**: ${formatAddress(params.wallet_address)}\n\n`;

          if (!data.solana || data.solana.length === 0) {
            response += 'No recent transactions found.';
          } else {
            response += `📝 **Recent ${data.solana.length} Transactions**:\n\n`;

            for (const tx of data.solana) {
              const date = new Date(tx.blockTime).toLocaleString();
              const status = tx.status ? '✅' : '❌';

              response += `${status} **${tx.mainAction}** - ${date}\n`;
              response += `  • Signature: ${formatAddress(tx.txHash)}\n`;
              response += `  • Block: ${tx.blockNumber}\n`;

              if (tx.balanceChange.length > 0) {
                response += `  • Changes:\n`;
                for (const change of tx.balanceChange.slice(0, 3)) {
                  const amount = change.amount / Math.pow(10, change.decimals);
                  const sign = amount >= 0 ? '+' : '';
                  response += `    - ${sign}${amount.toLocaleString()} ${change.symbol}\n`;
                }
              }

              response += '\n';
            }
          }

          return { content: [{ type: 'text', text: response }] };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error fetching transactions: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    },

    {
      name: 'birdeye_top_traders',
      description: 'Get the top traders for a specific token by volume or trade count',
      parameters: {
        type: 'object',
        properties: {
          token_address: {
            type: 'string',
            description: 'Token mint address to analyze',
          },
          time_frame: {
            type: 'string',
            description: 'Time period: "24h", "7d", or "30d" (default "24h")',
          },
          limit: {
            type: 'number',
            description: 'Number of top traders to return (1-10, default 10)',
          },
        },
        required: ['token_address'],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { token_address: string; time_frame?: string; limit?: number },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          const service = createBirdeyeWalletServiceFromEnv();
          const data = await service.getTopTraders(params.token_address, {
            timeFrame: (params.time_frame as any) || '24h',
            limit: params.limit || 10,
          });

          let response = `**Top Traders**: ${formatAddress(params.token_address)}\n\n`;
          response += `📊 **Period**: ${params.time_frame || '24h'}\n\n`;

          if (!data.items || data.items.length === 0) {
            response += 'No trader data available.';
          } else {
            response += `🏆 **Top ${data.items.length} Traders**:\n\n`;

            for (let i = 0; i < data.items.length; i++) {
              const trader = data.items[i];
              response += `${i + 1}. ${formatAddress(trader.owner)}\n`;
              response += `  • Volume: $${trader.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
              response += `  • Trades: ${trader.trade} (Buy: ${trader.tradeBuy}, Sell: ${trader.tradeSell})\n`;
              response += `  • Buy Volume: $${trader.volumeBuy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
              response += `  • Sell Volume: $${trader.volumeSell.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
            }
          }

          return { content: [{ type: 'text', text: response }] };
        } catch (error) {
          return {
            content: [
              { type: 'text', text: `Error fetching top traders: ${error instanceof Error ? error.message : String(error)}` },
            ],
          };
        }
      },
    },

    {
      name: 'birdeye_gainers_losers',
      description: 'Get the top gaining or losing traders across all tokens',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            description: 'Time period: "yesterday", "today", or "1W" (default "1W")',
          },
          limit: {
            type: 'number',
            description: 'Number of traders to return (1-10, default 10)',
          },
        },
        additionalProperties: false,
      },
      async execute(_id: string, params: { period?: string; limit?: number }, _ctx?: { sessionKey?: string }) {
        try {
          const service = createBirdeyeWalletServiceFromEnv();
          const data = await service.getGainersLosers({
            type: (params.period as any) || '1W',
            limit: params.limit || 10,
          });

          let response = `**Top Gainers/Losers**\n\n`;
          response += `📊 **Period**: ${params.period || '1 Week'}\n\n`;

          if (!data.items || data.items.length === 0) {
            response += 'No data available.';
          } else {
            const gainers = data.items.filter((t) => t.pnl >= 0);
            const losers = data.items.filter((t) => t.pnl < 0);

            if (gainers.length > 0) {
              response += `🟢 **Top Gainers**:\n\n`;
              for (let i = 0; i < Math.min(5, gainers.length); i++) {
                const trader = gainers[i];
                response += `${i + 1}. ${formatAddress(trader.address)}\n`;
                response += `  • PnL: $${trader.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 📈\n`;
                response += `  • Volume: $${trader.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                response += `  • Trades: ${trader.tradeCount}\n\n`;
              }
            }

            if (losers.length > 0) {
              response += `🔴 **Top Losers**:\n\n`;
              for (let i = 0; i < Math.min(5, losers.length); i++) {
                const trader = losers[i];
                response += `${i + 1}. ${formatAddress(trader.address)}\n`;
                response += `  • PnL: $${trader.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 📉\n`;
                response += `  • Volume: $${trader.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                response += `  • Trades: ${trader.tradeCount}\n\n`;
              }
            }
          }

          return { content: [{ type: 'text', text: response }] };
        } catch (error) {
          return {
            content: [
              { type: 'text', text: `Error fetching gainers/losers: ${error instanceof Error ? error.message : String(error)}` },
            ],
          };
        }
      },
    },
  ];
}
