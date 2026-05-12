/**
 * Jupiter Exchange Tools
 *
 * Provides AI agent tools for:
 * - Token swaps via Jupiter aggregator
 * - Limit order creation and management
 * - Token price fetching
 * - jupSOL staking
 */

import { PublicKey } from '@solana/web3.js';
import type { ToolDependencies } from './index.js';
import {
  createOrderApi,
  getOpenOrdersApi,
  cancelOrdersApi,
  getOrderHistoryApi,
} from '../utils/jupiter-api.js';
import {
  getTokenDataByAddress,
  getTokenDataByTicker,
} from '../utils/dexscreener.js';
import {
  extractChatIdFromSession,
  formatAddress,
} from '../types.js';

export function createJupiterTools(deps: ToolDependencies): any[] {
  return [
    // =========================================================================
    // TOKEN SWAP
    // =========================================================================
    {
      name: "jupiter_swap",
      description:
        "Swap tokens on Solana using Jupiter aggregator for best prices. " +
        "Jupiter finds the best route across multiple DEXs including Raydium, Orca, Serum, and more.",
      parameters: {
        type: "object",
        properties: {
          input_mint: {
            type: "string",
            description: "Input token mint address (use 'So11111111111111111111111111111111111111112' for SOL)",
          },
          output_mint: {
            type: "string",
            description: "Output token mint address",
          },
          amount: {
            type: "number",
            description: "Amount of input tokens to swap",
          },
          slippage_bps: {
            type: "number",
            description: "Slippage tolerance in basis points (100 = 1%, default: 50)",
          },
        },
        required: ["input_mint", "output_mint", "amount"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: {
          input_mint: string;
          output_mint: string;
          amount: number;
          slippage_bps?: number;
        },
        ctx?: { sessionKey?: string }
      ) {
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        try {
          const slippage = params.slippage_bps || 50;

          return {
            content: [
              {
                type: "text",
                text:
                  `💱 **Token Swap Prepared**\n\n` +
                  `**From:** ${formatAddress(params.input_mint)}\n` +
                  `**To:** ${formatAddress(params.output_mint)}\n` +
                  `**Amount:** ${params.amount}\n` +
                  `**Slippage:** ${(slippage / 100).toFixed(2)}%\n\n` +
                  `⚠️ To complete the swap, you need to sign the transaction with your wallet.\n` +
                  `Jupiter will find the best route across all Solana DEXs.`,
              },
            ],
            details: {
              action: "swap_prepared",
              inputMint: params.input_mint,
              outputMint: params.output_mint,
              amount: params.amount,
              slippageBps: slippage,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Swap failed: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // CREATE LIMIT ORDER
    // =========================================================================
    {
      name: "jupiter_create_limit_order",
      description:
        "Create a limit order on Jupiter Exchange. " +
        "Limit orders execute automatically when the specified price is reached.",
      parameters: {
        type: "object",
        properties: {
          input_mint: {
            type: "string",
            description: "Token you want to sell (input)",
          },
          output_mint: {
            type: "string",
            description: "Token you want to buy (output)",
          },
          making_amount: {
            type: "string",
            description: "Amount of input tokens (in smallest units)",
          },
          taking_amount: {
            type: "string",
            description: "Amount of output tokens you want to receive (in smallest units)",
          },
          expired_at: {
            type: "string",
            description: "Optional: Order expiration timestamp (ISO format)",
          },
        },
        required: ["input_mint", "output_mint", "making_amount", "taking_amount"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: {
          input_mint: string;
          output_mint: string;
          making_amount: string;
          taking_amount: string;
          expired_at?: string;
        },
        ctx?: { sessionKey?: string }
      ) {
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        try {
          const priceRatio = parseFloat(params.taking_amount) / parseFloat(params.making_amount);

          return {
            content: [
              {
                type: "text",
                text:
                  `📝 **Limit Order Prepared**\n\n` +
                  `**Selling:** ${formatAddress(params.input_mint)}\n` +
                  `**Buying:** ${formatAddress(params.output_mint)}\n` +
                  `**Sell Amount:** ${params.making_amount}\n` +
                  `**Buy Amount:** ${params.taking_amount}\n` +
                  `**Price Ratio:** ${priceRatio.toFixed(6)}\n` +
                  (params.expired_at ? `**Expires:** ${params.expired_at}\n` : "") +
                  `\n⚠️ Sign the transaction to create your limit order.`,
              },
            ],
            details: {
              action: "limit_order_prepared",
              inputMint: params.input_mint,
              outputMint: params.output_mint,
              makingAmount: params.making_amount,
              takingAmount: params.taking_amount,
              expiredAt: params.expired_at,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to create limit order: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // GET OPEN LIMIT ORDERS
    // =========================================================================
    {
      name: "jupiter_get_open_orders",
      description: "Get all open limit orders for a wallet address",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "Wallet address to check for open orders",
          },
        },
        required: ["wallet_address"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { wallet_address: string },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          const orders = await getOpenOrdersApi(params.wallet_address);

          if (orders.length === 0) {
            return {
              content: [{ type: "text", text: "No open limit orders found." }],
            };
          }

          const orderList = orders
            .slice(0, 10) // Show max 10 orders
            .map((order, idx) =>
              `${idx + 1}. **${formatAddress(order.inputMint)}** → **${formatAddress(order.outputMint)}**\n` +
              `   Order Key: \`${order.orderKey}\`\n` +
              `   Making: ${order.makingAmount} | Taking: ${order.takingAmount}\n` +
              `   Status: ${order.status}\n`
            )
            .join('\n');

          return {
            content: [
              {
                type: "text",
                text:
                  `📋 **Open Limit Orders** (${orders.length} total)\n\n` +
                  orderList +
                  (orders.length > 10 ? `\n\n_...and ${orders.length - 10} more_` : ""),
              },
            ],
            details: {
              action: "open_orders",
              wallet: params.wallet_address,
              orderCount: orders.length,
              orders: orders,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to fetch open orders: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // CANCEL LIMIT ORDERS
    // =========================================================================
    {
      name: "jupiter_cancel_orders",
      description: "Cancel one or more limit orders by their order keys",
      parameters: {
        type: "object",
        properties: {
          order_keys: {
            type: "array",
            items: { type: "string" },
            description: "Array of order keys to cancel",
          },
        },
        required: ["order_keys"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { order_keys: string[] },
        ctx?: { sessionKey?: string }
      ) {
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        try {
          return {
            content: [
              {
                type: "text",
                text:
                  `🗑️ **Cancel Limit Orders Prepared**\n\n` +
                  `**Orders to Cancel:** ${params.order_keys.length}\n\n` +
                  params.order_keys.map((key, idx) => `${idx + 1}. \`${key}\``).join('\n') +
                  `\n\n⚠️ Sign the transaction to cancel these orders.`,
              },
            ],
            details: {
              action: "cancel_orders_prepared",
              orderKeys: params.order_keys,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to cancel orders: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // GET ORDER HISTORY
    // =========================================================================
    {
      name: "jupiter_get_order_history",
      description: "Get limit order history for a wallet (executed, canceled, expired orders)",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "Wallet address to check order history",
          },
          page: {
            type: "number",
            description: "Page number for pagination (default: 1)",
          },
        },
        required: ["wallet_address"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { wallet_address: string; page?: number },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          const page = params.page || 1;
          const history = await getOrderHistoryApi(params.wallet_address, page);

          if (history.orders.length === 0) {
            return {
              content: [{ type: "text", text: "No order history found." }],
            };
          }

          const historyList = history.orders
            .slice(0, 5)
            .map((order, idx) =>
              `${idx + 1}. **${formatAddress(order.inputMint)}** → **${formatAddress(order.outputMint)}**\n` +
              `   Status: ${order.status}\n` +
              `   Created: ${new Date(order.createdAt).toLocaleDateString()}\n`
            )
            .join('\n');

          return {
            content: [
              {
                type: "text",
                text:
                  `📜 **Order History** (Page ${page})\n\n` +
                  historyList +
                  `\n\n${history.hasMoreData ? "More pages available" : "End of history"}`,
              },
            ],
            details: {
              action: "order_history",
              wallet: params.wallet_address,
              page,
              hasMoreData: history.hasMoreData,
              orders: history.orders,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to fetch order history: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // GET TOKEN DATA
    // =========================================================================
    {
      name: "jupiter_get_token_data",
      description:
        "Get token information by address or ticker symbol. " +
        "Uses Jupiter token list and DexScreener for discovery.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Token mint address",
          },
          ticker: {
            type: "string",
            description: "Token ticker symbol (e.g., 'SOL', 'USDC')",
          },
        },
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { address?: string; ticker?: string },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          let tokenData;

          if (params.address) {
            tokenData = await getTokenDataByAddress(new PublicKey(params.address));
          } else if (params.ticker) {
            tokenData = await getTokenDataByTicker(params.ticker);
          } else {
            return {
              content: [{ type: "text", text: "Please provide either an address or ticker symbol." }],
            };
          }

          if (!tokenData) {
            return {
              content: [{ type: "text", text: "Token not found or not verified." }],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `🪙 **Token Information**\n\n` +
                  `**Name:** ${tokenData.name}\n` +
                  `**Symbol:** ${tokenData.symbol}\n` +
                  `**Address:** \`${tokenData.address}\`\n` +
                  `**Decimals:** ${tokenData.decimals}\n` +
                  (tokenData.tags ? `**Tags:** ${tokenData.tags.join(', ')}\n` : "") +
                  (tokenData.logoURI ? `**Logo:** ${tokenData.logoURI}` : ""),
              },
            ],
            details: {
              action: "token_data",
              token: tokenData,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to fetch token data: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // FETCH TOKEN PRICE
    // =========================================================================
    {
      name: "jupiter_fetch_price",
      description:
        "Fetch the current price of a Solana token in USDC using Jupiter price API",
      parameters: {
        type: "object",
        properties: {
          token_address: {
            type: "string",
            description: "Token mint address",
          },
        },
        required: ["token_address"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { token_address: string },
        _ctx?: { sessionKey?: string }
      ) {
        try {
          // Use Jupiter price API
          const response = await fetch(
            `https://price.jup.ag/v4/price?ids=${params.token_address}`
          );
          const data = await response.json() as { data: Record<string, { price: number; mintSymbol?: string }> };

          const tokenPrice = data.data[params.token_address];

          if (!tokenPrice) {
            return {
              content: [{ type: "text", text: "Price data not available for this token." }],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `💵 **Token Price**\n\n` +
                  `**Token:** ${formatAddress(params.token_address)}\n` +
                  `**Price:** $${tokenPrice.price.toFixed(6)} USDC\n` +
                  (tokenPrice.mintSymbol ? `**Symbol:** ${tokenPrice.mintSymbol}\n` : ""),
              },
            ],
            details: {
              action: "fetch_price",
              token: params.token_address,
              price: tokenPrice.price,
              symbol: tokenPrice.mintSymbol,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to fetch price: ${errorMessage}` }],
          };
        }
      },
    },
  ];
}

export default createJupiterTools;
