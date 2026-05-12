/**
 * Bags.fm AI Agent Tools for Clawdbot
 * Provides token launch and trading tools for the AI agent
 */

import { z } from 'zod';

import type { BagsSDKService } from '../services/bags-sdk-service.js';
import type { ToolContext } from '../types.js';

// Tool input schemas
const launchTokenSchema = z.object({
  name: z.string().describe('Token name (e.g., "My Token")'),
  symbol: z.string().describe('Token symbol (e.g., "MTK")'),
  description: z.string().describe('Token description'),
  imageUrl: z.string().url().describe('URL to token image'),
  initialBuySOL: z.number().optional().describe('Initial SOL to buy (optional, default 0)'),
  twitterUrl: z.string().url().optional().describe('Twitter/X profile URL'),
  websiteUrl: z.string().url().optional().describe('Website URL'),
  telegramUrl: z.string().url().optional().describe('Telegram group URL'),
});

const buyTokenSchema = z.object({
  tokenMint: z.string().describe('Token mint address to buy'),
  solAmount: z.number().positive().describe('Amount of SOL to spend'),
  slippageBps: z.number().int().min(0).max(10000).optional().describe('Slippage in basis points (default 500 = 5%)'),
});

const sellTokenSchema = z.object({
  tokenMint: z.string().describe('Token mint address to sell'),
  tokenAmount: z.number().positive().describe('Amount of tokens to sell'),
  slippageBps: z.number().int().min(0).max(10000).optional().describe('Slippage in basis points (default 500 = 5%)'),
});

const getQuoteSchema = z.object({
  inputMint: z.string().describe('Input token mint address'),
  outputMint: z.string().describe('Output token mint address'),
  amount: z.number().positive().describe('Amount of input tokens (in smallest units)'),
  slippageBps: z.number().int().min(0).max(10000).optional().describe('Slippage in basis points (default 500 = 5%)'),
});

const getTokenBalanceSchema = z.object({
  tokenMint: z.string().describe('Token mint address to check balance for'),
});

/**
 * Create Bags.fm tools for the AI agent
 */
export function createBagsTools(bagsService: BagsSDKService, _ctx: ToolContext) {
  return {
    /**
     * Launch a new token on Bags.fm
     */
    bags_launch_token: {
      name: 'bags_launch_token',
      description: 'Launch a new token on Bags.fm (Solana launchpad). Creates token metadata, uploads to IPFS, and deploys the token with dynamic bonding curve.',
      inputSchema: launchTokenSchema,
      execute: async (input: z.infer<typeof launchTokenSchema>) => {
        const result = await bagsService.launchToken({
          name: input.name,
          symbol: input.symbol,
          description: input.description,
          imageUrl: input.imageUrl,
          initialBuySOL: input.initialBuySOL,
          twitterUrl: input.twitterUrl,
          websiteUrl: input.websiteUrl,
          telegramUrl: input.telegramUrl,
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          };
        }

        return {
          success: true,
          tokenMint: result.tokenMint,
          metadataUrl: result.metadataUrl,
          signature: result.signature,
          solscanUrl: `https://solscan.io/tx/${result.signature}`,
          bagsUrl: `https://bags.fm/token/${result.tokenMint}`,
        };
      },
    },

    /**
     * Buy tokens using SOL via Bags Trade API
     */
    bags_buy_token: {
      name: 'bags_buy_token',
      description: 'Buy tokens on Bags.fm using SOL. Uses Jupiter aggregator for best prices.',
      inputSchema: buyTokenSchema,
      execute: async (input: z.infer<typeof buyTokenSchema>) => {
        const result = await bagsService.buyToken(
          input.tokenMint,
          input.solAmount,
          input.slippageBps ?? 500
        );

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          };
        }

        return {
          success: true,
          tokensReceived: result.amountOut,
          signature: result.signature,
          solscanUrl: `https://solscan.io/tx/${result.signature}`,
        };
      },
    },

    /**
     * Sell tokens for SOL via Bags Trade API
     */
    bags_sell_token: {
      name: 'bags_sell_token',
      description: 'Sell tokens on Bags.fm for SOL. Uses Jupiter aggregator for best prices.',
      inputSchema: sellTokenSchema,
      execute: async (input: z.infer<typeof sellTokenSchema>) => {
        const result = await bagsService.sellToken(
          input.tokenMint,
          input.tokenAmount,
          input.slippageBps ?? 500
        );

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          };
        }

        return {
          success: true,
          solReceived: result.amountOut,
          signature: result.signature,
          solscanUrl: `https://solscan.io/tx/${result.signature}`,
        };
      },
    },

    /**
     * Get swap quote without executing
     */
    bags_get_quote: {
      name: 'bags_get_quote',
      description: 'Get a swap quote from Bags.fm Trade API without executing the trade.',
      inputSchema: getQuoteSchema,
      execute: async (input: z.infer<typeof getQuoteSchema>) => {
        const quote = await bagsService.getSwapQuote(
          input.inputMint,
          input.outputMint,
          input.amount,
          input.slippageBps ?? 500
        );

        if (!quote) {
          return {
            success: false,
            error: 'Failed to get quote',
          };
        }

        return {
          success: true,
          inputAmount: quote.inputAmount,
          outputAmount: quote.outputAmount,
          priceImpact: quote.priceImpact,
          route: quote.route,
        };
      },
    },

    /**
     * Get wallet SOL balance
     */
    bags_get_balance: {
      name: 'bags_get_balance',
      description: 'Get the SOL balance of the configured trading wallet.',
      inputSchema: z.object({}),
      execute: async () => {
        const balance = await bagsService.getBalance();
        const walletAddress = bagsService.getWalletPublicKey();

        return {
          success: true,
          balanceSOL: balance,
          walletAddress,
        };
      },
    },

    /**
     * Get token balance for wallet
     */
    bags_get_token_balance: {
      name: 'bags_get_token_balance',
      description: 'Get the balance of a specific token in the trading wallet.',
      inputSchema: getTokenBalanceSchema,
      execute: async (input: z.infer<typeof getTokenBalanceSchema>) => {
        const balance = await bagsService.getTokenBalance(input.tokenMint);
        const walletAddress = bagsService.getWalletPublicKey();

        return {
          success: true,
          tokenMint: input.tokenMint,
          balance,
          walletAddress,
        };
      },
    },
  };
}

export type BagsTools = ReturnType<typeof createBagsTools>;
