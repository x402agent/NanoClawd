import fs from "fs";
import path from "path";
import { RUNTIME_AGENTS_PATH } from "./paths.js";

export interface RuntimeAgent {
  id: string;
  name: string;
  prompt: string;
  status: "running" | "stopped";
  createdAt: string;
}

interface AgentState {
  agents: RuntimeAgent[];
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function load(): AgentState {
  try {
    if (!fs.existsSync(RUNTIME_AGENTS_PATH)) return { agents: [] };
    return JSON.parse(fs.readFileSync(RUNTIME_AGENTS_PATH, "utf8"));
  } catch {
    return { agents: [] };
  }
}

function save(state: AgentState): void {
  ensureParent(RUNTIME_AGENTS_PATH);
  fs.writeFileSync(RUNTIME_AGENTS_PATH, JSON.stringify(state, null, 2));
}

export function listRuntimeAgents(): RuntimeAgent[] {
  return load().agents;
}

export function spawnRuntimeAgent(name: string, prompt: string): RuntimeAgent {
  const state = load();
  const agent: RuntimeAgent = {
    id: `agent_${Date.now().toString(36)}`,
    name,
    prompt,
    status: "running",
    createdAt: new Date().toISOString(),
  };
  state.agents.unshift(agent);
  save(state);
  return agent;
}

export function stopRuntimeAgent(id: string): RuntimeAgent | null {
  const state = load();
  const agent = state.agents.find((item) => item.id === id);
  if (!agent) return null;
  agent.status = "stopped";
  save(state);
  return agent;
}
