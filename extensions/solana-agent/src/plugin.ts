/**
 * Clawdbot Plugin Registration
 *
 * This file provides the Clawdbot plugin interface for the Solana Agent extension.
 * It registers gateway methods, CLI commands, and tools with the Clawdbot system.
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import {
  initialize,
  getAgent,
  getExtensionInfo,
  type SolanaExtensionConfig,
} from "./extension.js";
import {
  solanaGatewayMethods,
  solanaGatewaySchemas,
  type SolanaGatewayContext,
} from "./gateway-methods.js";
import { solanaCommands } from "./cli-commands.js";

/**
 * Plugin configuration from clawdbot.plugin.json
 */
export interface SolanaPluginConfig {
  enabled?: boolean;
  rpcUrl?: string;
  network?: "mainnet-beta" | "devnet" | "testnet";
  enableRemoteSigning?: boolean;
  plugins?: Array<"token" | "defi" | "nft" | "misc" | "blinks">;
}

/**
 * Register the Solana Agent plugin with Clawdbot
 */
export function register(api: ClawdbotPluginApi) {
  const config = api.config as SolanaPluginConfig;

  // Skip if disabled
  if (config.enabled === false) {
    api.log.info("[solana-agent] Plugin disabled via config");
    return;
  }

  // Track initialization state
  let initialized = false;
  let initPromise: Promise<void> | null = null;

  // Lazy initialization helper
  const ensureInitialized = async () => {
    if (initialized) return;
    if (initPromise) {
      await initPromise;
      return;
    }

    initPromise = initialize({
      rpcUrl: config.rpcUrl,
      network: config.network,
      enableRemoteSigning: config.enableRemoteSigning ?? true,
      plugins: config.plugins || ["token", "defi", "nft", "misc"],
    });

    await initPromise;
    initialized = true;
    api.log.info("[solana-agent] Initialized successfully");
  };

  // Register gateway methods
  for (const [methodName, handler] of Object.entries(solanaGatewayMethods)) {
    const schema =
      solanaGatewaySchemas[methodName as keyof typeof solanaGatewaySchemas];

    api.registerGatewayMethod(methodName, async ({ params, respond, error, context }) => {
      try {
        await ensureInitialized();

        const agent = getAgent();
        if (!agent) {
          return error("AGENT_NOT_INITIALIZED", "Solana agent not initialized");
        }

        // Build context with agent
        const solanaCtx: SolanaGatewayContext = {
          connId: context?.connId || "unknown",
          nodeId: context?.nodeId,
          userId: context?.userId,
          agent,
        };

        const result = await handler(params as never, solanaCtx);
        return respond(true, result);
      } catch (err) {
        api.log.error(`[solana-agent] ${methodName} error: ${String(err)}`);
        return error("SOLANA_ERROR", (err as Error).message);
      }
    });

    api.log.debug(`[solana-agent] Registered gateway method: ${methodName}`);
  }

  // Register CLI commands
  api.registerCli(
    (program) => {
      const solana = program.command("solana").description("Solana Agent commands");

      solana
        .command("init")
        .description("Initialize the Solana agent")
        .option("--rpc-url <url>", "RPC endpoint URL")
        .option("--network <network>", "Network (mainnet-beta, devnet, testnet)")
        .action(async (options) => {
          const result = await solanaCommands["solana:init"].handler({
            rpcUrl: options.rpcUrl,
            network: options.network,
          });
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("address")
        .description("Get wallet address")
        .action(async () => {
          await ensureInitialized();
          const result = solanaCommands["solana:address"].handler();
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("balance")
        .description("Get wallet balance")
        .argument("[address]", "Address to check (defaults to agent wallet)")
        .action(async (address?: string) => {
          await ensureInitialized();
          const result = await solanaCommands["solana:balance"].handler(address);
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("actions")
        .description("List available actions")
        .option("--category <category>", "Filter by category")
        .option("--search <query>", "Search by name or description")
        .action(async (options) => {
          await ensureInitialized();
          const result = solanaCommands["solana:actions"].handler({
            category: options.category,
            search: options.search,
          });
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("execute")
        .description("Execute an action")
        .argument("<action>", "Action name")
        .argument("[params]", "JSON params")
        .action(async (action: string, paramsJson?: string) => {
          await ensureInitialized();
          const params = paramsJson ? JSON.parse(paramsJson) : {};
          const result = await solanaCommands["solana:execute"].handler(action, params);
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("price")
        .description("Get token price")
        .argument("<mint>", "Token mint address")
        .option("--source <source>", "Price source (jupiter, pyth, coingecko, dexscreener)")
        .action(async (mint: string, options) => {
          await ensureInitialized();
          const result = await solanaCommands["solana:price"].handler(mint, options.source);
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("swap")
        .description("Execute a swap")
        .requiredOption("--input-mint <mint>", "Input token mint")
        .requiredOption("--output-mint <mint>", "Output token mint")
        .requiredOption("--amount <amount>", "Amount to swap")
        .option("--slippage-bps <bps>", "Slippage tolerance in basis points")
        .action(async (options) => {
          await ensureInitialized();
          const result = await solanaCommands["solana:swap"].handler({
            inputMint: options.inputMint,
            outputMint: options.outputMint,
            amount: parseFloat(options.amount),
            slippageBps: options.slippageBps ? parseInt(options.slippageBps) : undefined,
          });
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("transfer")
        .description("Transfer SOL or tokens")
        .requiredOption("--to <address>", "Recipient address")
        .requiredOption("--amount <amount>", "Amount to transfer")
        .option("--mint <mint>", "Token mint (omit for SOL)")
        .action(async (options) => {
          await ensureInitialized();
          const result = await solanaCommands["solana:transfer"].handler({
            to: options.to,
            amount: parseFloat(options.amount),
            mint: options.mint,
          });
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("launch")
        .description("Launch a token on PumpFun")
        .requiredOption("--name <name>", "Token name")
        .requiredOption("--symbol <symbol>", "Token symbol")
        .option("--description <desc>", "Token description")
        .option("--image-url <url>", "Token image URL")
        .option("--twitter <handle>", "Twitter handle")
        .option("--telegram <handle>", "Telegram handle")
        .option("--website <url>", "Website URL")
        .option("--initial-liquidity-sol <amount>", "Initial liquidity in SOL")
        .action(async (options) => {
          await ensureInitialized();
          const result = await solanaCommands["solana:launch"].handler({
            name: options.name,
            symbol: options.symbol,
            description: options.description,
            imageUrl: options.imageUrl,
            twitter: options.twitter,
            telegram: options.telegram,
            website: options.website,
            initialLiquiditySOL: options.initialLiquiditySol
              ? parseFloat(options.initialLiquiditySol)
              : undefined,
          });
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("security")
        .description("Run security check on a token")
        .argument("<mint>", "Token mint address")
        .action(async (mint: string) => {
          await ensureInitialized();
          const result = await solanaCommands["solana:security"].handler(mint);
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("network")
        .description("Get network status")
        .action(async () => {
          await ensureInitialized();
          const result = await solanaCommands["solana:network"].handler();
          console.log(JSON.stringify(result, null, 2));
        });

      solana
        .command("status")
        .description("Get extension status")
        .action(() => {
          const result = solanaCommands["solana:status"].handler();
          console.log(JSON.stringify(result, null, 2));
        });
    },
    { commands: ["solana"] },
  );

  api.log.info("[solana-agent] Plugin registered with gateway methods and CLI commands");
}

export default { register };
