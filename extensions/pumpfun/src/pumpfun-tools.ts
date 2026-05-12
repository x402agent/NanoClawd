import { Type } from "@sinclair/typebox";
import type { ClawdbotPluginApi } from "../../../src/plugins/types.js";
import type { AgentTool } from "../../../src/agents/types.js";
import * as fs from "fs";

// Environment variables for RPC URL
const getRpcUrl = () => process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";

// Default Solana CLI wallet path
const DEFAULT_WALLET_PATH = process.env.HOME + "/.config/solana/id.json";

/**
 * Get keypair from environment or wallet file
 * Priority: SOLANA_PRIVATE_KEY env > SOLANA_WALLET_PATH env > default wallet file
 */
async function getKeypairFromEnv(): Promise<import("@solana/web3.js").Keypair | null> {
  const { Keypair } = await import("@solana/web3.js");

  // Try base58 encoded private key from env
  const privateKey = process.env.SOLANA_PRIVATE_KEY || process.env.MAWD_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
  if (privateKey) {
    try {
      // Dynamic import bs58 to avoid bundling issues
      const bs58 = await import("bs58");
      const secretKey = bs58.default.decode(privateKey);
      return Keypair.fromSecretKey(secretKey);
    } catch (e) {
      console.error("Failed to decode private key from env:", e);
    }
  }

  // Try wallet file path from env or default
  const walletPath = process.env.SOLANA_WALLET_PATH || DEFAULT_WALLET_PATH;
  if (fs.existsSync(walletPath)) {
    try {
      const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
      const secretKey = Uint8Array.from(walletData);
      return Keypair.fromSecretKey(secretKey);
    } catch (e) {
      console.error("Failed to load wallet from file:", walletPath, e);
    }
  }

  return null;
}

/**
 * Tool to launch a new token on Pump.fun
 */
export function createPumpFunLaunchTool(api: ClawdbotPluginApi): AgentTool {
  return {
    name: "pumpfun_launch",
    description: "Launch a new token on Pump.fun bonding curve. Creates a new memecoin with metadata that is instantly tradeable. Automatically uploads image and metadata to IPFS.",
    parameters: Type.Object({
      name: Type.String({ description: "Token name (max 32 characters)" }),
      symbol: Type.String({ description: "Token symbol/ticker (max 10 characters)" }),
      description: Type.String({ description: "Token description" }),
      image_url: Type.Optional(Type.String({ description: "URL to token image (will be uploaded to IPFS)" })),
      twitter: Type.Optional(Type.String({ description: "Twitter URL for the token" })),
      telegram: Type.Optional(Type.String({ description: "Telegram URL for the token" })),
      website: Type.Optional(Type.String({ description: "Website URL for the token" })),
      initial_buy_sol: Type.Optional(Type.Number({ description: "Initial buy amount in SOL (default: 0)" })),
      mayhem_mode: Type.Optional(Type.Boolean({ description: "Use Token2022 with mayhem mode (default: false)" })),
    }),
    async execute(_id, params) {
      try {
        const { PumpFunService } = await import("../../../src/solana/pumpfun-service.js");

        // Get wallet from environment
        const keypair = await getKeypairFromEnv();
        if (!keypair) {
          return {
            content: [{ type: "text", text: "Error: SOLANA_PRIVATE_KEY or MAWD_PRIVATE_KEY environment variable not set or invalid" }],
            isError: true,
          };
        }

        const rpcUrl = getRpcUrl();
        const service = new PumpFunService({ rpcUrl });

        // Launch the token
        const result = await service.launchToken(
          keypair,
          {
            name: params.name,
            symbol: params.symbol,
            description: params.description,
            twitter: params.twitter,
            telegram: params.telegram,
            website: params.website,
          },
          {
            imageUrl: params.image_url,
            initialBuySol: params.initial_buy_sol,
            isMayhemMode: params.mayhem_mode,
          }
        );

        const output = {
          success: true,
          mint: result.mint.toBase58(),
          bonding_curve: result.bondingCurve.toBase58(),
          signature: result.signature,
          metadata_uri: result.metadataUri,
          url: result.tokenUrl,
          solscan: `https://solscan.io/tx/${result.signature}`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error launching token: ${error}` }],
          isError: true,
        };
      }
    },
  };
}

/**
 * Tool to buy tokens from a Pump.fun bonding curve
 */
export function createPumpFunBuyTool(api: ClawdbotPluginApi): AgentTool {
  return {
    name: "pumpfun_buy",
    description: "Buy tokens from a Pump.fun bonding curve using SOL. Executes the trade immediately.",
    parameters: Type.Object({
      mint: Type.String({ description: "Token mint address" }),
      sol_amount: Type.Number({ description: "Amount of SOL to spend" }),
      slippage_bps: Type.Optional(Type.Number({ description: "Slippage tolerance in basis points (default: 500 = 5%)" })),
    }),
    async execute(_id, params) {
      try {
        const { PumpFunService } = await import("../../../src/solana/pumpfun-service.js");
        const { PublicKey } = await import("@solana/web3.js");

        // Get wallet from environment
        const keypair = await getKeypairFromEnv();
        if (!keypair) {
          return {
            content: [{ type: "text", text: "Error: SOLANA_PRIVATE_KEY or MAWD_PRIVATE_KEY environment variable not set or invalid" }],
            isError: true,
          };
        }

        const rpcUrl = getRpcUrl();
        const service = new PumpFunService({ rpcUrl });

        const mint = new PublicKey(params.mint);

        // Get quote first for display
        const quote = await service.getBuyQuote(mint, params.sol_amount);
        if (!quote) {
          return {
            content: [{ type: "text", text: "Error: Could not get buy quote. Token may not exist or bonding curve is complete." }],
            isError: true,
          };
        }

        // Execute the buy
        const signature = await service.executeBuy(
          keypair,
          mint,
          params.sol_amount,
          params.slippage_bps || 500
        );

        const result = {
          success: true,
          action: "buy",
          mint: params.mint,
          sol_spent: params.sol_amount,
          expected_tokens: quote.outputAmount.toString(),
          price_impact_percent: quote.priceImpact.toFixed(2),
          signature,
          solscan: `https://solscan.io/tx/${signature}`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error buying tokens: ${error}` }],
          isError: true,
        };
      }
    },
  };
}

