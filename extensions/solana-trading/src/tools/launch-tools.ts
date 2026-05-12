import { extractChatIdFromSession, formatAddress } from "../types.js";
import type { ToolDependencies } from "./index.js";
import { BagsService } from "../services/bags-service.js";
import { JupiterService, getJupiterService } from "../services/jupiter-service.js";

let bagsService: BagsService | null = null;
let jupiterService: JupiterService | null = null;

export function setBagsService(service: BagsService): void {
  bagsService = service;
}

export function setJupiterService(service: JupiterService): void {
  jupiterService = service;
}

export function createLaunchTools(deps: ToolDependencies): any[] {
  // Initialize Jupiter service for quotes if not set
  if (!jupiterService) {
    jupiterService = getJupiterService(deps.logger);
  }

  return [
    {
      name: "trading_launch_token",
      description:
        "Launch a new token on Bags.fm with automatic liquidity and fee sharing. " +
        "This creates a token, sets up metadata, and makes an initial purchase.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Token name (e.g., 'My Awesome Token')",
          },
          symbol: {
            type: "string",
            description: "Token symbol (e.g., 'MAT')",
          },
          description: {
            type: "string",
            description: "Token description",
          },
          initial_buy_sol: {
            type: "number",
            description: "Initial SOL to spend buying the token at launch",
          },
          image_url: {
            type: "string",
            description: "URL to token image (optional)",
          },
          twitter: {
            type: "string",
            description: "Twitter handle (optional)",
          },
          website: {
            type: "string",
            description: "Website URL (optional)",
          },
          telegram: {
            type: "string",
            description: "Telegram link (optional)",
          },
        },
        required: ["name", "symbol", "description", "initial_buy_sol"],
        additionalProperties: false,
      },
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
        ctx?: { sessionKey?: string }
      ) {
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        if (!deps.config.bags?.apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Bags.fm API key not configured. Please add it to the plugin config.",
              },
            ],
          };
        }

        if (params.initial_buy_sol <= 0) {
          return {
            content: [{ type: "text", text: "Initial buy amount must be greater than 0" }],
          };
        }

        if (!bagsService) {
          return {
            content: [{ type: "text", text: "Bags service not initialized." }],
          };
        }

        // Execute the token launch
        const result = await bagsService.launchToken(chatId, {
          name: params.name,
          symbol: params.symbol,
          description: params.description,
          imageUrl: params.image_url || "",
          initialBuySOL: params.initial_buy_sol,
          twitterUrl: params.twitter,
          websiteUrl: params.website,
          telegramUrl: params.telegram,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Token launch failed: ${result.error}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text:
                `🚀 **Token Launched Successfully!**\n\n` +
                `Name: ${params.name}\n` +
                `Symbol: ${params.symbol.toUpperCase()}\n` +
                `Mint: \`${result.tokenMint}\`\n` +
                `Initial Buy: ${params.initial_buy_sol} SOL\n` +
                `Transaction: \`${result.signature}\`\n\n` +
                `View on Solscan: https://solscan.io/tx/${result.signature}`,
            },
          ],
          details: {
            action: "token_launch",
            tokenMint: result.tokenMint,
            signature: result.signature,
          },
        };
      },
    },

    {
      name: "trading_get_quote",
      description: "Get a price quote for buying or selling a token via Jupiter",
      parameters: {
        type: "object",
        properties: {
          token_mint: {
            type: "string",
            description: "Token mint address",
          },
          amount_sol: {
            type: "number",
            description: "Amount in SOL (for buying) or token amount (for selling)",
          },
          side: {
            type: "string",
            enum: ["buy", "sell"],
            description: "Trade direction: 'buy' to purchase tokens, 'sell' to sell tokens",
          },
          slippage: {
            type: "number",
            description: "Slippage tolerance in percentage (default: 1%)",
          },
        },
        required: ["token_mint", "amount_sol", "side"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { token_mint: string; amount_sol: number; side: "buy" | "sell"; slippage?: number },
        _ctx?: { sessionKey?: string }
      ) {
        const SOL_MINT = "So11111111111111111111111111111111111111112";
        const slippageBps = (params.slippage ?? 1) * 100;

        try {
          if (!jupiterService) {
            jupiterService = getJupiterService(deps.logger);
          }

          let quote;
          if (params.side === "buy") {
            // Buying token: SOL -> Token
            quote = await jupiterService.getQuote({
              inputMint: SOL_MINT,
              outputMint: params.token_mint,
              amount: Math.floor(params.amount_sol * 1e9).toString(),
              slippageBps,
            });
          } else {
            // Selling token: Token -> SOL
            quote = await jupiterService.getQuote({
              inputMint: params.token_mint,
              outputMint: SOL_MINT,
              amount: Math.floor(params.amount_sol).toString(),
              slippageBps,
            });
          }

          const priceImpact = parseFloat(quote.priceImpactPct);
          const impactWarning = priceImpact > 3 ? "\n⚠️ High price impact!" : "";

          return {
            content: [
              {
                type: "text",
                text:
                  `📊 **Quote**\n\n` +
                  `${params.side === "buy" ? "Buy" : "Sell"}: ${formatAddress(params.token_mint)}\n` +
                  `Input: ${quote.inAmount} (${params.side === "buy" ? "SOL" : "tokens"})\n` +
                  `Output: ${quote.outAmount} (${params.side === "buy" ? "tokens" : "SOL"})\n` +
                  `Price Impact: ${priceImpact.toFixed(2)}%${impactWarning}\n` +
                  `Slippage: ${params.slippage ?? 1}%\n` +
                  `Route: ${quote.routePlan.map(r => r.swapInfo.label).join(" → ")}`,
              },
            ],
            details: {
              action: "quote",
              quote,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: `Failed to get quote: ${errorMessage}`,
              },
            ],
          };
        }
      },
    },

    {
      name: "trading_claim_fees",
      description: "Claim accumulated fees from token launches on Bags.fm",
      parameters: {
        type: "object",
        properties: {
          token_mint: {
            type: "string",
            description: "Specific token mint to claim fees from (optional, claims all if not specified)",
          },
        },
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { token_mint?: string },
        ctx?: { sessionKey?: string }
      ) {
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        if (!bagsService) {
          return {
            content: [{ type: "text", text: "Bags service not initialized." }],
          };
        }

        // First check claimable fees
        const claimable = await bagsService.getClaimableFees(chatId);
        if (!claimable || claimable.total === 0) {
          return {
            content: [{ type: "text", text: "No fees available to claim." }],
          };
        }

        // Execute claim
        const result = await bagsService.claimFees(chatId, params.token_mint);

        if (!result.success) {
          return {
            content: [{ type: "text", text: `Fee claim failed: ${result.error}` }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text:
                `💰 **Fees Claimed**\n\n` +
                `Amount: ${result.amountClaimed?.toFixed(4)} SOL\n` +
                `Transaction: \`${result.signature}\`\n\n` +
                `View on Solscan: https://solscan.io/tx/${result.signature}`,
            },
          ],
        };
      },
    },

    {
      name: "trading_check_claimable_fees",
      description: "Check how much fees are available to claim from Bags.fm",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      async execute(
        _id: string,
        _params: Record<string, never>,
        ctx?: { sessionKey?: string }
      ) {
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        if (!bagsService) {
          return {
            content: [{ type: "text", text: "Bags service not initialized." }],
          };
        }

        const claimable = await bagsService.getClaimableFees(chatId);
        if (!claimable) {
          return {
            content: [{ type: "text", text: "Unable to fetch claimable fees." }],
          };
        }

        if (claimable.total === 0) {
          return {
            content: [{ type: "text", text: "No fees available to claim." }],
          };
        }

        const tokenList = claimable.byToken
          .map(t => `  - ${formatAddress(t.mint)}: ${t.amount.toFixed(4)} SOL`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text:
                `💰 **Claimable Fees**\n\n` +
                `Total: ${claimable.total.toFixed(4)} SOL\n\n` +
                `By Token:\n${tokenList}`,
            },
          ],
        };
      },
    },
  ];
}
