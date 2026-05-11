import fs from "fs";
import path from "path";
import { RUNTIME_MEMORY_PATH } from "./paths.js";

export type MemoryTier = "known" | "inferred" | "learned";

export interface MemoryEntry {
  id: string;
  tier: MemoryTier;
  content: string;
  tags: string[];
  createdAt: string;
}

interface MemoryState {
  entries: MemoryEntry[];
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function load(): MemoryState {
  try {
    if (!fs.existsSync(RUNTIME_MEMORY_PATH)) return { entries: [] };
    return JSON.parse(fs.readFileSync(RUNTIME_MEMORY_PATH, "utf8"));
  } catch {
    return { entries: [] };
  }
}

function save(state: MemoryState): void {
  ensureParent(RUNTIME_MEMORY_PATH);
  fs.writeFileSync(RUNTIME_MEMORY_PATH, JSON.stringify(state, null, 2));
}

export function writeMemory(content: string, tier: MemoryTier = "known", tags: string[] = []): MemoryEntry {
  const state = load();
  const entry: MemoryEntry = {
    id: `mem_${Date.now().toString(36)}`,
    tier,
    content,
    tags,
    createdAt: new Date().toISOString(),
  };
  state.entries.unshift(entry);
  save(state);
  return entry;
}

export function recallMemory(query?: string, tier?: MemoryTier, limit = 10): MemoryEntry[] {
  const state = load();
  let entries = state.entries;
  if (tier) entries = entries.filter((entry) => entry.tier === tier);
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(
      (entry) =>
        entry.content.toLowerCase().includes(q) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }
  return entries.slice(0, limit);
}
