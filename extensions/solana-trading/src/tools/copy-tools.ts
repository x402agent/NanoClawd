import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { copyTradingConfigTable } from "../db/schema.js";
import { extractChatIdFromSession, formatAddress } from "../types.js";
import type { ToolDependencies } from "./index.js";

export function createCopyTradingTools(deps: ToolDependencies): any[] {
  return [
    {
      name: "trading_copy_configure",
      description:
        "Configure copy trading to automatically mirror trades from a source wallet. " +
        "When the source wallet buys or sells, your wallet will do the same.",
      parameters: {
        type: "object",
        properties: {
          source_wallet: {
            type: "string",
            description: "Wallet address to copy trades from",
          },
          multiplier: {
            type: "number",
            description: "Trade size multiplier (e.g., 1.0 = same size, 0.5 = half size, 2.0 = double)",
          },
          max_trade_amount: {
            type: "number",
            description: "Maximum SOL per trade (safety limit)",
          },
          enabled: {
            type: "boolean",
            description: "Enable or disable copy trading",
          },
        },
        required: ["source_wallet"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: {
          source_wallet: string;
          multiplier?: number;
          max_trade_amount?: number;
          enabled?: boolean;
        },
        ctx?: { sessionKey?: string }
      ) {
        const db = await deps.ensureDb();
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        const now = Date.now();
        const multiplier = params.multiplier ?? deps.config.copyTrading?.defaultMultiplier ?? 1;
        const maxTradeAmount = params.max_trade_amount ?? deps.config.copyTrading?.maxTradeAmount;

        // Check if config exists
        const existing = await db
          .select()
          .from(copyTradingConfigTable)
          .where(eq(copyTradingConfigTable.chatId, chatId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(copyTradingConfigTable)
            .set({
              sourceWallet: params.source_wallet,
              multiplier: multiplier.toString(),
              maxTradeAmount: maxTradeAmount?.toString(),
              enabled: params.enabled ?? existing[0].enabled,
              updatedAt: now,
            })
            .where(eq(copyTradingConfigTable.chatId, chatId));
        } else {
          await db.insert(copyTradingConfigTable).values({
            id: nanoid(),
            chatId,
            enabled: params.enabled ?? false,
            sourceWallet: params.source_wallet,
            multiplier: multiplier.toString(),
            maxTradeAmount: maxTradeAmount?.toString(),
            createdAt: now,
            updatedAt: now,
          });
        }

        return {
          content: [
            {
              type: "text",
              text:
                `✅ Copy trading configured:\n\n` +
                `Source Wallet: ${formatAddress(params.source_wallet)}\n` +
                `Multiplier: ${multiplier}x\n` +
                (maxTradeAmount ? `Max Trade: ${maxTradeAmount} SOL\n` : "") +
                `Status: ${params.enabled !== false ? "Ready to enable" : "Disabled"}\n\n` +
                `Use trading_copy_enable to start copying trades.`,
            },
          ],
        };
      },
    },

    {
      name: "trading_copy_enable",
      description: "Enable or disable copy trading",
      parameters: {
        type: "object",
        properties: {
          enabled: {
            type: "boolean",
            description: "Set to true to enable copy trading, false to disable",
          },
        },
        required: ["enabled"],
        additionalProperties: false,
      },
      async execute(_id: string, params: { enabled: boolean }, ctx?: { sessionKey?: string }) {
        const db = await deps.ensureDb();
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        const existing = await db
          .select()
          .from(copyTradingConfigTable)
          .where(eq(copyTradingConfigTable.chatId, chatId))
          .limit(1);

        if (existing.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Please configure copy trading first using trading_copy_configure.",
              },
            ],
          };
        }

        await db
          .update(copyTradingConfigTable)
          .set({ enabled: params.enabled, updatedAt: Date.now() })
          .where(eq(copyTradingConfigTable.chatId, chatId));

        return {
          content: [
            {
              type: "text",
              text: params.enabled
                ? `🟢 Copy trading ENABLED!\n\nNow mirroring trades from ${formatAddress(existing[0].sourceWallet)}`
                : "🔴 Copy trading DISABLED.",
            },
          ],
        };
      },
    },

    {
      name: "trading_copy_status",
      description: "Get the current copy trading status and configuration",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      async execute(_id: string, _params: {}, ctx?: { sessionKey?: string }) {
        const db = await deps.ensureDb();
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        const config = await db
          .select()
          .from(copyTradingConfigTable)
          .where(eq(copyTradingConfigTable.chatId, chatId))
          .limit(1);

        if (config.length === 0) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Copy trading not configured.\n\n" +
                  "Use trading_copy_configure to set up trade mirroring.",
              },
            ],
          };
        }

        const cfg = config[0];

        return {
          content: [
            {
              type: "text",
              text:
                `**Copy Trading Status**\n\n` +
                `Status: ${cfg.enabled ? "🟢 ACTIVE" : "🔴 DISABLED"}\n` +
                `Source Wallet: ${formatAddress(cfg.sourceWallet)}\n` +
                `Multiplier: ${cfg.multiplier}x\n` +
                (cfg.maxTradeAmount ? `Max Trade: ${cfg.maxTradeAmount} SOL\n` : "Max Trade: No limit\n"),
            },
          ],
        };
      },
    },
  ];
}
