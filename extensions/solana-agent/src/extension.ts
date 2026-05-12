/**
 * Clawdbot Solana Agent Extension
 *
 * Integrates the Solana Agent Kit with Clawdbot's extension system,
 * providing gateway methods and CLI commands for Solana operations.
 */

import type { Connection } from "@solana/web3.js";
import {
  createClawdbotSolanaAgent,
  type ClawdbotSolanaAgent,
  type SolanaAgentConfig,
} from "./agent.js";
import {
  solanaGatewayMethods,
  solanaGatewaySchemas,
  type SolanaGatewayContext,
} from "./gateway-methods.js";
import type { ClawdbotWalletConfig } from "./wallet.js";

// Extension metadata
export const EXTENSION_NAME = "solana-agent";
export const EXTENSION_VERSION = "1.0.0";

/**
 * Extension configuration
 */
export interface SolanaExtensionConfig {
  /** RPC endpoint URL */
  rpcUrl?: string;
  /** Network (mainnet-beta, devnet, testnet) */
  network?: "mainnet-beta" | "devnet" | "testnet";
  /** Private key (base58 or byte array) - optional for remote signing */
  privateKey?: string | Uint8Array;
  /** OpenAI API key for AI features */
  openAiApiKey?: string;
  /** Enable remote wallet signing via mobile */
  enableRemoteSigning?: boolean;
  /** Plugins to load (defaults to all) */
  plugins?: Array<"token" | "defi" | "nft" | "misc" | "blinks">;
}

/**
 * Extension state
 */
interface ExtensionState {
  agent: ClawdbotSolanaAgent | null;
  config: SolanaExtensionConfig;
  connections: Map<string, SolanaGatewayContext>;
}

const state: ExtensionState = {
  agent: null,
  config: {},
  connections: new Map(),
};

/**
 * Initialize the Solana extension
 */
export async function initialize(
  config: SolanaExtensionConfig = {},
): Promise<void> {
  state.config = config;

  // Build agent config
  const agentConfig: SolanaAgentConfig = {
    rpcUrl:
      config.rpcUrl ||
      (config.network === "devnet"
        ? "https://api.devnet.solana.com"
        : "https://api.mainnet-beta.solana.com"),
    openAiApiKey: config.openAiApiKey,
    plugins: config.plugins || ["token", "defi", "nft", "misc"],
  };

  // Build wallet config
  const walletConfig: Partial<ClawdbotWalletConfig> = {
    enableRemoteSigning: config.enableRemoteSigning ?? true,
  };

  if (config.privateKey) {
    walletConfig.privateKey = config.privateKey;
  }

  // Create the agent
  state.agent = await createClawdbotSolanaAgent(agentConfig, walletConfig);

  console.log(
    `[solana-agent] Initialized with ${state.agent.actions.length} actions`,
  );
}

/**
 * Get the current agent instance
 */
export function getAgent(): ClawdbotSolanaAgent | null {
  return state.agent;
}

/**
 * Get the Solana connection
 */
export function getConnection(): Connection | null {
  return state.agent?.connection ?? null;
}

/**
 * Register gateway methods with the Clawdbot gateway
 */
export function registerGatewayMethods(gateway: {
  registerMethod: (
    name: string,
    handler: (params: unknown, ctx: unknown) => unknown,
    schema?: unknown,
  ) => void;
}): void {
  if (!state.agent) {
    throw new Error("Solana extension not initialized");
  }

  // Register each method
  for (const [methodName, handler] of Object.entries(solanaGatewayMethods)) {
    const schema =
      solanaGatewaySchemas[methodName as keyof typeof solanaGatewaySchemas];

    gateway.registerMethod(
      methodName,
      async (params: unknown, ctx: unknown) => {
        // Build context with agent
        const solanaCtx: SolanaGatewayContext = {
          ...(ctx as Record<string, unknown>),
          connId: (ctx as { connId?: string }).connId || "unknown",
          agent: state.agent!,
        };

        return handler(params as never, solanaCtx);
      },
      schema,
    );
  }

  console.log(
    `[solana-agent] Registered ${Object.keys(solanaGatewayMethods).length} gateway methods`,
  );
}

/**
 * Create a gateway context for a connection
 */
export function createGatewayContext(
  connId: string,
  options?: {
    nodeId?: string;
    userId?: string;
    broadcast?: (connIds: string[], event: string, payload: unknown) => void;
  },
): SolanaGatewayContext {
  if (!state.agent) {
    throw new Error("Solana extension not initialized");
  }

  const ctx: SolanaGatewayContext = {
    connId,
    nodeId: options?.nodeId,
    userId: options?.userId,
    agent: state.agent,
    broadcast: options?.broadcast,
  };

  state.connections.set(connId, ctx);
  return ctx;
}

/**
 * Remove a gateway context
 */
export function removeGatewayContext(connId: string): void {
  state.connections.delete(connId);
}

/**
 * Get extension info
 */
export function getExtensionInfo(): {
  name: string;
  version: string;
  initialized: boolean;
  walletAddress: string | null;
  actionCount: number;
  network: string;
} {
  return {
    name: EXTENSION_NAME,
    version: EXTENSION_VERSION,
    initialized: state.agent !== null,
    walletAddress: state.agent?.wallet.getAddress() ?? null,
    actionCount: state.agent?.actions.length ?? 0,
    network: state.config.network ?? "mainnet-beta",
  };
}

/**
 * Shutdown the extension
 */
export function shutdown(): void {
  state.agent = null;
  state.connections.clear();
  console.log("[solana-agent] Shutdown complete");
}

/**
 * Clawdbot Extension Definition
 *
 * This object conforms to Clawdbot's extension interface
 */
export const SolanaAgentExtension = {
  name: EXTENSION_NAME,
  version: EXTENSION_VERSION,

  // Lifecycle hooks
  async onLoad(config: SolanaExtensionConfig): Promise<void> {
    await initialize(config);
  },

  onUnload(): void {
    shutdown();
  },

  // Gateway integration
  getGatewayMethods(): typeof solanaGatewayMethods {
    return solanaGatewayMethods;
  },

  getGatewaySchemas(): typeof solanaGatewaySchemas {
    return solanaGatewaySchemas;
  },

  registerWithGateway(gateway: {
    registerMethod: (
      name: string,
      handler: (params: unknown, ctx: unknown) => unknown,
      schema?: unknown,
    ) => void;
  }): void {
    registerGatewayMethods(gateway);
  },

  // Context management
  createContext: createGatewayContext,
  removeContext: removeGatewayContext,

  // Info
  getInfo: getExtensionInfo,
  getAgent,
  getConnection,
};

export default SolanaAgentExtension;