/**
 * Tool to sell tokens to a Pump.fun bonding curve
 */
export function createPumpFunSellTool(api: ClawdbotPluginApi): AgentTool {
  return {
    name: "pumpfun_sell",
    description: "Sell tokens to a Pump.fun bonding curve for SOL. Executes the trade immediately.",
    parameters: Type.Object({
      mint: Type.String({ description: "Token mint address" }),
      token_amount: Type.String({ description: "Amount of tokens to sell (in smallest unit)" }),
      slippage_bps: Type.Optional(Type.Number({ description: "Slippage tolerance in basis points (default: 500 = 5%)" })),
    }),
    async execute(_id, params) {
      try {
        const { PumpFunService } = await import("../../../src/solana/pumpfun-service.js");
        const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
        const BN = (await import("bn.js")).default;

        // Get wallet from environment
        const keypair = await getKeypairFromEnv();
        if (!keypair) {
          return {
            content: [{ type: "text", text: "Error: SOLANA_PRIVATE_KEY or MAWD_PRIVATE_KEY environment variable not set or invalid" }],
            isError: true,
          };
        }

        const rpcUrl = getRpcUrl();
        const service = new PumpFunService({ rpcUrl });

        const mint = new PublicKey(params.mint);
        const tokenAmount = new BN(params.token_amount);

        // Get quote first for display
        const quote = await service.getSellQuote(mint, tokenAmount);
        if (!quote) {
          return {
            content: [{ type: "text", text: "Error: Could not get sell quote. Token may not exist or bonding curve is complete." }],
            isError: true,
          };
        }

        // Execute the sell
        const signature = await service.executeSell(
          keypair,
          mint,
          tokenAmount,
          params.slippage_bps || 500
        );

        const result = {
          success: true,
          action: "sell",
          mint: params.mint,
          tokens_sold: params.token_amount,
          expected_sol: (quote.outputAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(9),
          price_impact_percent: quote.priceImpact.toFixed(2),
          signature,
          solscan: `https://solscan.io/tx/${signature}`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error selling tokens: ${error}` }],
          isError: true,
        };
      }
    },
  };
}

/**
 * Tool to get token price from Pump.fun bonding curve
 */
export function createPumpFunPriceTool(api: ClawdbotPluginApi): AgentTool {
  return {
    name: "pumpfun_price",
    description: "Get current token price from a Pump.fun bonding curve.",
    parameters: Type.Object({
      mint: Type.String({ description: "Token mint address" }),
    }),
    async execute(_id, params) {
      try {
        const { PumpFunService } = await import("../../../src/solana/pumpfun-service.js");
        const { PublicKey } = await import("@solana/web3.js");

        const rpcUrl = getRpcUrl();
        const service = new PumpFunService({ rpcUrl });

        const mint = new PublicKey(params.mint);
        const price = await service.getTokenPrice(mint);
        const progress = await service.getBondingCurveProgress(mint);

        if (price === null) {
          return {
            content: [{ type: "text", text: "Error: Could not get price. Token may not exist." }],
            isError: true,
          };
        }

        const result = {
          mint: params.mint,
          price_sol: price.toFixed(12),
          graduation_progress_percent: progress?.toFixed(2) || "unknown",
          url: `https://pump.fun/${params.mint}`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting price: ${error}` }],
          isError: true,
        };
      }
    },
  };
}

/**
 * Tool to get full bonding curve info
 */
export function createPumpFunInfoTool(api: ClawdbotPluginApi): AgentTool {
  return {
    name: "pumpfun_info",
    description: "Get detailed bonding curve information for a Pump.fun token.",
    parameters: Type.Object({
      mint: Type.String({ description: "Token mint address" }),
    }),
    async execute(_id, params) {
      try {
        const { PumpFunService, calculateMarketCap } = await import("../../../src/solana/pumpfun-service.js");
        const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");

        const rpcUrl = getRpcUrl();
        const service = new PumpFunService({ rpcUrl });

        const mint = new PublicKey(params.mint);
        const curve = await service.getBondingCurve(mint);

        if (!curve) {
          return {
            content: [{ type: "text", text: "Error: Could not get bonding curve. Token may not exist." }],
            isError: true,
          };
        }

        const marketCap = calculateMarketCap(curve);
        const price = curve.virtualSolReserves.toNumber() / curve.virtualTokenReserves.toNumber();
        const progress = await service.getBondingCurveProgress(mint);

        const result = {
          mint: params.mint,
          creator: curve.creator.toBase58(),
          complete: curve.complete,
          mayhem_mode: curve.isMayhemMode,
          virtual_token_reserves: curve.virtualTokenReserves.toString(),
          virtual_sol_reserves: (curve.virtualSolReserves.toNumber() / LAMPORTS_PER_SOL).toFixed(4) + " SOL",
          real_token_reserves: curve.realTokenReserves.toString(),
          real_sol_reserves: (curve.realSolReserves.toNumber() / LAMPORTS_PER_SOL).toFixed(4) + " SOL",
          token_total_supply: curve.tokenTotalSupply.toString(),
          price_sol: price.toFixed(12),
          market_cap_sol: (marketCap.toNumber() / LAMPORTS_PER_SOL).toFixed(4),
          graduation_progress_percent: progress?.toFixed(2) || "unknown",
          url: `https://pump.fun/${params.mint}`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting info: ${error}` }],
          isError: true,
        };
      }
    },
  };
}

/**
 * Tool to get buy/sell quote
 */
export function createPumpFunQuoteTool(api: ClawdbotPluginApi): AgentTool {
  return {
    name: "pumpfun_quote",
    description: "Get a buy or sell quote for a Pump.fun token without executing the trade.",
    parameters: Type.Object({
      mint: Type.String({ description: "Token mint address" }),
      side: Type.Union([Type.Literal("buy"), Type.Literal("sell")], { description: "Trade side: 'buy' or 'sell'" }),
      amount: Type.String({ description: "For buy: SOL amount. For sell: token amount (in smallest unit)" }),
    }),
    async execute(_id, params) {
      try {
        const { PumpFunService } = await import("../../../src/solana/pumpfun-service.js");
        const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
        const BN = (await import("bn.js")).default;

        const rpcUrl = getRpcUrl();
        const service = new PumpFunService({ rpcUrl });

        const mint = new PublicKey(params.mint);

        if (params.side === "buy") {
          const solAmount = parseFloat(params.amount);
          const quote = await service.getBuyQuote(mint, solAmount);

          if (!quote) {
            return {
              content: [{ type: "text", text: "Error: Could not get quote. Token may not exist or bonding curve is complete." }],
              isError: true,
            };
          }

          const result = {
            side: "buy",
            mint: params.mint,
            input_sol: solAmount,
            output_tokens: quote.outputAmount.toString(),
            fee_sol: (quote.fee.toNumber() / LAMPORTS_PER_SOL).toFixed(9),
            price_impact_percent: quote.priceImpact.toFixed(4),
          };

          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } else {
          const tokenAmount = new BN(params.amount);
          const quote = await service.getSellQuote(mint, tokenAmount);

          if (!quote) {
            return {
              content: [{ type: "text", text: "Error: Could not get quote. Token may not exist or bonding curve is complete." }],
              isError: true,
            };
          }

          const result = {
            side: "sell",
            mint: params.mint,
            input_tokens: params.amount,
            output_sol: (quote.outputAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(9),
            fee_sol: (quote.fee.toNumber() / LAMPORTS_PER_SOL).toFixed(9),
            price_impact_percent: quote.priceImpact.toFixed(4),
          };

          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting quote: ${error}` }],
          isError: true,
        };
      }
    },
  };
}
