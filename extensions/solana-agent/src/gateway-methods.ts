/**
 * Gateway Methods for Solana Agent
 *
 * Exposes Solana Agent Kit actions through the Clawdbot gateway protocol.
 * Mobile apps and web clients can call these methods via WebSocket RPC.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { ClawdbotSolanaAgent } from "./agent.js";
import type {
  ActionResult,
  WalletBalance,
  SwapQuote,
  SwapResult,
  TokenLaunchResult,
  PriceInfo,
  PoolInfo,
  TokenSecurityCheck,
  SigningRequest,
} from "./types.js";

/**
 * Gateway context for Solana methods
 */
export interface SolanaGatewayContext {
  connId: string;
  nodeId?: string;
  userId?: string;
  agent: ClawdbotSolanaAgent;
  /** Broadcast event to specific connections */
  broadcast?: (connIds: string[], event: string, payload: unknown) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Schema Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export const SolanaExecuteActionSchema = Type.Object({
  action: Type.String({ minLength: 1 }),
  params: Type.Record(Type.String(), Type.Unknown()),
});

export const SolanaListActionsSchema = Type.Object({
  category: Type.Optional(
    Type.Union([
      Type.Literal("token"),
      Type.Literal("defi"),
      Type.Literal("nft"),
      Type.Literal("misc"),
      Type.Literal("blinks"),
    ]),
  ),
  search: Type.Optional(Type.String()),
});

export const SolanaBalanceSchema = Type.Object({
  address: Type.Optional(Type.String()),
});

export const SolanaSwapQuoteSchema = Type.Object({
  inputMint: Type.String(),
  outputMint: Type.String(),
  amount: Type.Number({ minimum: 0 }),
  slippageBps: Type.Optional(Type.Number({ minimum: 0, maximum: 10000 })),
});

export const SolanaSwapSchema = Type.Object({
  inputMint: Type.String(),
  outputMint: Type.String(),
  amount: Type.Number({ minimum: 0 }),
  slippageBps: Type.Optional(Type.Number({ minimum: 0, maximum: 10000 })),
});

export const SolanaTransferSchema = Type.Object({
  to: Type.String(),
  amount: Type.Number({ minimum: 0 }),
  mint: Type.Optional(Type.String()),
});

export const SolanaLaunchTokenSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 32 }),
  symbol: Type.String({ minLength: 1, maxLength: 10 }),
  description: Type.Optional(Type.String({ maxLength: 1000 })),
  imageUrl: Type.Optional(Type.String()),
  twitter: Type.Optional(Type.String()),
  telegram: Type.Optional(Type.String()),
  website: Type.Optional(Type.String()),
  initialLiquiditySOL: Type.Optional(Type.Number({ minimum: 0 })),
});

export const SolanaPriceSchema = Type.Object({
  mint: Type.String(),
  source: Type.Optional(
    Type.Union([
      Type.Literal("jupiter"),
      Type.Literal("pyth"),
      Type.Literal("coingecko"),
      Type.Literal("dexscreener"),
    ]),
  ),
});

export const SolanaPoolsSchema = Type.Object({
  mint: Type.String(),
});

export const SolanaSecurityCheckSchema = Type.Object({
  mint: Type.String(),
});

