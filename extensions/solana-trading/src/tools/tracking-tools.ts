import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { trackedWalletsTable, trackedTokensTable } from "../db/schema.js";
import { extractChatIdFromSession, formatAddress } from "../types.js";
import type { ToolDependencies } from "./index.js";

export function createTrackingTools(deps: ToolDependencies): any[] {
  return [
    {
      name: "trading_track_wallet",
      description:
        "Add a wallet address to your tracking list. You'll receive notifications when this wallet makes transactions.",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "Solana wallet address to track (base58 encoded)",
          },
          alias: {
            type: "string",
            description: "Optional friendly name for this wallet (e.g., 'Whale Wallet', 'Smart Money')",
          },
        },
        required: ["wallet_address"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { wallet_address: string; alias?: string },
        ctx?: { sessionKey?: string }
      ) {
        const db = await deps.ensureDb();
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        // Validate address format (basic check)
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(params.wallet_address)) {
          return {
            content: [{ type: "text", text: "Invalid wallet address format." }],
          };
        }

        // Check if already tracking
        const existing = await db
          .select()
          .from(trackedWalletsTable)
          .where(
            and(
              eq(trackedWalletsTable.chatId, chatId),
              eq(trackedWalletsTable.walletAddress, params.wallet_address)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: `Already tracking wallet ${formatAddress(params.wallet_address)}${
                  existing[0].alias ? ` (${existing[0].alias})` : ""
                }`,
              },
            ],
          };
        }

        // Check limit
        const count = await db
          .select()
          .from(trackedWalletsTable)
          .where(eq(trackedWalletsTable.chatId, chatId));

        const maxWallets = deps.config.walletTracking?.maxTrackedWallets ?? 50;
        if (count.length >= maxWallets) {
          return {
            content: [
              {
                type: "text",
                text: `Maximum tracked wallets (${maxWallets}) reached. Remove some wallets first.`,
              },
            ],
          };
        }

        // Add to tracking
        await db.insert(trackedWalletsTable).values({
          id: nanoid(),
          chatId,
          walletAddress: params.wallet_address,
          alias: params.alias,
          createdAt: Date.now(),
        });

        return {
          content: [
            {
              type: "text",
              text:
                `✅ Now tracking wallet:\n` +
                `Address: ${formatAddress(params.wallet_address)}\n` +
                (params.alias ? `Alias: ${params.alias}\n` : "") +
                `\nYou'll receive notifications for all transactions.`,
            },
          ],
        };
      },
    },

    {
      name: "trading_untrack_wallet",
      description: "Remove a wallet from your tracking list",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "Wallet address to stop tracking",
          },
        },
        required: ["wallet_address"],
        additionalProperties: false,
      },
      async execute(_id: string, params: { wallet_address: string }, ctx?: { sessionKey?: string }) {
        const db = await deps.ensureDb();
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        const result = await db
          .delete(trackedWalletsTable)
          .where(
            and(
              eq(trackedWalletsTable.chatId, chatId),
              eq(trackedWalletsTable.walletAddress, params.wallet_address)
            )
          );

        // Also remove any tracked tokens for this wallet
        await db
          .delete(trackedTokensTable)
          .where(
            and(
              eq(trackedTokensTable.chatId, chatId),
              eq(trackedTokensTable.walletAddress, params.wallet_address)
            )
          );

        return {
          content: [
            {
              type: "text",
              text: `✅ Stopped tracking wallet ${formatAddress(params.wallet_address)}`,
            },
          ],
        };
      },
    },

    {
      name: "trading_list_tracked",
      description: "List all wallets and tokens you are currently tracking",
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

        const wallets = await db
          .select()
          .from(trackedWalletsTable)
          .where(eq(trackedWalletsTable.chatId, chatId));

        const tokens = await db
          .select()
          .from(trackedTokensTable)
          .where(eq(trackedTokensTable.chatId, chatId));

        if (wallets.length === 0 && tokens.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "You're not tracking any wallets or tokens yet.\n\nUse trading_track_wallet to start tracking.",
              },
            ],
          };
        }

        let text = "**Tracked Wallets**\n\n";

        for (const wallet of wallets) {
          text += `• ${formatAddress(wallet.walletAddress)}`;
          if (wallet.alias) {
            text += ` (${wallet.alias})`;
          }
          text += "\n";
        }

        if (tokens.length > 0) {
          text += "\n**Tracked Tokens**\n\n";
          for (const token of tokens) {
            text += `• ${formatAddress(token.tokenMint)} on ${formatAddress(token.walletAddress)}\n`;
          }
        }

        return {
          content: [{ type: "text", text }],
        };
      },
    },

    {
      name: "trading_track_token",
      description:
        "Track a specific token for a wallet. Get notifications only when this wallet trades this specific token.",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "Wallet address to monitor",
          },
          token_mint: {
            type: "string",
            description: "Token mint address to track",
          },
        },
        required: ["wallet_address", "token_mint"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { wallet_address: string; token_mint: string },
        ctx?: { sessionKey?: string }
      ) {
        const db = await deps.ensureDb();
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        // Check if already tracking
        const existing = await db
          .select()
          .from(trackedTokensTable)
          .where(
            and(
              eq(trackedTokensTable.chatId, chatId),
              eq(trackedTokensTable.walletAddress, params.wallet_address),
              eq(trackedTokensTable.tokenMint, params.token_mint)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return {
            content: [{ type: "text", text: "Already tracking this token for this wallet." }],
          };
        }

        await db.insert(trackedTokensTable).values({
          id: nanoid(),
          chatId,
          walletAddress: params.wallet_address,
          tokenMint: params.token_mint,
          createdAt: Date.now(),
        });

        return {
          content: [
            {
              type: "text",
              text:
                `✅ Now tracking token:\n` +
                `Token: ${formatAddress(params.token_mint)}\n` +
                `Wallet: ${formatAddress(params.wallet_address)}`,
            },
          ],
        };
      },
    },
  ];
}
