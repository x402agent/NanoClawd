import fs from "fs";
import path from "path";
import { addMCPServer } from "../mcp/config.js";
import {
  projectFilesystemPolicyPath,
  projectNetworkPolicyPath,
  projectOpenShellDir,
  projectProviderPath,
  projectRuntimeManifestPath,
} from "./paths.js";
import { discoverRuntimeEnv } from "./discovery.js";

export interface RuntimeManifest {
  name: string;
  repository: string;
  cliPackage: string;
  frameworkPackage: string;
  mcpServer: {
    name: string;
    command: string;
    args: string[];
  };
  providers: string[];
  env: string[];
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function buildRuntimeManifest(): RuntimeManifest {
  return {
    name: "solana-clawd-runtime-shell",
    repository: "https://github.com/x402agent/nanoclawd",
    cliPackage: "x402agent-nanoclawd-cli",
    frameworkPackage: "x402agent-nanoclawd",
    mcpServer: {
      name: "solana-runtime-shell",
      command: "clawd",
      args: ["runtime", "mcp-server"],
    },
    providers: ["grok", "openrouter", "openai", "ollama", "solana", "helius"],
    env: [
      "HELIUS_API_KEY",
      "HELIUS_RPC_URL",
      "XAI_API_KEY",
      "OPENROUTER_API_KEY",
      "OPENAI_API_KEY",
      "SOLANA_PRIVATE_KEY",
      "PRIVY_APP_ID",
    ],
  };
}

export function networkPolicyYaml(): string {
  return `inbound:
  allow:
    - from: localhost

outbound:
  allow:
    - host: "api.mainnet.helius-rpc.com"
      port: 443
      protocol: https
    - host: "rpc.helius.xyz"
      port: 443
      protocol: https
    - host: "api.jup.ag"
      port: 443
      protocol: https
    - host: "pump.fun"
      port: 443
      protocol: https
    - host: "api.x.ai"
      port: 443
      protocol: https
    - host: "openrouter.ai"
      port: 443
      protocol: https
    - host: "api.coingecko.com"
      port: 443
      protocol: https
`;
}

export function filesystemPolicyYaml(): string {
  return `filesystem:
  allow:
    - path: ~/.clawd
      permissions: [read, write]
    - path: ~/.nemoclaw
      permissions: [read, write]
    - path: ~/.config/clawd
      permissions: [read, write]
  deny:
    - path: ~/
      permissions: [write]
`;
}

export function providerJson(): string {
  const discovery = discoverRuntimeEnv();
  return JSON.stringify(
    {
      name: "solana-clawd",
      type: "solana-clawd",
      repository: "https://github.com/x402agent/nanoclawd",
      discovered: discovery,
      credentials: [
        "HELIUS_API_KEY",
        "HELIUS_RPC_URL",
        "XAI_API_KEY",
        "OPENROUTER_API_KEY",
        "OPENAI_API_KEY",
        "SOLANA_PRIVATE_KEY",
      ],
      configPaths: discovery.configPaths.map((item) => item.path),
    },
    null,
    2
  );
}

export function writeRuntimeArtifacts(cwd = process.cwd()): string[] {
  const openShellDir = projectOpenShellDir(cwd);
  ensureDir(openShellDir);

  const manifestPath = projectRuntimeManifestPath(cwd);
  const networkPath = projectNetworkPolicyPath(cwd);
  const filesystemPath = projectFilesystemPolicyPath(cwd);
  const providerPath = projectProviderPath(cwd);

  fs.writeFileSync(manifestPath, JSON.stringify(buildRuntimeManifest(), null, 2));
  fs.writeFileSync(networkPath, networkPolicyYaml());
  fs.writeFileSync(filesystemPath, filesystemPolicyYaml());
  fs.writeFileSync(providerPath, providerJson());

  addMCPServer({
    name: "solana-runtime-shell",
    transport: {
      type: "stdio",
      command: "clawd",
      args: ["runtime", "mcp-server"],
      env: {},
    },
  });

  return [manifestPath, networkPath, filesystemPath, providerPath];
}
