/**
 * Clawdbot Solana Agent Factory
 *
 * Creates a fully-configured SolanaAgentKit instance with all plugins.
 * Provides 137+ actions across token, DeFi, NFT, and utility operations.
 */

import { Connection } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";
import type { Config, Action, Plugin } from "solana-agent-kit";
import { ClawdbotWallet, type ClawdbotWalletConfig } from "./wallet.js";
import type { SolanaAgentConfig, ActionMetadata, SolanaActionCategory } from "./types.js";

// Plugin imports - lazy loaded to reduce initial bundle
let TokenPlugin: Plugin | null = null;
let DefiPlugin: Plugin | null = null;
let NFTPlugin: Plugin | null = null;
let MiscPlugin: Plugin | null = null;

async function loadPlugins(): Promise<{
  token: Plugin;
  defi: Plugin;
  nft: Plugin;
  misc: Plugin;
}> {
  if (!TokenPlugin) {
    const mod = await import("@solana-agent-kit/plugin-token");
    TokenPlugin = mod.default;
  }
  if (!DefiPlugin) {
    const mod = await import("@solana-agent-kit/plugin-defi");
    DefiPlugin = mod.default;
  }
  if (!NFTPlugin) {
    const mod = await import("@solana-agent-kit/plugin-nft");
    NFTPlugin = mod.default;
  }
  if (!MiscPlugin) {
    const mod = await import("@solana-agent-kit/plugin-misc");
    MiscPlugin = mod.default;
  }

  return {
    token: TokenPlugin,
    defi: DefiPlugin,
    nft: NFTPlugin,
    misc: MiscPlugin,
  };
}

/**
 * Extended SolanaAgentKit with Clawdbot-specific features
 */
export interface ClawdbotSolanaAgent {
  /** The underlying SolanaAgentKit instance */
  agent: SolanaAgentKit;
  /** Clawdbot wallet adapter */
  wallet: ClawdbotWallet;
  /** Solana connection */
  connection: Connection;
  /** All available actions */
  actions: Action[];
  /** Action metadata for UI */
  actionMetadata: Map<string, ActionMetadata>;
  /** Execute an action by name */
  executeAction: (name: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Get actions by category */
  getActionsByCategory: (category: SolanaActionCategory) => Action[];
  /** Search actions by query */
  searchActions: (query: string) => Action[];
  /** Cleanup resources */
  destroy: () => void;
}

/**
 * Map config to Solana Agent Kit Config format
 */
function mapConfig(config: SolanaAgentConfig): Config {
  return {
    signOnly: config.signOnly,
    HELIUS_API_KEY: config.heliusApiKey,
    JUPITER_REFERRAL_ACCOUNT: config.jupiterReferralAccount,
    JUPITER_FEE_BPS: config.jupiterFeeBps,
    COINGECKO_PRO_API_KEY: config.coingeckoProApiKey,
    PINATA_JWT: config.pinataJwt,
    PINATA_GATEWAY: config.pinataGateway,
    PUMP_FUN_REFERRAL_WALLET: config.pumpFunReferralWallet,
    MAGIC_EDEN_API_KEY: config.magicEdenApiKey,
    OPENAI_API_KEY: config.openaiApiKey,
    ALLORA_API_KEY: config.alloraApiKey,
    ELFA_AI_API_KEY: config.elfaAiApiKey,
    MESSARI_API_KEY: config.messariApiKey,
    OKX_API_KEY: config.okxApiKey,
    OKX_SECRET_KEY: config.okxSecretKey,
    OKX_API_PASSPHRASE: config.okxPassphrase,
    OKX_PROJECT_ID: config.okxProjectId,
    PRIORITY_LEVEL: config.priorityLevel,
  };
}

/**
 * Categorize actions based on their source plugin
 */
function categorizeAction(actionName: string): SolanaActionCategory {
  // Token actions
  const tokenActions = [
    "GET_TOKEN_DATA", "FETCH_PRICE", "TRADE", "TRANSFER", "BALANCE",
    "LAUNCH_PUMPFUN_TOKEN", "COMPRESSED_AIRDROP", "STAKE_WITH_JUP",
    "CREATE_LIMIT_ORDER", "CANCEL_LIMIT_ORDERS", "TOKEN_BALANCES",
    "RUGCHECK", "MAYAN_SWAP", "PYTH_FETCH_PRICE", "WALLET_ADDRESS",
    "REQUEST_FUNDS", "GET_TPS", "CLOSE_EMPTY_TOKEN_ACCOUNTS",
  ];

  // DeFi actions
  const defiActions = [
    "DRIFT", "RAYDIUM", "ORCA", "METEORA", "MANIFEST", "OPENBOOK",
    "FLASH", "LULO", "VOLTR", "SOLAYER", "SANCTUM", "PUMP_SWAP",
    "ADRENA", "FLUXBEAM", "DEBRIDGE", "OKX",
  ];

  // NFT actions
  const nftActions = [
    "METAPLEX", "TENSOR", "MAGIC_EDEN", "3LAND", "DEPLOY_COLLECTION",
    "MINT_NFT", "LIST_NFT", "CANCEL_LISTING", "NFT_SEARCH",
  ];

  const upperName = actionName.toUpperCase();

  if (tokenActions.some((t) => upperName.includes(t))) return "token";
  if (defiActions.some((d) => upperName.includes(d))) return "defi";
  if (nftActions.some((n) => upperName.includes(n))) return "nft";
  if (upperName.includes("BLINK") || upperName.includes("ARCADE")) return "blinks";

  return "misc";
}

/**
 * Create action metadata from Action definition
 */
function createActionMetadata(action: Action): ActionMetadata {
  const category = categorizeAction(action.name);

  // Generate display name from action name
  const displayName = action.name
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name: action.name,
    displayName,
    description: action.description,
    category,
    similes: action.similes,
    requiresWallet: true, // Most Solana actions require a wallet
    requiresSignature: !action.name.includes("GET") && !action.name.includes("FETCH"),
  };
}

