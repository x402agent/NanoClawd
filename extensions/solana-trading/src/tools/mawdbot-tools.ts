/**
 * MawdBot AI Agent Tools for Clawdbot
 * Complete token launch, trading, fee claiming, and analytics tools
 */

import { z } from 'zod';

import type { MawdBotLauncher } from '../services/mawdbot-launcher.js';

// Tool input schemas
const launchTokenSchema = z.object({
  name: z.string().describe('Token name (e.g., "MawdBot Token")'),
  symbol: z.string().describe('Token symbol (e.g., "MAWD")'),
  description: z.string().describe('Token description'),
  imageUrl: z.string().url().optional().describe('URL to token image'),
  initialBuyAmountSol: z.number().min(0).describe('Initial SOL to buy (e.g., 0.01)'),
  twitterUrl: z.string().url().optional().describe('Twitter/X profile URL'),
  websiteUrl: z.string().url().optional().describe('Website URL'),
  telegramUrl: z.string().url().optional().describe('Telegram group URL'),
});

const executeSwapSchema = z.object({
  inputMint: z.string().describe('Input token mint address'),
  outputMint: z.string().describe('Output token mint address'),
  amount: z.number().positive().describe('Amount to swap (in smallest units)'),
  slippageMode: z.enum(['auto', 'manual']).optional().describe('Slippage mode (default: auto)'),
  slippageBps: z.number().int().min(0).max(10000).optional().describe('Manual slippage in basis points'),
});

const tokenMintSchema = z.object({
  tokenMint: z.string().describe('Token mint address'),
});

const claimEventsSchema = z.object({
  tokenMint: z.string().describe('Token mint address'),
  limit: z.number().int().min(1).max(100).optional().describe('Max events to return (default 50)'),
});

/**
 * Create MawdBot tools for the AI agent
 */
