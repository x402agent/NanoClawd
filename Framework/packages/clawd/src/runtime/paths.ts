import os from "os";
import path from "path";

export const CLAWD_HOME = path.join(os.homedir(), ".clawd");
export const RUNTIME_HOME = path.join(CLAWD_HOME, "runtime-shell");
export const RUNTIME_MEMORY_PATH = path.join(RUNTIME_HOME, "memory.json");
export const RUNTIME_AGENTS_PATH = path.join(RUNTIME_HOME, "agents.json");
export const RUNTIME_ENV_SUMMARY_PATH = path.join(RUNTIME_HOME, "env-summary.json");

export function projectRuntimeDir(cwd = process.cwd()): string {
  return path.join(cwd, ".clawd");
}

export function projectOpenShellDir(cwd = process.cwd()): string {
  return path.join(projectRuntimeDir(cwd), "openshell");
}

export function projectRuntimeManifestPath(cwd = process.cwd()): string {
  return path.join(projectRuntimeDir(cwd), "runtime-shell.json");
}

export function projectNetworkPolicyPath(cwd = process.cwd()): string {
  return path.join(projectOpenShellDir(cwd), "network-policy.yaml");
}

export function projectFilesystemPolicyPath(cwd = process.cwd()): string {
  return path.join(projectOpenShellDir(cwd), "filesystem-policy.yaml");
}

export function projectProviderPath(cwd = process.cwd()): string {
  return path.join(projectOpenShellDir(cwd), "provider.json");
}
