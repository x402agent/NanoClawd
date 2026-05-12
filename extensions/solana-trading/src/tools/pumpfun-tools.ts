/**
 * Pump.fun Token Launch & Trading Tools
 * 
 * Provides AI agent tools for:
 * - Launching tokens on Pump.fun bonding curve
 * - Buying/selling on bonding curves
 * - Getting quotes and price info
 * - Claiming creator fees
 */

import BN from 'bn.js';

import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';

import {
  calculateMarketCap,
  getBondingCurvePDA,
  PumpFunService,
} from '../services/pumpfun-service.js';
import {
  extractChatIdFromSession,
  formatAddress,
} from '../types.js';
import type { ToolDependencies } from './index.js';

let pumpFunService: PumpFunService | null = null;

export function setPumpFunService(service: PumpFunService): void {
  pumpFunService = service;
}

export function getPumpFunService(): PumpFunService | null {
  return pumpFunService;
}

export function createPumpFunTools(deps: ToolDependencies): any[] {
  // Initialize service if not set
  if (!pumpFunService && deps.config.rpcUrl) {
    pumpFunService = new PumpFunService(
      { rpcUrl: deps.config.rpcUrl },
      deps.logger
    );
  }

  return [
    // =========================================================================
    // TOKEN LAUNCH
    // =========================================================================
    {
      name: "pumpfun_launch_token",
      description:
        "Launch a new token on Pump.fun with a bonding curve. " +
        "Creates a token with automatic liquidity that graduates to PumpSwap AMM when ~85 SOL is raised. " +
        "The creator earns fees from all trades on the bonding curve.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Token name (e.g., 'Awesome Meme Coin')",
          },
          symbol: {
            type: "string", 
            description: "Token symbol, max 10 characters (e.g., 'AMC')",
          },
          metadata_uri: {
            type: "string",
            description: "URI to token metadata JSON (on IPFS or similar)",
          },
          initial_buy_sol: {
            type: "number",
            description: "Optional: SOL to spend buying tokens immediately after launch",
          },
          mayhem_mode: {
            type: "boolean",
            description: "Enable mayhem mode for enhanced features (default: false)",
          },
        },
        required: ["name", "symbol", "metadata_uri"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: {
          name: string;
          symbol: string;
          metadata_uri: string;
          initial_buy_sol?: number;
          mayhem_mode?: boolean;
        },
        ctx?: { sessionKey?: string }
      ) {
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        if (!pumpFunService) {
          return {
            content: [{ type: "text", text: "Pump.fun service not initialized. Check RPC configuration." }],
          };
        }

        // Validate inputs
        if (params.name.length > 32) {
          return {
            content: [{ type: "text", text: "Token name must be 32 characters or less." }],
          };
        }
        if (params.symbol.length > 10) {
          return {
            content: [{ type: "text", text: "Token symbol must be 10 characters or less." }],
          };
        }

        try {
          // Generate new mint keypair
          const mintKeypair = Keypair.generate();
          
          // Note: In production, you'd get the user's wallet and sign
          // For now, return the transaction details for the user to sign
          
          return {
            content: [
              {
                type: "text",
                text:
                  `🚀 **Token Launch Prepared**\n\n` +
                  `**Name:** ${params.name}\n` +
                  `**Symbol:** ${params.symbol.toUpperCase()}\n` +
                  `**Metadata:** ${params.metadata_uri}\n` +
                  `**Mayhem Mode:** ${params.mayhem_mode ? "Enabled" : "Disabled"}\n\n` +
                  `**Mint Address:** \`${mintKeypair.publicKey.toBase58()}\`\n\n` +
                  `⚠️ To complete the launch, you need to sign the transaction with your wallet.\n` +
                  `The bonding curve will start at ~$30k market cap and graduate to PumpSwap at ~$69k.`,
              },
            ],
            details: {
              action: "token_launch_prepared",
              mintAddress: mintKeypair.publicKey.toBase58(),
              mintSecretKey: Array.from(mintKeypair.secretKey),
              params: {
                name: params.name,
                symbol: params.symbol,
                uri: params.metadata_uri,
                isMayhemMode: params.mayhem_mode || false,
              },
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Token launch failed: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // BONDING CURVE INFO
    // =========================================================================
    {
      name: "pumpfun_get_curve_info",
      description:
        "Get detailed information about a Pump.fun token's bonding curve, " +
        "including price, market cap, progress to graduation, and reserves.",
      parameters: {
        type: "object",
        properties: {
          token_mint: {
            type: "string",
            description: "Token mint address",
          },
        },
        required: ["token_mint"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { token_mint: string },
        _ctx?: { sessionKey?: string }
      ) {
        if (!pumpFunService) {
          return {
            content: [{ type: "text", text: "Pump.fun service not initialized." }],
          };
        }

        try {
          const mint = new PublicKey(params.token_mint);
          const curve = await pumpFunService.getBondingCurve(mint);
          
          if (!curve) {
            return {
              content: [{ 
                type: "text", 
                text: `No bonding curve found for ${formatAddress(params.token_mint)}. ` +
                      `This token may have graduated to PumpSwap or doesn't exist.`
              }],
            };
          }

          const price = await pumpFunService.getTokenPrice(mint);
          const progress = await pumpFunService.getBondingCurveProgress(mint);
          const marketCap = calculateMarketCap(curve);
          const marketCapSol = marketCap.toNumber() / LAMPORTS_PER_SOL;
          
          const [bondingCurvePDA] = getBondingCurvePDA(mint);

          return {
            content: [
              {
                type: "text",
                text:
                  `📊 **Pump.fun Bonding Curve**\n\n` +
                  `**Token:** ${formatAddress(params.token_mint)}\n` +
                  `**Bonding Curve:** ${formatAddress(bondingCurvePDA.toBase58())}\n\n` +
                  `**Status:** ${curve.complete ? "🎓 Graduated" : "📈 Active"}\n` +
                  `**Mayhem Mode:** ${curve.isMayhemMode ? "Yes" : "No"}\n\n` +
                  `**Price:** ${price?.toFixed(9) || "N/A"} SOL\n` +
                  `**Market Cap:** ${marketCapSol.toFixed(2)} SOL (~$${(marketCapSol * 150).toFixed(0)})\n` +
                  `**Progress:** ${progress?.toFixed(1)}% to graduation\n\n` +
                  `**Reserves:**\n` +
                  `  Virtual SOL: ${(curve.virtualSolReserves.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL\n` +
                  `  Virtual Tokens: ${(curve.virtualTokenReserves.toNumber() / 1e6).toFixed(0)}M\n` +
                  `  Real SOL: ${(curve.realSolReserves.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL\n\n` +
                  `**Creator:** ${formatAddress(curve.creator.toBase58())}`,
              },
            ],
            details: {
              action: "curve_info",
              mint: params.token_mint,
              bondingCurve: bondingCurvePDA.toBase58(),
              complete: curve.complete,
              price,
              marketCapSol,
              progress,
              creator: curve.creator.toBase58(),
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to get curve info: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // BUY QUOTE
    // =========================================================================
    {
      name: "pumpfun_get_buy_quote",
      description: "Get a quote for buying tokens on a Pump.fun bonding curve",
      parameters: {
        type: "object",
        properties: {
          token_mint: {
            type: "string",
            description: "Token mint address",
          },
          sol_amount: {
            type: "number",
            description: "Amount of SOL to spend",
          },
        },
        required: ["token_mint", "sol_amount"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { token_mint: string; sol_amount: number },
        _ctx?: { sessionKey?: string }
      ) {
        if (!pumpFunService) {
          return {
            content: [{ type: "text", text: "Pump.fun service not initialized." }],
          };
        }

        try {
          const mint = new PublicKey(params.token_mint);
          const quote = await pumpFunService.getBuyQuote(mint, params.sol_amount);
          
          if (!quote) {
            return {
              content: [{ 
                type: "text", 
                text: `Cannot get quote. Token may have graduated or doesn't exist.`
              }],
            };
          }

          const tokensOut = quote.outputAmount.toNumber() / 1e6; // Assuming 6 decimals
          const fee = quote.fee.toNumber() / LAMPORTS_PER_SOL;
          const pricePerToken = params.sol_amount / tokensOut;

          return {
            content: [
              {
                type: "text",
                text:
                  `💰 **Buy Quote**\n\n` +
                  `**Input:** ${params.sol_amount} SOL\n` +
                  `**Output:** ${tokensOut.toFixed(2)} tokens\n` +
                  `**Price:** ${pricePerToken.toFixed(9)} SOL per token\n` +
                  `**Fee (1%):** ${fee.toFixed(4)} SOL\n` +
                  `**Price Impact:** ${quote.priceImpact.toFixed(2)}%\n\n` +
                  (quote.priceImpact > 3 ? "⚠️ High price impact!" : "✅ Low price impact"),
              },
            ],
            details: {
              action: "buy_quote",
              input: params.sol_amount,
              output: tokensOut,
              priceImpact: quote.priceImpact,
              fee,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to get quote: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // SELL QUOTE
    // =========================================================================
    {
      name: "pumpfun_get_sell_quote",
      description: "Get a quote for selling tokens on a Pump.fun bonding curve",
      parameters: {
        type: "object",
        properties: {
          token_mint: {
            type: "string",
            description: "Token mint address",
          },
          token_amount: {
            type: "number",
            description: "Amount of tokens to sell",
          },
        },
        required: ["token_mint", "token_amount"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { token_mint: string; token_amount: number },
        _ctx?: { sessionKey?: string }
      ) {
        if (!pumpFunService) {
          return {
            content: [{ type: "text", text: "Pump.fun service not initialized." }],
          };
        }

        try {
          const mint = new PublicKey(params.token_mint);
          const tokenAmountBN = new BN(params.token_amount * 1e6); // Assuming 6 decimals
          const quote = await pumpFunService.getSellQuote(mint, tokenAmountBN);
          
          if (!quote) {
            return {
              content: [{ 
                type: "text", 
                text: `Cannot get quote. Token may have graduated or doesn't exist.`
              }],
            };
          }

          const solOut = quote.outputAmount.toNumber() / LAMPORTS_PER_SOL;
          const fee = quote.fee.toNumber() / LAMPORTS_PER_SOL;
          const pricePerToken = solOut / params.token_amount;

          return {
            content: [
              {
                type: "text",
                text:
                  `💸 **Sell Quote**\n\n` +
                  `**Input:** ${params.token_amount} tokens\n` +
                  `**Output:** ${solOut.toFixed(4)} SOL\n` +
                  `**Price:** ${pricePerToken.toFixed(9)} SOL per token\n` +
                  `**Fee (1%):** ${fee.toFixed(4)} SOL\n` +
                  `**Price Impact:** ${quote.priceImpact.toFixed(2)}%\n\n` +
                  (quote.priceImpact > 3 ? "⚠️ High price impact!" : "✅ Low price impact"),
              },
            ],
            details: {
              action: "sell_quote",
              input: params.token_amount,
              output: solOut,
              priceImpact: quote.priceImpact,
              fee,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to get quote: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // CHECK CREATOR FEES
    // =========================================================================
    {
      name: "pumpfun_check_creator_fees",
      description: "Check claimable creator fees from Pump.fun token launches",
      parameters: {
        type: "object",
        properties: {
          creator_address: {
            type: "string",
            description: "Creator's wallet address",
          },
        },
        required: ["creator_address"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { creator_address: string },
        _ctx?: { sessionKey?: string }
      ) {
        if (!pumpFunService) {
          return {
            content: [{ type: "text", text: "Pump.fun service not initialized." }],
          };
        }

        try {
          const creator = new PublicKey(params.creator_address);
          const claimable = await pumpFunService.getClaimableCreatorFees(creator);

          if (claimable === 0) {
            return {
              content: [{ type: "text", text: "No fees available to claim." }],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `💰 **Claimable Creator Fees**\n\n` +
                  `**Creator:** ${formatAddress(params.creator_address)}\n` +
                  `**Amount:** ${claimable.toFixed(4)} SOL (~$${(claimable * 150).toFixed(2)})\n\n` +
                  `Use \`pumpfun_claim_creator_fees\` to claim.`,
              },
            ],
            details: {
              action: "check_fees",
              creator: params.creator_address,
              claimable,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to check fees: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // CHECK TOKEN GRADUATION STATUS
    // =========================================================================
    {
      name: "pumpfun_check_graduation",
      description: "Check if a Pump.fun token has graduated to PumpSwap AMM",
      parameters: {
        type: "object",
        properties: {
          token_mint: {
            type: "string",
            description: "Token mint address",
          },
        },
        required: ["token_mint"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { token_mint: string },
        _ctx?: { sessionKey?: string }
      ) {
        if (!pumpFunService) {
          return {
            content: [{ type: "text", text: "Pump.fun service not initialized." }],
          };
        }

        try {
          const mint = new PublicKey(params.token_mint);
          const isComplete = await pumpFunService.isBondingCurveComplete(mint);
          const progress = await pumpFunService.getBondingCurveProgress(mint);

          if (isComplete) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    `🎓 **Token Graduated!**\n\n` +
                    `${formatAddress(params.token_mint)} has completed its bonding curve ` +
                    `and migrated to PumpSwap AMM.\n\n` +
                    `You can now trade it with lower fees on the AMM.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `📈 **Still on Bonding Curve**\n\n` +
                  `**Progress:** ${progress?.toFixed(1)}% to graduation\n` +
                  `**Remaining:** ~${(85 - (progress || 0) * 0.85).toFixed(1)} SOL to reach ~$69k market cap\n\n` +
                  `The token will automatically migrate to PumpSwap when the target is reached.`,
              },
            ],
            details: {
              action: "check_graduation",
              mint: params.token_mint,
              graduated: false,
              progress,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to check graduation: ${errorMessage}` }],
          };
        }
      },
    },

    // =========================================================================
    // CLAIM CREATOR FEES
    // =========================================================================
    {
      name: "pumpfun_claim_creator_fees",
      description:
        "Claim accumulated creator fees from Pump.fun token launches. " +
        "Creator fees are earned from all trades on your token's bonding curve (typically 1% of each trade).",
      parameters: {
        type: "object",
        properties: {
          creator_address: {
            type: "string",
            description: "Creator's wallet address to claim fees for",
          },
        },
        required: ["creator_address"],
        additionalProperties: false,
      },
      async execute(
        _id: string,
        params: { creator_address: string },
        ctx?: { sessionKey?: string }
      ) {
        const chatId = ctx?.sessionKey ? extractChatIdFromSession(ctx.sessionKey) : null;

        if (!chatId) {
          return {
            content: [{ type: "text", text: "Unable to identify chat. Please try again." }],
          };
        }

        if (!pumpFunService) {
          return {
            content: [{ type: "text", text: "Pump.fun service not initialized." }],
          };
        }

        try {
          const creator = new PublicKey(params.creator_address);

          // First check if there are fees to claim
          const claimable = await pumpFunService.getClaimableCreatorFees(creator);

          if (claimable === 0) {
            return {
              content: [{ type: "text", text: "No fees available to claim for this address." }],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `💰 **Creator Fee Claim Prepared**\n\n` +
                  `**Creator:** ${formatAddress(params.creator_address)}\n` +
                  `**Claimable Amount:** ${claimable.toFixed(4)} SOL (~$${(claimable * 150).toFixed(2)})\n\n` +
                  `⚠️ To complete the claim, you need to sign the transaction with your wallet.\n` +
                  `The fees will be transferred to your wallet address.`,
              },
            ],
            details: {
              action: "claim_fees_prepared",
              creator: params.creator_address,
              claimableAmount: claimable,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Failed to claim creator fees: ${errorMessage}` }],
          };
        }
      },
    },
  ];
}

export default createPumpFunTools;
