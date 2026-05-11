import fs from "fs";
import os from "os";
import path from "path";
import { getSettingsManager } from "../utils/settings-manager.js";

export interface RuntimeEnvDiscovery {
  env: Record<string, { present: boolean; value?: string }>;
  configPaths: Array<{ path: string; exists: boolean }>;
  recommendedModels: string[];
}

function mask(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function discoverRuntimeEnv(): RuntimeEnvDiscovery {
  const manager = getSettingsManager();
  const user = manager.loadUserSettings();

  const envKeys = [
    "HELIUS_API_KEY",
    "HELIUS_RPC_URL",
    "XAI_API_KEY",
    "GROK_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "SOLANA_PRIVATE_KEY",
    "PRIVY_APP_ID",
  ] as const;

  const env: RuntimeEnvDiscovery["env"] = {};
  for (const key of envKeys) {
    const raw = process.env[key];
    env[key] = { present: Boolean(raw), value: mask(raw) };
  }

  const configPaths = [
    path.join(os.homedir(), ".clawd", "user-settings.json"),
    path.join(os.homedir(), ".clawd", "CLAWD.md"),
    path.join(os.homedir(), ".nemoclaw", "config.json"),
    path.join(process.cwd(), ".clawd", "settings.json"),
    path.join(process.cwd(), ".clawd", "runtime-shell.json"),
  ].map((p) => ({ path: p, exists: fs.existsSync(p) }));

  return {
    env,
    configPaths,
    recommendedModels: user.models?.slice(0, 8) || [],
  };
}
