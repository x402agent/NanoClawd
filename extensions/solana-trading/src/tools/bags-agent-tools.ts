/**
 * Comprehensive Bags.fm Agent Tools
 * Exposes all Bags API v2 endpoints to AI agents
 */

import { z } from 'zod';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { BagsAgentService } from '../services/bags-agent-service.js';

export function createBagsAgentTools(service: BagsAgentService) {
  return {
    // ═══════════════════════════════════════════════════════════
    // HEALTH & STATUS
    // ═══════════════════════════════════════════════════════════

    bags_agent_health: {
      name: 'bags_agent_health',
      description: 'Check Bags API health and wallet balance',
      inputSchema: z.object({}),
      async execute() {
        const pong = await service.ping();
        const balance = await service.getBalance();
        const wallet = service.walletPublicKey;

        return {
          api: pong === 'pong' ? '✅ Online' : '❌ Offline',
          wallet: wallet?.toBase58() || '❌ Not configured',
          balance: `${balance.toFixed(4)} SOL`,
        };
      },
    },

    // ═══════════════════════════════════════════════════════════
    // TOKEN LAUNCH
    // ═══════════════════════════════════════════════════════════

    bags_agent_launch_token: {
      name: 'bags_agent_launch_token',
      description: 'Launch a new token on Bags.fm with fee sharing and metadata',
      inputSchema: z.object({
        name: z.string().describe('Token name'),
        symbol: z.string().describe('Token symbol (without $)'),
        description: z.string().describe('Token description'),
        imageUrl: z.string().describe('Image URL'),
        initialBuySOL: z.number().describe('Initial buy amount in SOL (e.g., 0.01)'),
        twitter: z.string().optional().describe('Twitter URL'),
        website: z.string().optional().describe('Website URL'),
        telegram: z.string().optional().describe('Telegram URL'),
        feeClaimers: z
          .array(
            z.object({
              provider: z.enum(['twitter', 'kick', 'github']).describe('Social provider'),
              username: z.string().describe('Username on that platform'),
              bps: z.number().describe('Fee share in basis points (100 bps = 1%)'),
            })
          )
          .optional()
          .describe('Fee share recipients (total must be <= 10000 bps)'),
      }),
      async execute(params: any) {
        const result = await service.launchToken({
          name: params.name,
          symbol: params.symbol,
          description: params.description,
          imageUrl: params.imageUrl,
          initialBuyLamports: Math.floor(params.initialBuySOL * LAMPORTS_PER_SOL),
          twitter: params.twitter,
          website: params.website,
          telegram: params.telegram,
          feeClaimers: params.feeClaimers,
        });

        return {
          success: true,
          tokenMint: result.tokenMint,
          signature: result.signature,
          bagsUrl: `https://bags.fm/${result.tokenMint}`,
          solscanUrl: `https://solscan.io/tx/${result.signature}`,
        };
      },
    },

    // ═══════════════════════════════════════════════════════════
    // FEE SHARE LOOKUP
    // ═══════════════════════════════════════════════════════════

    bags_agent_lookup_fee_share_wallet: {
      name: 'bags_agent_lookup_fee_share_wallet',
      description: 'Look up Bags fee share wallet for a social media username',
      inputSchema: z.object({
        provider: z.enum(['twitter', 'kick', 'github']).describe('Social platform'),
        username: z.string().describe('Username on that platform'),
      }),
      async execute(params: any) {
        const result = await service.getFeeShareWalletV2(params.provider, params.username);

        return {
          provider: result.provider,
          username: result.platformData.username,
          displayName: result.platformData.display_name,
          wallet: result.wallet,
          avatar: result.platformData.avatar_url,
        };
      },
    },

    bags_agent_lookup_fee_share_bulk: {
      name: 'bags_agent_lookup_fee_share_bulk',
      description: 'Bulk lookup of fee share wallets (multiple users at once)',
      inputSchema: z.object({
        users: z
          .array(
            z.object({
              provider: z.enum(['twitter', 'kick', 'github']),
              username: z.string(),
            })
          )
          .describe('Array of users to look up'),
      }),
      async execute(params: any) {
        const results = await service.getFeeShareWalletV2Bulk(params.users);

        return {
          count: results.length,
          wallets: results.map((r) => ({
            provider: r.provider,
            username: r.platformData.username,
            wallet: r.wallet,
          })),
        };
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ANALYTICS
    // ═══════════════════════════════════════════════════════════

    bags_agent_get_token_creators: {
      name: 'bags_agent_get_token_creators',
      description: 'Get token creators and fee claimers for a Bags token',
      inputSchema: z.object({
        tokenMint: z.string().describe('Token mint address'),
      }),
      async execute(params: any) {
        const creators = await service.getTokenLaunchCreators(params.tokenMint);

        return {
          tokenMint: params.tokenMint,
          creators: creators.map((c) => ({
            username: c.username,
            provider: c.provider,
            wallet: c.wallet,
            royaltyBps: c.royaltyBps,
            royaltyPercent: c.royaltyBps / 100,
            isCreator: c.isCreator,
            pfp: c.pfp,
          })),
        };
      },
    },

    bags_agent_get_lifetime_fees: {
      name: 'bags_agent_get_lifetime_fees',
      description: 'Get total lifetime fees earned by a token',
      inputSchema: z.object({
        tokenMint: z.string().describe('Token mint address'),
      }),
      async execute(params: any) {
        const fees = await service.getTokenLifetimeFees(params.tokenMint);

        return {
          tokenMint: params.tokenMint,
          ...fees,
        };
      },
    },

    bags_agent_get_claim_stats: {
      name: 'bags_agent_get_claim_stats',
      description: 'Get fee claim statistics for a token',
      inputSchema: z.object({
        tokenMint: z.string().describe('Token mint address'),
      }),
      async execute(params: any) {
        const stats = await service.getTokenClaimStats(params.tokenMint);

        return {
          tokenMint: params.tokenMint,
          ...stats,
        };
      },
    },

    bags_agent_get_claim_events: {
      name: 'bags_agent_get_claim_events',
      description: 'Get recent fee claim events for a token',
      inputSchema: z.object({
        tokenMint: z.string().describe('Token mint address'),
      }),
      async execute(params: any) {
        const events = await service.getTokenClaimEvents(params.tokenMint);

        return {
          tokenMint: params.tokenMint,
          events,
        };
      },
    },

    // ═══════════════════════════════════════════════════════════
    // FEE CLAIMING
    // ═══════════════════════════════════════════════════════════

    bags_agent_get_claimable_positions: {
      name: 'bags_agent_get_claimable_positions',
      description: 'Get all claimable fee positions for wallet',
      inputSchema: z.object({
        wallet: z.string().optional().describe('Wallet address (defaults to configured wallet)'),
      }),
      async execute(params: any) {
        const positions = await service.getClaimablePositions(params.wallet);

        return {
          count: positions.length,
          totalClaimableSOL: positions.reduce(
            (sum, p) => sum + Number(p.totalClaimableLamportsUserShare || 0) / LAMPORTS_PER_SOL,
            0
          ),
          positions: positions.map((p) => ({
            tokenMint: p.baseMint,
            claimableSOL: (Number(p.totalClaimableLamportsUserShare || 0) / LAMPORTS_PER_SOL).toFixed(6),
            programId: p.programId,
            isCustomFeeVault: p.isCustomFeeVault,
            isMigrated: p.isMigrated,
          })),
        };
      },
    },

    bags_agent_claim_fees: {
      name: 'bags_agent_claim_fees',
      description: 'Claim fees for a specific token mint',
      inputSchema: z.object({
        tokenMint: z.string().describe('Token mint address'),
      }),
      async execute(params: any) {
        await service.claimFeesForToken(params.tokenMint);

        return {
          success: true,
          message: `Fees claimed for ${params.tokenMint}`,
        };
      },
    },

    // ═══════════════════════════════════════════════════════════
    // TRADE (SWAP)
    // ═══════════════════════════════════════════════════════════

    bags_agent_get_quote: {
      name: 'bags_agent_get_quote',
      description: 'Get swap quote from Bags Trade API (Jupiter-powered)',
      inputSchema: z.object({
        inputMint: z.string().describe('Input token mint address'),
        outputMint: z.string().describe('Output token mint address'),
        amount: z.number().describe('Amount in smallest unit (lamports for SOL)'),
        slippageMode: z.enum(['auto', 'manual']).optional().describe('Slippage mode (default: auto)'),
        slippageBps: z.number().optional().describe('Manual slippage in basis points (0-10000)'),
      }),
      async execute(params: any) {
        const quote = await service.getTradeQuote(params);

        return {
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          minOutputAmount: quote.minOutAmount,
          priceImpact: `${quote.priceImpactPct}%`,
          slippage: `${quote.slippageBps / 100}%`,
          route: quote.routePlan.map((leg) => ({
            venue: leg.venue,
            inputMint: leg.inputMint,
            outputMint: leg.outputMint,
            inAmount: leg.inAmount,
            outAmount: leg.outAmount,
          })),
          platformFee: quote.platformFee
            ? {
                amount: quote.platformFee.amount,
                bps: quote.platformFee.feeBps,
              }
            : null,
        };
      },
    },

    bags_agent_swap: {
      name: 'bags_agent_swap',
      description: 'Execute token swap using Bags Trade API',
      inputSchema: z.object({
        inputMint: z.string().describe('Input token mint address'),
        outputMint: z.string().describe('Output token mint address'),
        amount: z.number().describe('Amount in smallest unit (lamports for SOL)'),
        slippageMode: z.enum(['auto', 'manual']).optional().describe('Slippage mode (default: auto)'),
        slippageBps: z.number().optional().describe('Manual slippage in basis points (0-10000)'),
      }),
      async execute(params: any) {
        const result = await service.executeSwap(params);

        return {
          success: true,
          signature: result.signature,
          inputAmount: result.quote.inAmount,
          outputAmount: result.quote.outAmount,
          priceImpact: result.quote.priceImpactPct,
          solscanUrl: `https://solscan.io/tx/${result.signature}`,
        };
      },
    },

    // ═══════════════════════════════════════════════════════════
    // PARTNER
    // ═══════════════════════════════════════════════════════════

    bags_agent_get_partner_stats: {
      name: 'bags_agent_get_partner_stats',
      description: 'Get partner fee statistics (claimed and unclaimed)',
      inputSchema: z.object({
        partner: z.string().optional().describe('Partner wallet (defaults to configured wallet)'),
      }),
      async execute(params: any) {
        const wallet = params.partner || service.walletPublicKey?.toBase58();
        if (!wallet) throw new Error('Wallet not configured');

        const stats = await service.getPartnerStats(wallet);

        return {
          partner: wallet,
          claimedSOL: (Number(stats.claimedFees) / LAMPORTS_PER_SOL).toFixed(6),
          unclaimedSOL: (Number(stats.unclaimedFees) / LAMPORTS_PER_SOL).toFixed(6),
        };
      },
    },

    bags_agent_claim_partner_fees: {
      name: 'bags_agent_claim_partner_fees',
      description: 'Claim all unclaimed partner fees',
      inputSchema: z.object({
        partner: z.string().optional().describe('Partner wallet (defaults to configured wallet)'),
      }),
      async execute(params: any) {
        await service.claimPartnerFees(params.partner);

        return {
          success: true,
          message: 'Partner fees claimed successfully',
        };
      },
    },

    bags_agent_create_partner_config: {
      name: 'bags_agent_create_partner_config',
      description: 'Create a new partner configuration',
      inputSchema: z.object({
        partner: z.string().describe('Partner wallet address'),
        bps: z.number().describe('Fee share in basis points (100 bps = 1%)'),
      }),
      async execute(params: any) {
        const result = await service.createPartnerConfig(params);

        return {
          success: true,
          partner: params.partner,
          feeBps: params.bps,
          feePercent: params.bps / 100,
          ...result,
        };
      },
    },

    // ═══════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════

    bags_agent_get_balance: {
      name: 'bags_agent_get_balance',
      description: 'Get wallet SOL balance',
      inputSchema: z.object({}),
      async execute() {
        const balance = await service.getBalance();
        const wallet = service.walletPublicKey;

        return {
          wallet: wallet?.toBase58() || 'Not configured',
          balance: `${balance.toFixed(6)} SOL`,
          balanceLamports: Math.floor(balance * LAMPORTS_PER_SOL),
        };
      },
    },

    bags_agent_get_token_balance: {
      name: 'bags_agent_get_token_balance',
      description: 'Get token balance for configured wallet',
      inputSchema: z.object({
        tokenMint: z.string().describe('Token mint address'),
      }),
      async execute(params: any) {
        const balance = await service.getTokenBalance(params.tokenMint);
        const wallet = service.walletPublicKey;

        return {
          wallet: wallet?.toBase58() || 'Not configured',
          tokenMint: params.tokenMint,
          balance,
        };
      },
    },
  };
}
