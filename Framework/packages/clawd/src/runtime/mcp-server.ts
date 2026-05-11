import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { discoverRuntimeEnv } from "./discovery.js";
import { listRuntimeAgents, spawnRuntimeAgent, stopRuntimeAgent } from "./agent-registry.js";
import { recallMemory, writeMemory } from "./memory-store.js";
import { buildRuntimeManifest, filesystemPolicyYaml, networkPolicyYaml } from "./openshell.js";

export async function startRuntimeMCPServer(): Promise<void> {
  const server = new McpServer({
    name: "solana-runtime-shell",
    version: "0.1.0",
  });

  server.registerTool("runtime_env_summary", {
    title: "Runtime Environment Summary",
    description: "Discover Solana Clawd runtime environment variables and config paths.",
    inputSchema: {},
  }, async () => ({
    content: [{ type: "text", text: JSON.stringify(discoverRuntimeEnv(), null, 2) }],
  }));

  server.registerTool("runtime_provider_discovery", {
    title: "Runtime Provider Discovery",
    description: "Return provider-discovery metadata for OpenShell-style credential injection.",
    inputSchema: {},
  }, async () => ({
    content: [{ type: "text", text: JSON.stringify(buildRuntimeManifest(), null, 2) }],
  }));

  server.registerTool("runtime_policy_summary", {
    title: "Runtime Policy Summary",
    description: "Return network and filesystem policies for the runtime shell.",
    inputSchema: {},
  }, async () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        networkPolicy: networkPolicyYaml(),
        filesystemPolicy: filesystemPolicyYaml(),
      }, null, 2),
    }],
  }));

  server.registerTool("memory_recall", {
    title: "Memory Recall",
    description: "Recall runtime memory entries by query and tier.",
    inputSchema: {
      query: z.string().optional(),
      tier: z.enum(["known", "inferred", "learned"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
  }, async ({ query, tier, limit }) => ({
    content: [{ type: "text", text: JSON.stringify(recallMemory(query, tier, limit || 10), null, 2) }],
  }));

  server.registerTool("memory_write", {
    title: "Memory Write",
    description: "Write runtime memory into known/inferred/learned tiers.",
    inputSchema: {
      content: z.string(),
      tier: z.enum(["known", "inferred", "learned"]).optional(),
      tags: z.array(z.string()).optional(),
    },
  }, async ({ content, tier, tags }) => ({
    content: [{ type: "text", text: JSON.stringify(writeMemory(content, tier || "known", tags || []), null, 2) }],
  }));

  server.registerTool("agent_list", {
    title: "Agent List",
    description: "List runtime-shell agents.",
    inputSchema: {},
  }, async () => ({
    content: [{ type: "text", text: JSON.stringify(listRuntimeAgents(), null, 2) }],
  }));

  server.registerTool("agent_spawn", {
    title: "Agent Spawn",
    description: "Register a runtime-shell agent entry.",
    inputSchema: {
      name: z.string(),
      prompt: z.string(),
    },
  }, async ({ name, prompt }) => ({
    content: [{ type: "text", text: JSON.stringify(spawnRuntimeAgent(name, prompt), null, 2) }],
  }));

  server.registerTool("agent_stop", {
    title: "Agent Stop",
    description: "Stop a runtime-shell agent entry.",
    inputSchema: {
      id: z.string(),
    },
  }, async ({ id }) => ({
    content: [{ type: "text", text: JSON.stringify(stopRuntimeAgent(id), null, 2) }],
  }));

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
