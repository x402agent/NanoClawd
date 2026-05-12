import type { SolanaTradingConfig } from '../config.js';
import type { Database } from '../db/index.js';
import type { Logger } from '../types.js';
import { createBirdeyeAlertTools } from './birdeye-alert-tools.js';
import { createBirdeyeTools } from './birdeye-tools.js';
import { createBirdeyeWalletTools } from './birdeye-wallet-tools.js';
import { createCoinGeckoTools } from './coingecko-tools.js';
import { createCopyTradingTools } from './copy-tools.js';
import { createJupiterTools } from './jupiter-tools.js';
import { createLaunchTools } from './launch-tools.js';
import { createPumpFunTools } from './pumpfun-tools.js';
import { createSniperTools } from './sniper-tools.js';
import { createTrackingTools } from './tracking-tools.js';
import { createVolumeBotTools } from './volume-tools.js';

export interface ToolDependencies {
  ensureDb: () => Promise<Database>;
  config: SolanaTradingConfig;
  rpcUrl: string;
  logger: Logger;
}

export function createTradingTools(deps: ToolDependencies): any[] {
  const tools: any[] = [];

  // Sniper bot tools
  if (deps.config.sniper?.enabled !== false) {
    tools.push(...createSniperTools(deps));
  }

  // Wallet tracking tools (always enabled by default)
  if (deps.config.walletTracking?.enabled !== false) {
    tools.push(...createTrackingTools(deps));
  }

  // Copy trading tools
  if (deps.config.copyTrading?.enabled !== false) {
    tools.push(...createCopyTradingTools(deps));
  }

  // Volume bot tools
  if (deps.config.volumeBot?.enabled !== false) {
    tools.push(...createVolumeBotTools(deps));
  }

  // Token launch tools (Bags.fm)
  if (deps.config.bags?.apiKey) {
    tools.push(...createLaunchTools(deps));
  }

  // Pump.fun tools (always enabled when RPC is configured)
  if (deps.config.rpcUrl || deps.rpcUrl) {
    tools.push(...createPumpFunTools(deps));
  }

  // Birdeye tools (token analysis, charts, alerts) - always enabled when API key is set
  if (process.env.BIRDEYE_API_KEY) {
    tools.push(...createBirdeyeTools(deps));
    tools.push(...createBirdeyeWalletTools(deps));
    tools.push(...createBirdeyeAlertTools(deps));
  }

  // Jupiter Exchange tools (swaps, limit orders, price fetching) - always enabled
  tools.push(...createJupiterTools(deps));

  // CoinGecko tools (token prices, charts, trending) - enabled when API key is set
  if (process.env.COINGECKO_API_KEY) {
    tools.push(...createCoinGeckoTools(deps));
  }

  return tools;
}
