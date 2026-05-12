/**
 * CLI Commands for Solana Agent
 *
 * Provides command-line interface for Solana operations.
 */

import { getAgent, getExtensionInfo, initialize } from "./extension.js";
import type { ActionCategory } from "./types.js";

/**
 * Command result type
 */
interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Initialize the Solana agent from CLI
 */
export async function cmdInit(options: {
  rpcUrl?: string;
  network?: "mainnet-beta" | "devnet" | "testnet";
  privateKey?: string;
}): Promise<CommandResult> {
  try {
    await initialize({
      rpcUrl: options.rpcUrl,
      network: options.network,
      privateKey: options.privateKey,
    });

    const info = getExtensionInfo();
    return {
      success: true,
      message: `Solana agent initialized with ${info.actionCount} actions`,
      data: info,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to initialize: ${(error as Error).message}`,
    };
  }
}

/**
 * Get wallet address
 */
export function cmdAddress(): CommandResult {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  return {
    success: true,
    data: { address: agent.wallet.getAddress() },
  };
}

/**
 * Get wallet balance
 */
export async function cmdBalance(address?: string): Promise<CommandResult> {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  try {
    const result = await agent.executeAction("BALANCE", {
      address: address || agent.wallet.getAddress(),
    });

    return {
      success: result.status === "success",
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * List available actions
 */
export function cmdListActions(options?: {
  category?: ActionCategory;
  search?: string;
}): CommandResult {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  let actions = agent.actions;

  if (options?.category) {
    actions = agent.getActionsByCategory(options.category);
  }

  if (options?.search) {
    actions = agent.searchActions(options.search);
  }

  const actionList = actions.map((action) => {
    const meta = agent.actionMetadata.get(action.name);
    return {
      name: action.name,
      displayName: meta?.displayName || action.name,
      description: action.description.slice(0, 100),
      category: meta?.category || "misc",
    };
  });

  return {
    success: true,
    data: {
      count: actionList.length,
      actions: actionList,
    },
  };
}

/**
 * Execute an action by name
 */
export async function cmdExecute(
  actionName: string,
  params: Record<string, unknown>,
): Promise<CommandResult> {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  try {
    const result = await agent.executeAction(actionName, params);
    return {
      success: result.status === "success",
      data: result,
      message: result.status === "error" ? (result.message as string) : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Get token price
 */
export async function cmdPrice(
  mint: string,
  source?: "jupiter" | "pyth" | "coingecko" | "dexscreener",
): Promise<CommandResult> {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  try {
    const actionName = source === "pyth" ? "PYTH_FETCH_PRICE" : "FETCH_PRICE";
    const result = await agent.executeAction(actionName, {
      tokenAddress: mint,
      tokenId: mint,
    });

    return {
      success: result.status === "success",
      data: {
        mint,
        source: source || "jupiter",
        price: result.price || result.priceUsd,
        ...result,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Execute a swap
 */
export async function cmdSwap(options: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
}): Promise<CommandResult> {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  try {
    const result = await agent.executeAction("TRADE", {
      inputMint: options.inputMint,
      outputMint: options.outputMint,
      inputAmount: options.amount,
      slippageBps: options.slippageBps || 50,
    });

    return {
      success: result.status === "success",
      data: result,
      message:
        result.status === "error" ? (result.message as string) : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Transfer SOL or tokens
 */
export async function cmdTransfer(options: {
  to: string;
  amount: number;
  mint?: string;
}): Promise<CommandResult> {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  try {
    const result = await agent.executeAction("TRANSFER", {
      to: options.to,
      amount: options.amount,
      mint: options.mint,
    });

    return {
      success: result.status === "success",
      data: result,
      message:
        result.status === "error" ? (result.message as string) : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Launch a token on PumpFun
 */
export async function cmdLaunchToken(options: {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  initialLiquiditySOL?: number;
}): Promise<CommandResult> {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  try {
    const result = await agent.executeAction("LAUNCH_PUMPFUN_TOKEN", {
      tokenName: options.name,
      tokenTicker: options.symbol,
      description: options.description,
      imageUrl: options.imageUrl,
      twitter: options.twitter,
      telegram: options.telegram,
      website: options.website,
      initialLiquiditySOL: options.initialLiquiditySOL,
    });

    return {
      success: result.status === "success",
      data: result,
      message:
        result.status === "error" ? (result.message as string) : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Run a security check on a token
 */
export async function cmdSecurityCheck(mint: string): Promise<CommandResult> {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  try {
    const result = await agent.executeAction("RUGCHECK", { mint });

    return {
      success: result.status === "success",
      data: {
        mint,
        score: result.score,
        risks: result.risks,
        tokenProgram: result.tokenProgram,
        tokenType: result.tokenType,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Get network status
 */
export async function cmdNetworkStatus(): Promise<CommandResult> {
  const agent = getAgent();
  if (!agent) {
    return { success: false, message: "Agent not initialized" };
  }

  try {
    const [slot, blockHeight, epochInfo] = await Promise.all([
      agent.connection.getSlot(),
      agent.connection.getBlockHeight(),
      agent.connection.getEpochInfo(),
    ]);

    return {
      success: true,
      data: {
        slot,
        blockHeight,
        epoch: epochInfo.epoch,
        slotIndex: epochInfo.slotIndex,
        slotsInEpoch: epochInfo.slotsInEpoch,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Get extension status
 */
export function cmdStatus(): CommandResult {
  const info = getExtensionInfo();

  return {
    success: true,
    data: info,
  };
}

/**
 * Command definitions for CLI registration
 */
export const solanaCommands = {
  "solana:init": {
    description: "Initialize the Solana agent",
    options: [
      { name: "--rpc-url", description: "RPC endpoint URL" },
      {
        name: "--network",
        description: "Network (mainnet-beta, devnet, testnet)",
      },
      { name: "--private-key", description: "Private key (base58)" },
    ],
    handler: cmdInit,
  },
  "solana:address": {
    description: "Get wallet address",
    handler: cmdAddress,
  },
  "solana:balance": {
    description: "Get wallet balance",
    args: [{ name: "address", optional: true }],
    handler: cmdBalance,
  },
  "solana:actions": {
    description: "List available actions",
    options: [
      { name: "--category", description: "Filter by category" },
      { name: "--search", description: "Search by name or description" },
    ],
    handler: cmdListActions,
  },
  "solana:execute": {
    description: "Execute an action",
    args: [
      { name: "action", required: true },
      { name: "params", description: "JSON params" },
    ],
    handler: cmdExecute,
  },
  "solana:price": {
    description: "Get token price",
    args: [{ name: "mint", required: true }],
    options: [
      {
        name: "--source",
        description: "Price source (jupiter, pyth, coingecko, dexscreener)",
      },
    ],
    handler: cmdPrice,
  },
  "solana:swap": {
    description: "Execute a swap",
    options: [
      { name: "--input-mint", required: true },
      { name: "--output-mint", required: true },
      { name: "--amount", required: true },
      { name: "--slippage-bps" },
    ],
    handler: cmdSwap,
  },
  "solana:transfer": {
    description: "Transfer SOL or tokens",
    options: [
      { name: "--to", required: true },
      { name: "--amount", required: true },
      { name: "--mint", description: "Token mint (omit for SOL)" },
    ],
    handler: cmdTransfer,
  },
  "solana:launch": {
    description: "Launch a token on PumpFun",
    options: [
      { name: "--name", required: true },
      { name: "--symbol", required: true },
      { name: "--description" },
      { name: "--image-url" },
      { name: "--twitter" },
      { name: "--telegram" },
      { name: "--website" },
      { name: "--initial-liquidity-sol" },
    ],
    handler: cmdLaunchToken,
  },
  "solana:security": {
    description: "Run security check on a token",
    args: [{ name: "mint", required: true }],
    handler: cmdSecurityCheck,
  },
  "solana:network": {
    description: "Get network status",
    handler: cmdNetworkStatus,
  },
  "solana:status": {
    description: "Get extension status",
    handler: cmdStatus,
  },
};

export default solanaCommands;
