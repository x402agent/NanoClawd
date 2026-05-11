import path from "path";
import { getSettingsManager } from "../utils/settings-manager.js";
import { MCPServerConfig } from "./client.js";

export interface MCPConfig {
  servers: MCPServerConfig[];
}

/**
 * Load MCP configuration from project settings
 */
export function loadMCPConfig(): MCPConfig {
  const manager = getSettingsManager();
  const projectSettings = manager.loadProjectSettings();
  const servers = projectSettings.mcpServers ? Object.values(projectSettings.mcpServers) : [];
  return { servers };
}

export function saveMCPConfig(config: MCPConfig): void {
  const manager = getSettingsManager();
  const mcpServers: Record<string, MCPServerConfig> = {};

  // Convert servers array to object keyed by name
  for (const server of config.servers) {
    mcpServers[server.name] = server;
  }

  manager.updateProjectSetting('mcpServers', mcpServers);
}

export function addMCPServer(config: MCPServerConfig): void {
  const manager = getSettingsManager();
  const projectSettings = manager.loadProjectSettings();
  const mcpServers = projectSettings.mcpServers || {};

  mcpServers[config.name] = config;
  manager.updateProjectSetting('mcpServers', mcpServers);
}

export function removeMCPServer(serverName: string): void {
  const manager = getSettingsManager();
  const projectSettings = manager.loadProjectSettings();
  const mcpServers = projectSettings.mcpServers;

  if (mcpServers) {
    delete mcpServers[serverName];
    manager.updateProjectSetting('mcpServers', mcpServers);
  }
}

export function getMCPServer(serverName: string): MCPServerConfig | undefined {
  const manager = getSettingsManager();
  const projectSettings = manager.loadProjectSettings();
  return projectSettings.mcpServers?.[serverName];
}

// Predefined server configurations
export const PREDEFINED_SERVERS: Record<string, MCPServerConfig> = {
  "solana-runtime-shell": {
    name: "solana-runtime-shell",
    transport: {
      type: "stdio",
      command: "clawd",
      args: ["runtime", "mcp-server"],
      env: {
        CLAWD_RUNTIME_PROJECT_DIR: process.cwd(),
        PATH: process.env.PATH || "",
      },
    },
  },
  "solana-runtime-shell-local-node": {
    name: "solana-runtime-shell-local-node",
    transport: {
      type: "stdio",
      command: process.execPath,
      args: [path.join(process.cwd(), "packages", "clawd", "dist", "index.js"), "runtime", "mcp-server"],
      env: {
        CLAWD_RUNTIME_PROJECT_DIR: process.cwd(),
        PATH: process.env.PATH || "",
      },
    },
  },
};
