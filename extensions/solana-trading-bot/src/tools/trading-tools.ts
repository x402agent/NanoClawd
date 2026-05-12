/**
 * Trading Agent Tools
 *
 * Clawdbot agent tools for trading operations.
 * These tools can be invoked by the LLM during conversations.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "clawdbot/plugin-sdk";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  getConnection,
  getTradeQuote,
  executeBuy,
  executeSell,
  createTokenInfo,
  createFeeShareConfig,
  createTokenLaunchTransaction,
  getClaimablePositions,
  getClaimTransactions,
  formatAddress,
  toSol,
  toLamports,
} from "../services/bags-integration.js";
import {
  getOrCreateWallet,
  getWalletPublicKey,
  signAndSendWithPrivy,
} from "../services/privy-wallet.js";

// ============================================================================
// Helper to get chat ID from tool context
// ============================================================================

function getChatIdFromContext(ctx: Record<string, unknown>): number | null {
  // Try different context paths where chatId might be stored
  if (typeof ctx.chatId === "number") return ctx.chatId;
  if (typeof ctx.userId === "number") return ctx.userId;
  if (ctx.message && typeof (ctx.message as any).chatId === "number") {
    return (ctx.message as any).chatId;
  }
  if (ctx.telegramChatId && typeof ctx.telegramChatId === "number") {
    return ctx.telegramChatId;
  }
  return null;
}

// ============================================================================
// Trading Tools
// ============================================================================

export function createTradingTools(): AnyAgentTool[] {
  return [
    // =========================================================================
    // Buy Token
    // =========================================================================
    {
      name: "solana_buy_token",
      description:
        "Buy a Solana token using SOL. Executes a swap from SOL to the specified token via Bags.fm.",
      parameters: Type.Object({
        token_mint: Type.String({
          description: "The token mint address to buy",
        }),
        amount_sol: Type.Number({
          description: "Amount of SOL to spend",
        }),
      }),
      async execute(
        _id: string,
        params: { token_mint: string; amount_sol: number },
        ctx?: Record<string, unknown>
      ) {
        const chatId = getChatIdFromContext(ctx || {});
        if (!chatId) {
          return {
            content: [{ type: "text", text: "Error: Could not determine user. Please try again." }],
            details: { error: "No chat ID in context" },
          };
        }

        try {
          const connection = getConnection();
          if (!connection) {
            return {
              content: [{ type: "text", text: "Error: Connection not initialized." }],
              details: { error: "No connection" },
            };
          }

          const walletPubkey = await getWalletPublicKey(chatId);
          if (!walletPubkey) {
            return {
              content: [{ type: "text", text: "Error: Wallet not found. Please set up your wallet first." }],
              details: { error: "No wallet" },
            };
          }

          // Get quote first
          const tokenMint = new PublicKey(params.token_mint);
          const quote = await getTradeQuote(NATIVE_MINT, tokenMint, toLamports(params.amount_sol));

          // Execute buy
          const { transaction } = await executeBuy(walletPubkey, tokenMint, params.amount_sol);

          // Sign and send
          const signature = await signAndSendWithPrivy(chatId, transaction, connection);

          const tokensReceived = parseFloat(quote.outAmount) / 1e9;

          return {
            content: [
              {
                type: "text",
                text: `✅ Buy order executed!\n\nSpent: ${params.amount_sol} SOL\nReceived: ~${tokensReceived.toFixed(4)} tokens\nToken: ${formatAddress(params.token_mint)}\n\n[View Transaction](https://solscan.io/tx/${signature})`,
              },
            ],
            details: {
              signature,
              token_mint: params.token_mint,
              amount_sol: params.amount_sol,
              tokens_received: tokensReceived,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error buying token: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Sell Token
    // =========================================================================
    {
      name: "solana_sell_token",
      description:
        "Sell a Solana token for SOL. Executes a swap from the specified token to SOL via Bags.fm.",
      parameters: Type.Object({
        token_mint: Type.String({
          description: "The token mint address to sell",
        }),
        amount_tokens: Type.Number({
          description: "Amount of tokens to sell",
        }),
        decimals: Type.Optional(
          Type.Number({
            description: "Token decimals (default: 9)",
          })
        ),
      }),
      async execute(
        _id: string,
        params: { token_mint: string; amount_tokens: number; decimals?: number },
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
          const connection = getConnection();
          if (!connection) {
            return {
              content: [{ type: "text", text: "Error: Connection not initialized." }],
              details: { error: "No connection" },
            };
          }

          const walletPubkey = await getWalletPublicKey(chatId);
          if (!walletPubkey) {
            return {
              content: [{ type: "text", text: "Error: Wallet not found." }],
              details: { error: "No wallet" },
            };
          }

          const tokenMint = new PublicKey(params.token_mint);
          const decimals = params.decimals || 9;

          // Execute sell
          const { transaction, quote } = await executeSell(
            walletPubkey,
            tokenMint,
            params.amount_tokens,
            decimals
          );

          // Sign and send
          const signature = await signAndSendWithPrivy(chatId, transaction, connection);

          const solReceived = parseFloat(quote.outAmount) / LAMPORTS_PER_SOL;

          return {
            content: [
              {
                type: "text",
                text: `✅ Sell order executed!\n\nSold: ${params.amount_tokens} tokens\nReceived: ~${solReceived.toFixed(4)} SOL\nToken: ${formatAddress(params.token_mint)}\n\n[View Transaction](https://solscan.io/tx/${signature})`,
              },
            ],
            details: {
              signature,
              token_mint: params.token_mint,
              amount_tokens: params.amount_tokens,
              sol_received: solReceived,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error selling token: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Get Quote
    // =========================================================================
    {
      name: "solana_get_trade_quote",
      description:
        "Get a quote for swapping tokens. Shows expected output amount and price impact.",
      parameters: Type.Object({
        input_mint: Type.String({
          description: "Input token mint address (use 'SOL' for native SOL)",
        }),
        output_mint: Type.String({
          description: "Output token mint address (use 'SOL' for native SOL)",
        }),
        amount: Type.Number({
          description: "Amount of input token",
        }),
      }),
      async execute(
        _id: string,
        params: { input_mint: string; output_mint: string; amount: number }
      ) {
        try {
          const inputMint =
            params.input_mint.toUpperCase() === "SOL"
              ? NATIVE_MINT
              : new PublicKey(params.input_mint);

          const outputMint =
            params.output_mint.toUpperCase() === "SOL"
              ? NATIVE_MINT
              : new PublicKey(params.output_mint);

          // Convert to lamports if SOL
          const isInputSol = params.input_mint.toUpperCase() === "SOL";
          const amountRaw = isInputSol ? toLamports(params.amount) : params.amount * 1e9;

          const quote = await getTradeQuote(inputMint, outputMint, amountRaw);

          const outputAmount = parseFloat(quote.outAmount) / 1e9;
          const priceImpact = quote.priceImpactPct || 0;

          return {
            content: [
              {
                type: "text",
                text: `📊 Trade Quote\n\nInput: ${params.amount} ${isInputSol ? "SOL" : formatAddress(params.input_mint)}\nOutput: ~${outputAmount.toFixed(6)} ${params.output_mint.toUpperCase() === "SOL" ? "SOL" : formatAddress(params.output_mint)}\nPrice Impact: ${priceImpact.toFixed(2)}%`,
              },
            ],
            details: quote,
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error getting quote: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Launch Token
    // =========================================================================
    {
      name: "solana_launch_token",
      description:
        "Launch a new token on Bags.fm with automatic liquidity and fee sharing.",
      parameters: Type.Object({
        name: Type.String({
          description: "Token name",
        }),
        symbol: Type.String({
          description: "Token symbol (e.g., 'MOON')",
        }),
        description: Type.String({
          description: "Token description",
        }),
        initial_buy_sol: Type.Number({
          description: "Initial SOL to buy with at launch",
        }),
        image_url: Type.Optional(
          Type.String({
            description: "URL to token image",
          })
        ),
        twitter: Type.Optional(
          Type.String({
            description: "Twitter handle",
          })
        ),
        website: Type.Optional(
          Type.String({
            description: "Website URL",
          })
        ),
        telegram: Type.Optional(
          Type.String({
            description: "Telegram link",
          })
        ),
      }),
      async execute(
        _id: string,
        params: {
          name: string;
          symbol: string;
          description: string;
          initial_buy_sol: number;
          image_url?: string;
          twitter?: string;
          website?: string;
          telegram?: string;
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
          const connection = getConnection();
          if (!connection) {
            return {
              content: [{ type: "text", text: "Error: Connection not initialized." }],
              details: { error: "No connection" },
            };
          }

          const walletPubkey = await getWalletPublicKey(chatId);
          if (!walletPubkey) {
            return {
              content: [{ type: "text", text: "Error: Wallet not found." }],
              details: { error: "No wallet" },
            };
          }

          // Step 1: Create token info
          const tokenInfo = await createTokenInfo(
            walletPubkey,
            params.name,
            params.symbol,
            params.description,
            params.image_url,
            params.twitter,
            params.website,
            params.telegram
          );

          // Step 2: Create fee share config (creator gets 100%)
          const configKey = await createFeeShareConfig(
            tokenInfo.tokenMint,
            walletPubkey,
            [{ user: walletPubkey, userBps: 10000 }]
          );

          // Step 3: Create launch transaction
          const initialBuyLamports = toLamports(params.initial_buy_sol);
          const launchTx = await createTokenLaunchTransaction(
            walletPubkey,
            tokenInfo.tokenMint,
            tokenInfo.tokenMetadata,
            configKey,
            initialBuyLamports
          );

          // Step 4: Sign and send
          const signature = await signAndSendWithPrivy(chatId, launchTx, connection);

          return {
            content: [
              {
                type: "text",
                text: `🚀 Token Launched Successfully!\n\nName: ${params.name}\nSymbol: $${params.symbol}\nMint: \`${tokenInfo.tokenMint.toBase58()}\`\nInitial Buy: ${params.initial_buy_sol} SOL\n\n[View Transaction](https://solscan.io/tx/${signature})\n[View Token](https://solscan.io/token/${tokenInfo.tokenMint.toBase58()})`,
              },
            ],
            details: {
              signature,
              token_mint: tokenInfo.tokenMint.toBase58(),
              name: params.name,
              symbol: params.symbol,
              initial_buy_sol: params.initial_buy_sol,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error launching token: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },

    // =========================================================================
    // Claim Fees
    // =========================================================================
    {
      name: "solana_claim_fees",
      description:
        "View and claim accumulated trading fees from Bags.fm positions.",
      parameters: Type.Object({
        execute: Type.Optional(
          Type.Boolean({
            description: "If true, execute the claim. If false/omitted, just show claimable fees.",
          })
        ),
      }),
      async execute(
        _id: string,
        params: { execute?: boolean },
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
          const walletPubkey = await getWalletPublicKey(chatId);
          if (!walletPubkey) {
            return {
              content: [{ type: "text", text: "Error: Wallet not found." }],
              details: { error: "No wallet" },
            };
          }

          const positions = await getClaimablePositions(walletPubkey);

          if (!positions || positions.length === 0) {
            return {
              content: [{ type: "text", text: "💰 No claimable fees found." }],
              details: { positions: [] },
            };
          }

          // Calculate total claimable
          let totalClaimable = 0;
          for (const pos of positions) {
            totalClaimable += toSol(parseInt(pos.totalClaimableLamportsUserShare || "0", 10));
          }

          if (!params.execute) {
            return {
              content: [
                {
                  type: "text",
                  text: `💰 Claimable Fees\n\nPositions: ${positions.length}\nTotal: ${totalClaimable.toFixed(4)} SOL\n\nUse this tool with execute=true to claim.`,
                },
              ],
              details: { positions, total_sol: totalClaimable },
            };
          }

          // Execute claims
          const connection = getConnection();
          if (!connection) {
            return {
              content: [{ type: "text", text: "Error: Connection not initialized." }],
              details: { error: "No connection" },
            };
          }

          const signatures: string[] = [];
          let totalClaimed = 0;

          for (const position of positions) {
            try {
              const claimData = {
                feeClaimer: walletPubkey.toBase58(),
                tokenMint: position.baseMint,
                virtualPoolAddress: position.virtualPoolAddress || null,
                dammV2Position: position.dammPositionInfo?.position || null,
                dammV2Pool: position.dammPositionInfo?.pool || null,
                claimVirtualPoolFees: !!position.virtualPoolAddress,
                claimDammV2Fees: !!position.dammPositionInfo?.position,
              };

              const txData = await getClaimTransactions(claimData);
              if (!txData || txData.length === 0) continue;

              for (const txItem of txData) {
                const { VersionedTransaction } = await import("@solana/web3.js");
                const tx = VersionedTransaction.deserialize(Buffer.from(txItem.tx, "base64"));

                const signature = await signAndSendWithPrivy(chatId, tx, connection);
                signatures.push(signature);
                totalClaimed += toSol(parseInt(position.totalClaimableLamportsUserShare || "0", 10));
              }
            } catch (err) {
              console.error("Error claiming position:", err);
            }
          }

          return {
            content: [
              {
                type: "text",
                text: `✅ Fees Claimed!\n\nTotal: ${totalClaimed.toFixed(4)} SOL\nTransactions: ${signatures.length}\n\n${signatures.slice(0, 3).map((sig) => `[Tx](https://solscan.io/tx/${sig})`).join("\n")}`,
              },
            ],
            details: { signatures, total_claimed_sol: totalClaimed },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error claiming fees: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      },
    },
  ];
}
