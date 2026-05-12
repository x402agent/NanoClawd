/**
 * Wallet Agent Tools
 *
 * Clawdbot agent tools for wallet management and tracking.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "clawdbot/plugin-sdk";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection, formatAddress, toSol } from "../services/bags-integration.js";
import {
  getOrCreateWallet,
  getWallet,
  getWalletPublicKey,
} from "../services/privy-wallet.js";
import {
  addTrackedWallet,
  removeTrackedWallet as removeTrackedWalletFromDb,
  getTrackedWallets,
  addTrackedToken,
  removeTrackedToken as removeTrackedTokenFromDb,
  getTrackedTokens,
  type TrackedWallet,
  type TrackedToken,
} from "../db/redis.js";
import { startTracking, stopTracking } from "../services/wallet-tracking.js";
import { nanoid } from "nanoid";

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
// Wallet Tools
// ============================================================================

export function createWalletTools(): AnyAgentTool[] {
  return [
    // =========================================================================
    // Get/Create Wallet
    // =========================================================================
    {
      name: "solana_get_wallet",
      description:
        "Get the user's Solana wallet address and balance. Creates a new wallet if none exists.",
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
          const wallet = await getOrCreateWallet(chatId);
          const connection = getConnection();

          let balance = 0;
          if (connection) {
            const balanceLamports = await connection.getBalance(new PublicKey(wallet.address));
            balance = toSol(balanceLamports);
          }

          return {
            content: [
              {
                type: "text",
                text: `💼 Your Wallet\n\nAddress: \`${wallet.address}\`\nBalance: ${balance.toFixed(4)} SOL\n\n[View on Solscan](https://solscan.io/account/${wallet.address})`,
              },
            ],
            details: {
              address: wallet.address,
              balance_sol: balance,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error getting wallet: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Get Balance
    // =========================================================================
    {
      name: "solana_get_balance",
      description:
        "Get the SOL balance of the user's wallet or a specified address.",
      parameters: Type.Object({
        address: Type.Optional(
          Type.String({
            description: "Optional wallet address to check. If not provided, checks user's wallet.",
          })
        ),
      }),
      async execute(
        _id: string,
        params: { address?: string },
        ctx?: Record<string, unknown>
      ) {
        const chatId = getChatIdFromContext(ctx || {});

        try {
          const connection = getConnection();
          if (!connection) {
            return {
              content: [{ type: "text", text: "Error: Connection not initialized." }],
              details: { error: "No connection" },
            };
          }

          let address: string;

          if (params.address) {
            address = params.address;
          } else if (chatId) {
            const walletPubkey = await getWalletPublicKey(chatId);
            if (!walletPubkey) {
              return {
                content: [{ type: "text", text: "Error: Wallet not found. Please set up your wallet first." }],
                details: { error: "No wallet" },
              };
            }
            address = walletPubkey.toBase58();
          } else {
            return {
              content: [{ type: "text", text: "Error: Please provide an address or set up your wallet." }],
              details: { error: "No address" },
            };
          }

          const balanceLamports = await connection.getBalance(new PublicKey(address));
          const balance = toSol(balanceLamports);

          return {
            content: [
              {
                type: "text",
                text: `💰 Balance\n\nAddress: \`${formatAddress(address)}\`\nBalance: ${balance.toFixed(4)} SOL`,
              },
            ],
            details: { address, balance_sol: balance },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error getting balance: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Track Wallet
    // =========================================================================
    {
      name: "solana_track_wallet",
      description:
        "Start tracking a Solana wallet for transactions. You'll receive notifications for all activity.",
      parameters: Type.Object({
        wallet_address: Type.String({
          description: "The wallet address to track",
        }),
        alias: Type.Optional(
          Type.String({
            description: "Optional friendly name for the wallet",
          })
        ),
      }),
      async execute(
        _id: string,
        params: { wallet_address: string; alias?: string },
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
          new PublicKey(params.wallet_address);

          const trackedWallet: TrackedWallet = {
            id: nanoid(),
            chatId,
            walletAddress: params.wallet_address,
            alias: params.alias,
            createdAt: Date.now(),
          };

          await addTrackedWallet(trackedWallet);
          await startTracking(params.wallet_address);

          return {
            content: [
              {
                type: "text",
                text: `✅ Now tracking wallet${params.alias ? ` "${params.alias}"` : ""}\n\nAddress: \`${formatAddress(params.wallet_address)}\`\n\nYou'll receive notifications for all transactions.`,
              },
            ],
            details: { wallet_address: params.wallet_address, alias: params.alias },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error tracking wallet: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Untrack Wallet
    // =========================================================================
    {
      name: "solana_untrack_wallet",
      description: "Stop tracking a Solana wallet.",
      parameters: Type.Object({
        wallet_address: Type.String({
          description: "The wallet address to stop tracking",
        }),
      }),
      async execute(
        _id: string,
        params: { wallet_address: string },
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
          await removeTrackedWalletFromDb(chatId, params.wallet_address);
          await stopTracking(params.wallet_address);

          return {
            content: [
              {
                type: "text",
                text: `✅ Stopped tracking wallet: \`${formatAddress(params.wallet_address)}\``,
              },
            ],
            details: { wallet_address: params.wallet_address },
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
    // List Tracked Wallets
    // =========================================================================
    {
      name: "solana_list_tracked",
      description: "List all tracked wallets and tokens.",
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
          const wallets = await getTrackedWallets(chatId);

          if (wallets.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "📋 No tracked wallets.\n\nUse the track wallet tool to start monitoring wallets.",
                },
              ],
              details: { wallets: [] },
            };
          }

          let message = `📋 Tracked Wallets (${wallets.length})\n\n`;

          for (const wallet of wallets) {
            const alias = wallet.alias ? ` (${wallet.alias})` : "";
            message += `• \`${formatAddress(wallet.walletAddress)}\`${alias}\n`;

            // Get tracked tokens for this wallet
            const tokens = await getTrackedTokens(chatId, wallet.walletAddress);
            if (tokens.length > 0) {
              for (const token of tokens) {
                message += `  └ Token: \`${formatAddress(token.tokenMint)}\`\n`;
              }
            }
          }

          return {
            content: [{ type: "text", text: message }],
            details: { wallets },
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
    // Track Token
    // =========================================================================
    {
      name: "solana_track_token",
      description:
        "Track a specific token for a wallet. Only notifies about transactions involving this token.",
      parameters: Type.Object({
        wallet_address: Type.String({
          description: "The wallet address",
        }),
        token_mint: Type.String({
          description: "The token mint address to track",
        }),
      }),
      async execute(
        _id: string,
        params: { wallet_address: string; token_mint: string },
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
          new PublicKey(params.wallet_address);
          new PublicKey(params.token_mint);

          const trackedToken: TrackedToken = {
            id: nanoid(),
            chatId,
            walletAddress: params.wallet_address,
            tokenMint: params.token_mint,
            createdAt: Date.now(),
          };

          await addTrackedToken(trackedToken);

          return {
            content: [
              {
                type: "text",
                text: `✅ Now tracking token\n\nWallet: \`${formatAddress(params.wallet_address)}\`\nToken: \`${formatAddress(params.token_mint)}\``,
              },
            ],
            details: { wallet_address: params.wallet_address, token_mint: params.token_mint },
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
    // Untrack Token
    // =========================================================================
    {
      name: "solana_untrack_token",
      description: "Stop tracking a specific token for a wallet.",
      parameters: Type.Object({
        wallet_address: Type.String({
          description: "The wallet address",
        }),
        token_mint: Type.String({
          description: "The token mint address to stop tracking",
        }),
      }),
      async execute(
        _id: string,
        params: { wallet_address: string; token_mint: string },
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
          await removeTrackedTokenFromDb(chatId, params.wallet_address, params.token_mint);

          return {
            content: [
              {
                type: "text",
                text: `✅ Stopped tracking token\n\nWallet: \`${formatAddress(params.wallet_address)}\`\nToken: \`${formatAddress(params.token_mint)}\``,
              },
            ],
            details: { wallet_address: params.wallet_address, token_mint: params.token_mint },
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
