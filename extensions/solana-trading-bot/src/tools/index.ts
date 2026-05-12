/**
 * Tools Module
 *
 * Re-exports all agent tools
 */

export { createTradingTools } from "./trading-tools.js";
export { createWalletTools } from "./wallet-tools.js";
export { createBotTools } from "./bot-tools.js";

import type { AnyAgentTool } from "clawdbot/plugin-sdk";
import { createTradingTools } from "./trading-tools.js";
import { createWalletTools } from "./wallet-tools.js";
import { createBotTools } from "./bot-tools.js";

/**
 * Create all Solana trading bot tools
 */
export function createAllTools(): AnyAgentTool[] {
  return [
    ...createTradingTools(),
    ...createWalletTools(),
    ...createBotTools(),
  ];
}
