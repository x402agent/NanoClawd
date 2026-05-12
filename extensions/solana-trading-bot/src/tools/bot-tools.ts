/**
 * Bot Agent Tools
 *
 * Clawdbot agent tools for bot operations:
 * - Sniper bot
 * - Copy trading
 * - Volume bot
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "clawdbot/plugin-sdk";
import { PublicKey } from "@solana/web3.js";
import { formatAddress } from "../services/bags-integration.js";
import {
  startSniper,
  stopSniper,
  getSniperStatus,
  isSniperRunning,
  getActiveSniperCount,
} from "../services/sniper-bot.js";
import {
  startCopyTrading,
  stopCopyTrading,
  getCopyTradingStatus,
  getActiveCopyTradersCount,
} from "../services/copy-trading.js";
import {
  startVolumeBot,
  stopVolumeBot,
  getVolumeBotStatus,
  getActiveVolumeBotCount,
  getStats,
} from "../services/volume-bot.js";

// ============================================================================
// Helper to get chat ID from tool context
// ============================================================================

function getChatIdFromContext(ctx: Record<string, unknown>): number | null {
  if (typeof ctx.chatId === "number") return ctx.chatId;
  if (typeof ctx.userId === "number") return ctx.userId;
  if (ctx.telegramChatId && typeof ctx.telegramChatId === "number") {
    return ctx.telegramChatId;
  }
  return null;
}

// ============================================================================
// Bot Tools
// ============================================================================

export function createBotTools(): AnyAgentTool[] {
  return [
    // =========================================================================
    // Sniper Bot - Start
    // =========================================================================
    {
      name: "solana_sniper_start",
      description:
        "Start the sniper bot to automatically buy new tokens as they launch on Pump.fun.",
      parameters: Type.Object({
        buy_amount: Type.Number({
          description: "Amount of SOL to spend per snipe",
        }),
        slippage: Type.Optional(
          Type.Number({
            description: "Slippage tolerance in percentage (default: 10)",
          })
        ),
        max_buy_amount: Type.Optional(
          Type.Number({
            description: "Maximum SOL to spend per snipe",
          })
        ),
      }),
      async execute(
        _id: string,
        params: { buy_amount: number; slippage?: number; max_buy_amount?: number },
        ctx?: Record<string, unknown>
      ) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          await startSniper({
            chatId,
            buyAmount: params.buy_amount,
            slippage: params.slippage || 10,
            maxBuyAmount: params.max_buy_amount,
          });

          return {
            content: [
              {
                type: "text",
                text: `🎯 Sniper Bot Started!\n\nBuy Amount: ${params.buy_amount} SOL\nSlippage: ${params.slippage || 10}%${params.max_buy_amount ? `\nMax Buy: ${params.max_buy_amount} SOL` : ""}\n\nThe bot will automatically buy new tokens as they launch on Pump.fun.`,
              },
            ],
            details: {
              enabled: true,
              buy_amount: params.buy_amount,
              slippage: params.slippage || 10,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error starting sniper: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Sniper Bot - Stop
    // =========================================================================
    {
      name: "solana_sniper_stop",
      description: "Stop the sniper bot.",
      parameters: Type.Object({}),
      async execute(_id: string, _params: {}, ctx?: Record<string, unknown>) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          await stopSniper(chatId);

          return {
            content: [{ type: "text", text: "🛑 Sniper bot stopped." }],
            details: { enabled: false },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Sniper Bot - Status
    // =========================================================================
    {
      name: "solana_sniper_status",
      description: "Get the current status of your sniper bot.",
      parameters: Type.Object({}),
      async execute(_id: string, _params: {}, ctx?: Record<string, unknown>) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          const status = await getSniperStatus(chatId);
          const activeCount = await getActiveSniperCount();

          const emoji = status.enabled ? "🟢" : "⚪";
          let message = `🎯 Sniper Bot Status\n\n`;
          message += `${emoji} Status: ${status.enabled ? "Active" : "Inactive"}\n`;

          if (status.enabled) {
            message += `Buy Amount: ${status.buyAmount} SOL\n`;
            message += `Slippage: ${status.slippage}%\n`;
          }

          message += `\n📊 Global: ${activeCount} active sniper(s)`;
          message += `\n🔌 Stream: ${status.globalRunning ? "Connected" : "Disconnected"}`;

          return {
            content: [{ type: "text", text: message }],
            details: status,
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Copy Trading - Start
    // =========================================================================
    {
      name: "solana_copy_start",
      description:
        "Start copy trading to automatically copy trades from a wallet.",
      parameters: Type.Object({
        source_wallet: Type.String({
          description: "The wallet address to copy trades from",
        }),
        multiplier: Type.Optional(
          Type.Number({
            description: "Trade amount multiplier (default: 1.0 = same amount)",
          })
        ),
        max_trade_amount: Type.Optional(
          Type.Number({
            description: "Maximum SOL per trade",
          })
        ),
      }),
      async execute(
        _id: string,
        params: { source_wallet: string; multiplier?: number; max_trade_amount?: number },
        ctx?: Record<string, unknown>
      ) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          // Validate address
          new PublicKey(params.source_wallet);

          await startCopyTrading({
            chatId,
            sourceWallet: params.source_wallet,
            multiplier: params.multiplier || 1.0,
            maxTradeAmount: params.max_trade_amount,
          });

          return {
            content: [
              {
                type: "text",
                text: `📋 Copy Trading Started!\n\nCopying: \`${formatAddress(params.source_wallet)}\`\nMultiplier: ${params.multiplier || 1.0}x${params.max_trade_amount ? `\nMax Trade: ${params.max_trade_amount} SOL` : ""}\n\nYou'll automatically copy trades from this wallet.`,
              },
            ],
            details: {
              enabled: true,
              source_wallet: params.source_wallet,
              multiplier: params.multiplier || 1.0,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Copy Trading - Stop
    // =========================================================================
    {
      name: "solana_copy_stop",
      description: "Stop copy trading.",
      parameters: Type.Object({}),
      async execute(_id: string, _params: {}, ctx?: Record<string, unknown>) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          await stopCopyTrading(chatId);

          return {
            content: [{ type: "text", text: "🛑 Copy trading stopped." }],
            details: { enabled: false },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Copy Trading - Status
    // =========================================================================
    {
      name: "solana_copy_status",
      description: "Get the current status of copy trading.",
      parameters: Type.Object({}),
      async execute(_id: string, _params: {}, ctx?: Record<string, unknown>) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          const status = await getCopyTradingStatus(chatId);
          const activeCount = await getActiveCopyTradersCount();

          const emoji = status.enabled ? "🟢" : "⚪";
          let message = `📋 Copy Trading Status\n\n`;
          message += `${emoji} Status: ${status.enabled ? "Active" : "Inactive"}\n`;

          if (status.enabled) {
            message += `Source: \`${formatAddress(status.sourceWallet || "")}\`\n`;
            message += `Multiplier: ${status.multiplier}x\n`;
            if (status.maxTradeAmount) {
              message += `Max Trade: ${status.maxTradeAmount} SOL\n`;
            }
          }

          message += `\n📊 Global: ${activeCount} active copy trader(s)`;

          return {
            content: [{ type: "text", text: message }],
            details: status,
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Volume Bot - Start
    // =========================================================================
    {
      name: "solana_volume_start",
      description:
        "Start the volume bot to generate trading volume for a token.",
      parameters: Type.Object({
        token_mint: Type.String({
          description: "The token mint address",
        }),
        pool_id: Type.String({
          description: "The liquidity pool ID",
        }),
        buy_min: Type.Number({
          description: "Minimum SOL per trade",
        }),
        buy_max: Type.Number({
          description: "Maximum SOL per trade",
        }),
        interval: Type.Number({
          description: "Seconds between trades",
        }),
      }),
      async execute(
        _id: string,
        params: {
          token_mint: string;
          pool_id: string;
          buy_min: number;
          buy_max: number;
          interval: number;
        },
        ctx?: Record<string, unknown>
      ) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          // Validate addresses
          new PublicKey(params.token_mint);
          new PublicKey(params.pool_id);

          await startVolumeBot({
            chatId,
            tokenMint: params.token_mint,
            poolId: params.pool_id,
            buyMin: params.buy_min,
            buyMax: params.buy_max,
            interval: params.interval,
          });

          return {
            content: [
              {
                type: "text",
                text: `📈 Volume Bot Started!\n\nToken: \`${formatAddress(params.token_mint)}\`\nTrade Range: ${params.buy_min}-${params.buy_max} SOL\nInterval: ${params.interval}s\n\nThe bot will execute random buy/sell orders to generate volume.`,
              },
            ],
            details: {
              enabled: true,
              token_mint: params.token_mint,
              buy_min: params.buy_min,
              buy_max: params.buy_max,
              interval: params.interval,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Volume Bot - Stop
    // =========================================================================
    {
      name: "solana_volume_stop",
      description: "Stop the volume bot.",
      parameters: Type.Object({}),
      async execute(_id: string, _params: {}, ctx?: Record<string, unknown>) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          await stopVolumeBot(chatId);

          return {
            content: [{ type: "text", text: "🛑 Volume bot stopped." }],
            details: { enabled: false },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Volume Bot - Status
    // =========================================================================
    {
      name: "solana_volume_status",
      description: "Get the current status of your volume bot.",
      parameters: Type.Object({}),
      async execute(_id: string, _params: {}, ctx?: Record<string, unknown>) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user." }],
            details: { error: "No chat ID" },
          };
        }

        try {
          const status = await getVolumeBotStatus(chatId);
          const stats = getStats(chatId);
          const activeCount = await getActiveVolumeBotCount();

          const emoji = status.enabled ? "🟢" : "⚪";
          let message = `📈 Volume Bot Status\n\n`;
          message += `${emoji} Status: ${status.enabled ? "Active" : "Inactive"}\n`;

          if (status.enabled) {
            message += `Token: \`${formatAddress(status.tokenMint || "")}\`\n`;
            message += `Range: ${status.buyMin}-${status.buyMax} SOL\n`;
            message += `Interval: ${status.interval}s\n`;
            message += `Running: ${status.isRunning ? "Yes" : "No"}\n`;
          }

          if (stats) {
            message += `\n📊 Stats:\n`;
            message += `Total Trades: ${stats.totalTrades}\n`;
            message += `Total Volume: ${stats.totalVolume.toFixed(4)} SOL\n`;
          }

          message += `\n🌐 Global: ${activeCount} active volume bot(s)`;

          return {
            content: [{ type: "text", text: message }],
            details: { ...status, stats },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },
  ];
}
