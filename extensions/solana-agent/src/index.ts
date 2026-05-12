/**
 * @clawdbot/solana-agent
 *
 * Solana Agent Kit integration for Clawdbot
 *
 * Provides 137+ actions across 5 plugins:
 * - Token: swaps, transfers, launches, airdrops
 * - DeFi: Drift, Raydium, Orca, Meteora, PumpFun, staking
 * - NFT: Metaplex, Tensor, Magic Eden, 3Land
 * - Misc: domains, webhooks, multisig, price feeds
 * - Blinks: on-chain actions
 */

// Main extension
export {
  SolanaAgentExtension,
  initialize,
  shutdown,
  getAgent,
  getConnection,
  getExtensionInfo,
  registerGatewayMethods,
  createGatewayContext,
  removeGatewayContext,
  type SolanaExtensionConfig,
  EXTENSION_NAME,
  EXTENSION_VERSION,
} from "./extension.js";

// Wallet adapter
export { ClawdbotWallet, type ClawdbotWalletConfig } from "./wallet.js";

// Agent factory
export {
  createClawdbotSolanaAgent,
  type ClawdbotSolanaAgent,
  type SolanaAgentConfig,
} from "./agent.js";

// Gateway methods for mobile/web access
export {
  solanaGatewayMethods,
  solanaGatewaySchemas,
  type SolanaGatewayContext,
} from "./gateway-methods.js";

// CLI commands
export {
  solanaCommands,
  cmdInit,
  cmdAddress,
  cmdBalance,
  cmdListActions,
  cmdExecute,
  cmdPrice,
  cmdSwap,
  cmdTransfer,
  cmdLaunchToken,
  cmdSecurityCheck,
  cmdNetworkStatus,
  cmdStatus,
} from "./cli-commands.js";

// Types
export * from "./types.js";

// Plugin registration
export { register, type SolanaPluginConfig } from "./plugin.js";

// Default export
export { SolanaAgentExtension as default } from "./extension.js";
