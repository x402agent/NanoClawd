import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { volumeBotConfigTable } from "../db/schema.js";
import { extractChatIdFromSession, formatAddress } from "../types.js";
import type { ToolDependencies } from "./index.js";

export function createVolumeBotTools(deps: ToolDependencies): any[] {
  return [
    {
      name: "trading_volume_configure",
      description:
        "Configure the volume bot to generate automated buy/sell volume for a token. " +
        "This helps increase trading activity and liquidity appearance.",
      parameters: {
        type: "object",
        properties: {
          token_mint: {
            type: "string",
            description: "Token mint address to generate volume for",
          },
          pool_id: {
            type: "string",
            description: "Liquidity pool ID (Raydium, Orca, etc.)",
          },
          buy_min: {
            type: "number",
            description: "Minimum SOL per trade",
          },
          buy_max: {
            type: "number",
            description: "Maximum SOL per trade",
          },
          interval: {
            type: "number",
            description: "Seconds between trades",
          },
          wallet_count: {
            type: "number",
            description: "Number of wallets to use for volume (default: 1)",
          },
          enabled: {
            type: "boolean",
            description: "Enable or disable the volume bot",
          },
        },
        required: ["token_mint", "pool_id", "buy_min", "buy_max", "interval"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: {
          token_mint: string;
          pool_id: string;
          buy_min: number;
          buy_max: number;
          interval: number;
          wallet_count?: number;
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

        if (params.buy_min > params.buy_max) {
          return {
            content: [{ type: "text", text: "buy_min cannot be greater than buy_max" }],
          };
        }

        const now = Date.now();
        const walletNum = Math.min(params.wallet_count ?? 1, deps.config.volumeBot?.maxWallets ?? 5);

        const existing = await db
          .select()
          .from(volumeBotConfigTable)
          .where(eq(volumeBotConfigTable.chatId, chatId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(volumeBotConfigTable)
            .set({
              tokenMint: params.token_mint,
              poolId: params.pool_id,
              buyMin: params.buy_min.toString(),
              buyMax: params.buy_max.toString(),
              interval: params.interval,
              walletNum,
              enabled: params.enabled ?? existing[0].enabled,
              updatedAt: now,
            })
            .where(eq(volumeBotConfigTable.chatId, chatId));
        } else {
          await db.insert(volumeBotConfigTable).values({
            id: nanoid(),
            chatId,
            enabled: params.enabled ?? false,
            tokenMint: params.token_mint,
            poolId: params.pool_id,
            buyMin: params.buy_min.toString(),
            buyMax: params.buy_max.toString(),
            interval: params.interval,
            walletNum,
            createdAt: now,
            updatedAt: now,
          });
        }

        return {
          content: [
            {
              type: "text",
              text:
                `✅ Volume bot configured:\n\n` +
                `Token: ${formatAddress(params.token_mint)}\n` +
                `Pool: ${formatAddress(params.pool_id)}\n` +
                `Trade Range: ${params.buy_min} - ${params.buy_max} SOL\n` +
                `Interval: ${params.interval} seconds\n` +
                `Wallets: ${walletNum}\n\n` +
                `Use trading_volume_enable to start generating volume.`,
            },
          ],
        };
      },
    },

    {
      name: "trading_volume_enable",
      description: "Enable or disable the volume bot",
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
          .from(volumeBotConfigTable)
          .where(eq(volumeBotConfigTable.chatId, chatId))
          .limit(1);

        if (existing.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Please configure the volume bot first using trading_volume_configure.",
              },
            ],
          };
        }

        await db
          .update(volumeBotConfigTable)
          .set({ enabled: params.enabled, updatedAt: Date.now() })
          .where(eq(volumeBotConfigTable.chatId, chatId));

        return {
          content: [
            {
              type: "text",
              text: params.enabled
                ? `🟢 Volume bot ENABLED!\n\nGenerating trades for ${formatAddress(existing[0].tokenMint)} every ${existing[0].interval}s`
                : "🔴 Volume bot DISABLED.",
            },
          ],
        };
      },
    },

    {
      name: "trading_volume_status",
      description: "Get the current volume bot status and configuration",
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
          .from(volumeBotConfigTable)
          .where(eq(volumeBotConfigTable.chatId, chatId))
          .limit(1);

        if (config.length === 0) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Volume bot not configured.\n\n" +
                  "Use trading_volume_configure to set up volume generation.",
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
                `**Volume Bot Status**\n\n` +
                `Status: ${cfg.enabled ? "🟢 RUNNING" : "🔴 STOPPED"}\n` +
                `Token: ${formatAddress(cfg.tokenMint)}\n` +
                `Pool: ${formatAddress(cfg.poolId)}\n` +
                `Trade Range: ${cfg.buyMin} - ${cfg.buyMax} SOL\n` +
                `Interval: ${cfg.interval} seconds\n` +
                `Wallets: ${cfg.walletNum}`,
            },
          ],
        };
      },
    },
  ];
}