export function createMawdBotTools(launcher: MawdBotLauncher) {
  return {
    /**
     * Launch a new token on Bags.fm with full fee share config
     */
    mawdbot_launch_token: {
      name: 'mawdbot_launch_token',
      description: 'Launch a new token on Bags.fm with automatic metadata upload, fee share config creation, and optional Jito bundle submission. This is the complete autonomous token launch.',
      inputSchema: launchTokenSchema,
      execute: async (input: z.infer<typeof launchTokenSchema>) => {
        try {
          const result = await launcher.launchToken({
            name: input.name,
            symbol: input.symbol,
            description: input.description,
            imageUrl: input.imageUrl,
            initialBuyAmountSol: input.initialBuyAmountSol,
            twitterUrl: input.twitterUrl,
            websiteUrl: input.websiteUrl,
            telegramUrl: input.telegramUrl,
          });

          return {
            success: true,
            tokenMint: result.tokenMint,
            metadataUri: result.metadataUri,
            configKey: result.configKey,
            signature: result.launchSignature,
            tokenUrl: result.tokenUrl,
            solscanUrl: `https://solscan.io/tx/${result.launchSignature}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Execute a token swap via Bags Trade API
     */
    mawdbot_swap: {
      name: 'mawdbot_swap',
      description: 'Execute a token swap on Bags.fm using Jupiter aggregator. Supports auto or manual slippage.',
      inputSchema: executeSwapSchema,
      execute: async (input: z.infer<typeof executeSwapSchema>) => {
        try {
          const signature = await launcher.executeSwap(
            input.inputMint,
            input.outputMint,
            input.amount,
            input.slippageMode ?? 'auto',
            input.slippageBps
          );

          return {
            success: true,
            signature,
            solscanUrl: `https://solscan.io/tx/${signature}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Claim all accrued fees from launched tokens
     */
    mawdbot_claim_all_fees: {
      name: 'mawdbot_claim_all_fees',
      description: 'Claim all accrued fees from all tokens launched by this wallet.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const signatures = await launcher.claimAllFees();

          if (signatures.length === 0) {
            return {
              success: true,
              message: 'No claimable fees found',
              signatures: [],
            };
          }

          return {
            success: true,
            claimedCount: signatures.length,
            signatures,
            solscanUrls: signatures.map(sig => `https://solscan.io/tx/${sig}`),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Claim fees for a specific token
     */
    mawdbot_claim_token_fees: {
      name: 'mawdbot_claim_token_fees',
      description: 'Claim accrued fees for a specific token.',
      inputSchema: tokenMintSchema,
      execute: async (input: z.infer<typeof tokenMintSchema>) => {
        try {
          const signatures = await launcher.claimFeesForToken(input.tokenMint);

          if (signatures.length === 0) {
            return {
              success: true,
              message: 'No claimable fees found for this token',
              signatures: [],
            };
          }

          return {
            success: true,
            claimedCount: signatures.length,
            signatures,
            solscanUrls: signatures.map(sig => `https://solscan.io/tx/${sig}`),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Get claimable positions
     */
    mawdbot_get_claimable: {
      name: 'mawdbot_get_claimable',
      description: 'Get all claimable fee positions for the wallet.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const positions = await launcher.getClaimablePositions();

          return {
            success: true,
            positionCount: positions.length,
            positions: positions.map(p => ({
              baseMint: p.baseMint,
              // Include other position details as available
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Get token lifetime fees
     */
    mawdbot_token_fees: {
      name: 'mawdbot_token_fees',
      description: 'Get total lifetime fees generated by a token.',
      inputSchema: tokenMintSchema,
      execute: async (input: z.infer<typeof tokenMintSchema>) => {
        try {
          const lifetimeFees = await launcher.getTokenLifetimeFees(input.tokenMint);

          return {
            success: true,
            tokenMint: input.tokenMint,
            lifetimeFeesLamports: lifetimeFees,
            lifetimeFeesSol: lifetimeFees / 1e9,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Get token creators
     */
    mawdbot_token_creators: {
      name: 'mawdbot_token_creators',
      description: 'Get the creators/fee claimers for a token.',
      inputSchema: tokenMintSchema,
      execute: async (input: z.infer<typeof tokenMintSchema>) => {
        try {
          const creators = await launcher.getTokenCreators(input.tokenMint);

          return {
            success: true,
            tokenMint: input.tokenMint,
            creators,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Get token claim stats
     */
    mawdbot_token_claim_stats: {
      name: 'mawdbot_token_claim_stats',
      description: 'Get claim statistics for a token.',
      inputSchema: tokenMintSchema,
      execute: async (input: z.infer<typeof tokenMintSchema>) => {
        try {
          const stats = await launcher.getTokenClaimStats(input.tokenMint);

          return {
            success: true,
            tokenMint: input.tokenMint,
            stats,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Get token claim events
     */
    mawdbot_token_claim_events: {
      name: 'mawdbot_token_claim_events',
      description: 'Get recent claim events for a token.',
      inputSchema: claimEventsSchema,
      execute: async (input: z.infer<typeof claimEventsSchema>) => {
        try {
          const events = await launcher.getTokenClaimEvents(input.tokenMint, {
            limit: input.limit ?? 50,
          });

          return {
            success: true,
            tokenMint: input.tokenMint,
            events,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Create partner config
     */
    mawdbot_create_partner: {
      name: 'mawdbot_create_partner',
      description: 'Create a partner config to earn referral fees from tokens launched via your platform.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const partnerKey = await launcher.createPartnerKey();

          return {
            success: true,
            partnerKey,
            message: 'Partner config created. Use this key when launching tokens to earn partner fees.',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Claim partner fees
     */
    mawdbot_claim_partner_fees: {
      name: 'mawdbot_claim_partner_fees',
      description: 'Claim accumulated partner/referral fees.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const signatures = await launcher.claimPartnerFees();

          if (signatures.length === 0) {
            return {
              success: true,
              message: 'No partner fees to claim',
              signatures: [],
            };
          }

          return {
            success: true,
            claimedCount: signatures.length,
            signatures,
            solscanUrls: signatures.map(sig => `https://solscan.io/tx/${sig}`),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Health check
     */
    mawdbot_health: {
      name: 'mawdbot_health',
      description: 'Check if Bags API is healthy and reachable.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const healthy = await launcher.healthCheck();
          const balance = await launcher.getSolBalance();

          return {
            success: true,
            apiHealthy: healthy,
            walletAddress: launcher.walletAddress,
            balanceSol: balance,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Get wallet balance
     */
    mawdbot_balance: {
      name: 'mawdbot_balance',
      description: 'Get SOL balance of the trading wallet.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const balance = await launcher.getSolBalance();

          return {
            success: true,
            walletAddress: launcher.walletAddress,
            balanceSol: balance,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    /**
     * Get token balance
     */
    mawdbot_token_balance: {
      name: 'mawdbot_token_balance',
      description: 'Get balance of a specific token in the trading wallet.',
      inputSchema: tokenMintSchema,
      execute: async (input: z.infer<typeof tokenMintSchema>) => {
        try {
          const balance = await launcher.getTokenBalance(input.tokenMint);

          return {
            success: true,
            tokenMint: input.tokenMint,
            balance,
            walletAddress: launcher.walletAddress,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },
  };
}

export type MawdBotTools = ReturnType<typeof createMawdBotTools>;