/**
 * Create a fully-configured Clawdbot Solana Agent
 */
export async function createClawdbotSolanaAgent(
  config: SolanaAgentConfig,
  walletConfig?: Partial<ClawdbotWalletConfig>,
): Promise<ClawdbotSolanaAgent> {
  // Create connection
  const connection = new Connection(config.rpcUrl, "confirmed");

  // Create wallet
  const wallet = new ClawdbotWallet({
    privateKey: config.privateKey,
    connection,
    signOnly: config.signOnly,
    ...walletConfig,
  });

  // Map config
  const agentConfig = mapConfig(config);

  // Create base agent
  const baseAgent = new SolanaAgentKit(wallet, config.rpcUrl, agentConfig);

  // Load and apply plugins
  const plugins = await loadPlugins();

  const agent = baseAgent
    .use(plugins.token)
    .use(plugins.defi)
    .use(plugins.nft)
    .use(plugins.misc);

  // Build action metadata map
  const actionMetadata = new Map<string, ActionMetadata>();
  for (const action of agent.actions) {
    actionMetadata.set(action.name, createActionMetadata(action));
  }

  // Action executor
  const executeAction = async (
    name: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const action = agent.actions.find((a) => a.name === name);
    if (!action) {
      return {
        status: "error",
        message: `Action '${name}' not found`,
        code: "ACTION_NOT_FOUND",
      };
    }

    try {
      // Validate params with Zod schema
      const validatedParams = action.schema.parse(params);

      // Execute action
      const result = await action.handler(agent, validatedParams);

      return {
        status: "success",
        ...result,
      };
    } catch (error: unknown) {
      const err = error as Error & { errors?: unknown[]; code?: string };

      // Handle Zod validation errors
      if (err.errors) {
        return {
          status: "error",
          message: "Validation error",
          details: err.errors,
          code: "VALIDATION_ERROR",
        };
      }

      return {
        status: "error",
        message: err.message || "Unknown error",
        code: err.code || "EXECUTION_ERROR",
      };
    }
  };

  // Get actions by category
  const getActionsByCategory = (category: SolanaActionCategory): Action[] => {
    return agent.actions.filter((action) => {
      const meta = actionMetadata.get(action.name);
      return meta?.category === category;
    });
  };

  // Search actions
  const searchActions = (query: string): Action[] => {
    const lowerQuery = query.toLowerCase();
    return agent.actions.filter((action) => {
      const meta = actionMetadata.get(action.name);
      return (
        action.name.toLowerCase().includes(lowerQuery) ||
        action.description.toLowerCase().includes(lowerQuery) ||
        action.similes.some((s) => s.toLowerCase().includes(lowerQuery)) ||
        meta?.displayName.toLowerCase().includes(lowerQuery)
      );
    });
  };

  // Cleanup
  const destroy = (): void => {
    wallet.removeAllListeners();
  };

  console.log(
    `[SolanaAgent] Initialized with ${agent.actions.length} actions across ${actionMetadata.size} categories`,
  );

  return {
    agent,
    wallet,
    connection,
    actions: agent.actions,
    actionMetadata,
    executeAction,
    getActionsByCategory,
    searchActions,
    destroy,
  };
}

/**
 * Get a list of all available action names
 */
export async function listAvailableActions(): Promise<string[]> {
  const plugins = await loadPlugins();

  return [
    ...plugins.token.actions.map((a) => a.name),
    ...plugins.defi.actions.map((a) => a.name),
    ...plugins.nft.actions.map((a) => a.name),
    ...plugins.misc.actions.map((a) => a.name),
  ];
}

/**
 * Get action count by category
 */
export async function getActionCounts(): Promise<Record<SolanaActionCategory, number>> {
  const plugins = await loadPlugins();

  const counts: Record<SolanaActionCategory, number> = {
    token: plugins.token.actions.length,
    defi: plugins.defi.actions.length,
    nft: plugins.nft.actions.length,
    misc: plugins.misc.actions.length,
    blinks: 0, // Blinks plugin not included by default
  };

  return counts;
}
