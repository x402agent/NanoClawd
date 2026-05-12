/**
 * Coinbase CDP Plugin for Clawdbot
 *
 * Provides server wallet management for EVM and Solana chains using
 * Coinbase Developer Platform (CDP) Server Wallet v2.
 *
 * Features:
 * - EVM wallet creation and management (Base, Ethereum, Arbitrum, etc.)
 * - Solana wallet creation and management
 * - Smart Account (ERC-4337) support with gas sponsorship
 * - Testnet faucet support
 * - Transaction signing and sending
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { CdpService } from "./services/cdp-service.js";

// Load .env from extension directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });
import { createEvmTools } from "./tools/evm-tools.js";
import { createSolanaTools } from "./tools/solana-tools.js";
import type { ClawdbotPlugin, PluginContext, Logger, CdpConfig, ClawdbotTool } from "./types/index.js";

let cdpService: CdpService | null = null;
let logger: Logger | null = null;

export const plugin: ClawdbotPlugin = {
  name: "coinbase-cdp",
  version: "1.0.0",
  description: "Coinbase Developer Platform (CDP) Server Wallet integration - EVM and Solana wallet management",

  async activate(context: PluginContext) {
    logger = context.logger;
    logger.info("[coinbase-cdp] Activating Coinbase CDP extension");

    // Get configuration from environment variables
    const config: CdpConfig = {
      apiKeyId: process.env.CDP_API_KEY_ID || "",
      apiKeySecret: process.env.CDP_API_KEY_SECRET || "",
      walletSecret: process.env.CDP_WALLET_SECRET || "",
      paymasterUrl: process.env.CDP_PAYMASTER_URL,
    };

    // Validate configuration - fail gracefully if not configured
    if (!config.apiKeyId || !config.apiKeySecret || !config.walletSecret) {
      logger.warn("[coinbase-cdp] Missing required configuration:");
      if (!config.apiKeyId) logger.warn("  - CDP_API_KEY_ID");
      if (!config.apiKeySecret) logger.warn("  - CDP_API_KEY_SECRET (or CDP_API_SECRET)");
      if (!config.walletSecret) logger.warn("  - CDP_WALLET_SECRET");
      logger.warn("[coinbase-cdp] Plugin disabled - configure env vars to enable");
      logger.warn("[coinbase-cdp] Get credentials at: https://portal.cdp.coinbase.com");
      return;
    }

    // Initialize service
    cdpService = new CdpService(config, logger);

    // Test connectivity - fail gracefully if API unreachable
    const connected = await cdpService.ping();
    if (!connected) {
      logger.warn("[coinbase-cdp] Failed to connect to CDP API - plugin disabled");
      logger.warn("[coinbase-cdp] Check your credentials and network connection");
      cdpService = null;
      return;
    }

    logger.info("[coinbase-cdp] Connected to Coinbase CDP API");

    // Create and register tools
    const evmTools = createEvmTools(cdpService);
    const solanaTools = createSolanaTools(cdpService);

    const allTools = { ...evmTools, ...solanaTools };

    // Add a utility tool to list all wallets
    allTools.cdp_list_all_wallets = {
      name: "cdp_list_all_wallets",
      description: "List all wallets (EVM and Solana) managed by Coinbase CDP for this project.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async () => {
        if (!cdpService) {
          return { success: false, error: "CDP service not initialized" };
        }

        const evmWallets = await cdpService.listEvmAccounts();
        const solanaWallets = await cdpService.listSolanaAccounts();

        return {
          success: true,
          evm: {
            count: evmWallets.length,
            wallets: evmWallets,
          },
          solana: {
            count: solanaWallets.length,
            wallets: solanaWallets,
          },
          total: evmWallets.length + solanaWallets.length,
        };
      },
    };

    // Add a wallet setup helper
    allTools.cdp_setup_trading_wallets = {
      name: "cdp_setup_trading_wallets",
      description: "Set up trading wallets for Mawdbot - creates named EVM and Solana wallets for trading operations.",
      parameters: {
        type: "object",
        properties: {
          evm_name: {
            type: "string",
            description: "Name for the EVM trading wallet (default: mawdbot-evm)",
          },
          solana_name: {
            type: "string",
            description: "Name for the Solana trading wallet (default: mawdbot-solana)",
          },
          request_testnet_funds: {
            type: "boolean",
            description: "Whether to request testnet/devnet funds for the new wallets (default: true)",
          },
        },
        required: [],
      },
      execute: async (params) => {
        if (!cdpService) {
          return { success: false, error: "CDP service not initialized" };
        }

        const evmName = (params.evm_name as string) || "mawdbot-evm";
        const solanaName = (params.solana_name as string) || "mawdbot-solana";
        const requestFunds = params.request_testnet_funds !== false;

        const results: {
          evm?: { address: string; name: string; faucetTx?: string };
          solana?: { address: string; name: string; faucetSig?: string };
          errors: string[];
        } = { errors: [] };

        // Create EVM wallet
        try {
          const evmWallet = await cdpService.getOrCreateEvmAccount(evmName);
          results.evm = { address: evmWallet.address, name: evmName };

          if (requestFunds) {
            try {
              const txHash = await cdpService.requestEvmFaucet(evmWallet.address);
              results.evm.faucetTx = txHash;
            } catch (faucetErr) {
              results.errors.push(`EVM faucet failed: ${faucetErr}`);
            }
          }
        } catch (err) {
          results.errors.push(`EVM wallet creation failed: ${err}`);
        }

        // Create Solana wallet
        try {
          const solanaWallet = await cdpService.getOrCreateSolanaAccount(solanaName);
          results.solana = { address: solanaWallet.address, name: solanaName };

          if (requestFunds) {
            try {
              const sig = await cdpService.requestSolanaFaucet(solanaWallet.address);
              results.solana.faucetSig = sig;
            } catch (faucetErr) {
              results.errors.push(`Solana faucet failed: ${faucetErr}`);
            }
          }
        } catch (err) {
          results.errors.push(`Solana wallet creation failed: ${err}`);
        }

        return {
          success: results.errors.length === 0,
          message: "Trading wallets configured for Mawdbot",
          ...results,
        };
      },
    };

    // Register all tools
    for (const tool of Object.values(allTools)) {
      context.registerTool(tool as ClawdbotTool);
      logger.info(`[coinbase-cdp] Registered tool: ${tool.name}`);
    }

    logger.info(`[coinbase-cdp] Coinbase CDP extension activated with ${Object.keys(allTools).length} tools`);
  },

  async deactivate() {
    logger?.info("[coinbase-cdp] Deactivating Coinbase CDP extension");

    if (cdpService) {
      cdpService.destroy();
      cdpService = null;
    }

    logger = null;
  },

  async getStatus() {
    if (!cdpService || !logger) {
      return {
        enabled: false,
        message: "Coinbase CDP extension not active - check credentials",
      };
    }

    try {
      const connected = await cdpService.ping();
      const wallets = cdpService.getAllWallets();

      return {
        enabled: connected,
        message: connected
          ? `Coinbase CDP connected (${wallets.length} wallets cached)`
          : "Coinbase CDP connection failed",
      };
    } catch {
      return {
        enabled: false,
        message: "Failed to check CDP status",
      };
    }
  },
};

export default plugin;
