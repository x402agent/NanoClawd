import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { sniperConfigTable } from "../db/schema.js";
import { extractChatIdFromSession, formatSol } from "../types.js";
import type { ToolDependencies } from "./index.js";

export function createSniperTools(deps: ToolDependencies): any[] {
  return [
    {
      name: "trading_sniper_configure",
      description:
        "Configure the sniper bot settings for automated token buying on new launches. " +
        "Set buy amount, slippage, and filters for automatic sniping.",
      parameters: {
        type: "object",
        properties: {
          enabled: {
            type: "boolean",
            description: "Enable or disable the sniper bot",
          },
          buy_amount: {
            type: "number",
            description: "SOL amount to spend per snipe (e.g., 0.1)",
          },
          slippage: {
            type: "number",
            description: "Slippage tolerance as percentage (e.g., 15 for 15%)",
          },
          max_buy_amount: {
            type: "number",
            description: "Maximum SOL to spend on a single token (optional)",
          },
          min_liquidity: {
            type: "number",
            description: "Minimum liquidity required in SOL (optional filter)",
          },
          max_market_cap: {
            type: "number",
            description: "Maximum market cap in USD (optional filter)",
          },
          require_socials: {
            type: "boolean",
            description: "Only snipe tokens with social links (optional filter)",
          },
        },
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: {
          enabled?: boolean;
          buy_amount?: number;
          slippage?: number;
          max_buy_amount?: number;
          min_liquidity?: number;
          max_market_cap?: number;
          require_socials?: boolean;
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
        const filters = {
          minLiquidity: params.min_liquidity,
          maxMarketCap: params.max_market_cap,
          requireSocials: params.require_socials,
        };

        // Check if config exists
        const existing = await db
          .select()
          .from(sniperConfigTable)
          .where(eq(sniperConfigTable.chatId, chatId))
          .limit(1);

        if (existing.length > 0) {
          // Update existing config
          await db
            .update(sniperConfigTable)
            .set({
              enabled: params.enabled ?? existing[0].enabled,
              buyAmount: params.buy_amount?.toString() ?? existing[0].buyAmount,
              slippage: params.slippage ?? existing[0].slippage,
              maxBuyAmount: params.max_buy_amount?.toString() ?? existing[0].maxBuyAmount,
              filters: { ...existing[0].filters, ...filters },
              updatedAt: now,
            })
            .where(eq(sniperConfigTable.chatId, chatId));
        } else {
          // Create new config
          await db.insert(sniperConfigTable).values({
            id: nanoid(),
            chatId,
            enabled: params.enabled ?? false,
            buyAmount: params.buy_amount?.toString() ?? deps.config.sniper?.defaultBuyAmount?.toString() ?? "0.1",
            slippage: params.slippage ?? deps.config.sniper?.defaultSlippage ?? 15,
            maxBuyAmount: params.max_buy_amount?.toString(),
            filters,
            createdAt: now,
            updatedAt: now,
          });
        }

        return {
          content: [
            {
              type: "text",
              text:
                `Sniper configuration updated:\n` +
                `- Enabled: ${params.enabled ?? "unchanged"}\n` +
                `- Buy Amount: ${params.buy_amount ?? "unchanged"} SOL\n` +
                `- Slippage: ${params.slippage ?? "unchanged"}%\n` +
                (params.max_buy_amount ? `- Max Buy: ${params.max_buy_amount} SOL\n` : "") +
                (params.min_liquidity ? `- Min Liquidity: ${params.min_liquidity} SOL\n` : "") +
                (params.max_market_cap ? `- Max Market Cap: $${params.max_market_cap}\n` : ""),
            },
          ],
        };
      },
    },

    {
      name: "trading_sniper_status",
      description: "Get the current sniper bot status and configuration",
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
          .from(sniperConfigTable)
          .where(eq(sniperConfigTable.chatId, chatId))
          .limit(1);

        if (config.length === 0) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Sniper bot not configured.\n\n" +
                  "Use trading_sniper_configure to set up automatic token sniping.",
              },
            ],
          };
        }

        const cfg = config[0];
        const filters = cfg.filters || {};

        return {
          content: [
            {
              type: "text",
              text:
                `**Sniper Bot Status**\n\n` +
                `Status: ${cfg.enabled ? "🟢 ACTIVE" : "🔴 DISABLED"}\n` +
                `Buy Amount: ${cfg.buyAmount} SOL\n` +
                `Slippage: ${cfg.slippage}%\n` +
                (cfg.maxBuyAmount ? `Max Buy: ${cfg.maxBuyAmount} SOL\n` : "") +
                `\n**Filters:**\n` +
                (filters.minLiquidity ? `- Min Liquidity: ${filters.minLiquidity} SOL\n` : "- Min Liquidity: None\n") +
                (filters.maxMarketCap ? `- Max Market Cap: $${filters.maxMarketCap}\n` : "- Max Market Cap: None\n") +
                (filters.requireSocials !== undefined
                  ? `- Require Socials: ${filters.requireSocials ? "Yes" : "No"}\n`
                  : ""),
            },
          ],
        };
      },
    },

    {
      name: "trading_sniper_enable",
      description: "Quickly enable or disable the sniper bot",
      parameters: {
        type: "object",
        properties: {
          enabled: {
            type: "boolean",
            description: "Set to true to enable, false to disable",
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
          .from(sniperConfigTable)
          .where(eq(sniperConfigTable.chatId, chatId))
          .limit(1);

        if (existing.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Please configure the sniper first using trading_sniper_configure.",
              },
            ],
          };
        }

        await db
          .update(sniperConfigTable)
          .set({ enabled: params.enabled, updatedAt: Date.now() })
          .where(eq(sniperConfigTable.chatId, chatId));

        return {
          content: [
            {
              type: "text",
              text: params.enabled
                ? "🟢 Sniper bot ENABLED. Monitoring for new token launches..."
                : "🔴 Sniper bot DISABLED.",
            },
          ],
        };
      },
    },
  ];
}