export const SolanaSignResponseSchema = Type.Object({
  requestId: Type.String(),
  signature: Type.Optional(Type.String()),
  signedTransaction: Type.Optional(Type.String()),
  rejected: Type.Optional(Type.Boolean()),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Method Handlers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute any Solana action by name
 */
export async function handleSolanaExecuteAction(
  params: Static<typeof SolanaExecuteActionSchema>,
  ctx: SolanaGatewayContext,
): Promise<ActionResult> {
  return ctx.agent.executeAction(params.action, params.params);
}

/**
 * List available actions
 */
export function handleSolanaListActions(
  params: Static<typeof SolanaListActionsSchema>,
  ctx: SolanaGatewayContext,
): {
  actions: Array<{
    name: string;
    displayName: string;
    description: string;
    category: string;
  }>;
} {
  let actions = ctx.agent.actions;

  if (params.category) {
    actions = ctx.agent.getActionsByCategory(params.category);
  }

  if (params.search) {
    actions = ctx.agent.searchActions(params.search);
  }

  return {
    actions: actions.map((action) => {
      const meta = ctx.agent.actionMetadata.get(action.name);
      return {
        name: action.name,
        displayName: meta?.displayName || action.name,
        description: action.description.slice(0, 200),
        category: meta?.category || "misc",
      };
    }),
  };
}

/**
 * Get wallet balance
 */
export async function handleSolanaBalance(
  params: Static<typeof SolanaBalanceSchema>,
  ctx: SolanaGatewayContext,
): Promise<WalletBalance> {
  const address = params.address || ctx.agent.wallet.getAddress();

  const result = await ctx.agent.executeAction("BALANCE", { address });

  if (result.status === "error") {
    throw new Error(result.message as string);
  }

  const solBalance = (result.balance as number) || 0;

  // Get token balances
  const tokenResult = await ctx.agent.executeAction("TOKEN_BALANCES", {
    walletAddress: address,
  });

  const tokens = Array.isArray(tokenResult.tokens) ? tokenResult.tokens : [];

  return {
    sol: solBalance,
    lamports: Math.floor(solBalance * 1e9),
    tokens: tokens.map((t: any) => ({
      mint: t.mint || t.address,
      balance: t.balance || t.amount || 0,
      decimals: t.decimals || 9,
      symbol: t.symbol,
      name: t.name,
      logoUri: t.logoUri || t.logo,
      usdValue: t.usdValue,
    })),
  };
}

/**
 * Get swap quote
 */
export async function handleSolanaSwapQuote(
  params: Static<typeof SolanaSwapQuoteSchema>,
  ctx: SolanaGatewayContext,
): Promise<SwapQuote> {
  const result = await ctx.agent.executeAction("FETCH_PRICE", {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: params.slippageBps || 50,
  });

  if (result.status === "error") {
    throw new Error(result.message as string);
  }

  return {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inputAmount: params.amount,
    outputAmount: (result.outputAmount as number) || 0,
    minOutputAmount: (result.minOutputAmount as number) || 0,
    priceImpact: (result.priceImpact as number) || 0,
    fee: (result.fee as number) || 0,
    route: (result.route as string) || "jupiter",
  };
}

/**
 * Execute swap
 */
export async function handleSolanaSwap(
  params: Static<typeof SolanaSwapSchema>,
  ctx: SolanaGatewayContext,
): Promise<SwapResult> {
  const result = await ctx.agent.executeAction("TRADE", {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inputAmount: params.amount,
    slippageBps: params.slippageBps || 50,
  });

  return {
    status: result.status as "success" | "error",
    signature: result.signature as string | undefined,
    inputAmount: params.amount,
    outputAmount: result.outputAmount as number | undefined,
    error: result.message as string | undefined,
  };
}

/**
 * Transfer SOL or tokens
 */
export async function handleSolanaTransfer(
  params: Static<typeof SolanaTransferSchema>,
  ctx: SolanaGatewayContext,
): Promise<ActionResult> {
  if (params.mint) {
    // Token transfer
    return ctx.agent.executeAction("TRANSFER", {
      to: params.to,
      amount: params.amount,
      mint: params.mint,
    });
  } else {
    // SOL transfer
    return ctx.agent.executeAction("TRANSFER", {
      to: params.to,
      amount: params.amount,
    });
  }
}

/**
 * Launch token on PumpFun
 */
export async function handleSolanaLaunchToken(
  params: Static<typeof SolanaLaunchTokenSchema>,
  ctx: SolanaGatewayContext,
): Promise<TokenLaunchResult> {
  const result = await ctx.agent.executeAction("LAUNCH_PUMPFUN_TOKEN", {
    tokenName: params.name,
    tokenTicker: params.symbol,
    description: params.description,
    imageUrl: params.imageUrl,
    twitter: params.twitter,
    telegram: params.telegram,
    website: params.website,
    initialLiquiditySOL: params.initialLiquiditySOL,
  });

  return {
    status: result.status as "success" | "error",
    signature: result.signature as string | undefined,
    mint: result.mint as string | undefined,
    metadataUri: result.metadataUri as string | undefined,
    error: result.message as string | undefined,
  };
}

/**
 * Get token price
 */
export async function handleSolanaPrice(
  params: Static<typeof SolanaPriceSchema>,
  ctx: SolanaGatewayContext,
): Promise<PriceInfo> {
  const source = params.source || "jupiter";
  let actionName = "FETCH_PRICE";

  if (source === "pyth") {
    actionName = "PYTH_FETCH_PRICE";
  }

  const result = await ctx.agent.executeAction(actionName, {
    tokenAddress: params.mint,
    tokenId: params.mint,
  });

  if (result.status === "error") {
    throw new Error(result.message as string);
  }

  return {
    source,
    mint: params.mint,
    priceUsd: (result.price as number) || (result.priceUsd as number) || 0,
    priceChange24h: result.priceChange24h as number | undefined,
    volume24h: result.volume24h as number | undefined,
    marketCap: result.marketCap as number | undefined,
    lastUpdated: Date.now(),
  };
}

/**
 * Search pools for a token
 */
export async function handleSolanaPools(
  params: Static<typeof SolanaPoolsSchema>,
  ctx: SolanaGatewayContext,
): Promise<{ pools: PoolInfo[] }> {
  // Try to get pool info from various DEXs
  const result = await ctx.agent.executeAction("GET_TOKEN_DATA", {
    mintAddress: params.mint,
  });

  const pools: PoolInfo[] = [];

  if (result.pairs && Array.isArray(result.pairs)) {
    for (const pair of result.pairs) {
      pools.push({
        address: pair.pairAddress || pair.address,
        type: (pair.dex || "unknown").toLowerCase() as PoolInfo["type"],
        baseMint: pair.baseToken?.address || params.mint,
        quoteMint: pair.quoteToken?.address || "So11111111111111111111111111111111111111112",
        liquidity: pair.liquidity?.usd || pair.liquidity || 0,
        volume24h: pair.volume?.h24 || pair.volume24h,
      });
    }
  }

  return { pools };
}

/**
 * Security check for a token (Rugcheck)
 */
export async function handleSolanaSecurityCheck(
  params: Static<typeof SolanaSecurityCheckSchema>,
  ctx: SolanaGatewayContext,
): Promise<TokenSecurityCheck> {
  const result = await ctx.agent.executeAction("RUGCHECK", {
    mint: params.mint,
  });

  if (result.status === "error") {
    throw new Error(result.message as string);
  }

  return {
    mint: params.mint,
    score: (result.score as number) || 0,
    risks: ((result.risks as any[]) || []).map((r) => ({
      name: r.name,
      level: r.level || "medium",
      description: r.description,
      score: r.score || 0,
    })),
    tokenProgram: (result.tokenProgram as string) || "unknown",
    tokenType: (result.tokenType as string) || "unknown",
  };
}

/**
 * Handle signed transaction from mobile wallet
 */
export function handleSolanaSignResponse(
  params: Static<typeof SolanaSignResponseSchema>,
  ctx: SolanaGatewayContext,
): { received: boolean } {
  if (params.rejected) {
    ctx.agent.wallet.handleSignedTransaction(params.requestId, {
      id: params.requestId,
      error: "User rejected signing request",
    });
  } else {
    ctx.agent.wallet.handleSignedTransaction(params.requestId, {
      id: params.requestId,
      signature: params.signature,
      signedPayload: params.signedTransaction,
    });
  }

  return { received: true };
}

/**
 * Get wallet address
 */
export function handleSolanaWalletAddress(
  _params: Record<string, never>,
  ctx: SolanaGatewayContext,
): { address: string } {
  return { address: ctx.agent.wallet.getAddress() };
}

/**
 * Get network status
 */
export async function handleSolanaNetworkStatus(
  _params: Record<string, never>,
  ctx: SolanaGatewayContext,
): Promise<{
  slot: number;
  blockHeight: number;
  epoch: number;
  healthy: boolean;
}> {
  const [slot, blockHeight, epochInfo] = await Promise.all([
    ctx.agent.connection.getSlot(),
    ctx.agent.connection.getBlockHeight(),
    ctx.agent.connection.getEpochInfo(),
  ]);

  return {
    slot,
    blockHeight,
    epoch: epochInfo.epoch,
    healthy: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Method Registration
// ═══════════════════════════════════════════════════════════════════════════════

export const solanaGatewayMethods = {
  "solana.execute": handleSolanaExecuteAction,
  "solana.actions": handleSolanaListActions,
  "solana.balance": handleSolanaBalance,
  "solana.quote": handleSolanaSwapQuote,
  "solana.swap": handleSolanaSwap,
  "solana.transfer": handleSolanaTransfer,
  "solana.launch": handleSolanaLaunchToken,
  "solana.price": handleSolanaPrice,
  "solana.pools": handleSolanaPools,
  "solana.security": handleSolanaSecurityCheck,
  "solana.signResponse": handleSolanaSignResponse,
  "solana.address": handleSolanaWalletAddress,
  "solana.network": handleSolanaNetworkStatus,
};

export const solanaGatewaySchemas = {
  "solana.execute": SolanaExecuteActionSchema,
  "solana.actions": SolanaListActionsSchema,
  "solana.balance": SolanaBalanceSchema,
  "solana.quote": SolanaSwapQuoteSchema,
  "solana.swap": SolanaSwapSchema,
  "solana.transfer": SolanaTransferSchema,
  "solana.launch": SolanaLaunchTokenSchema,
  "solana.price": SolanaPriceSchema,
  "solana.pools": SolanaPoolsSchema,
  "solana.security": SolanaSecurityCheckSchema,
  "solana.signResponse": SolanaSignResponseSchema,
};
