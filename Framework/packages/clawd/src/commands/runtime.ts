import { Command } from "commander";
import chalk from "chalk";
import { discoverRuntimeEnv } from "../runtime/discovery.js";
import { buildRuntimeManifest, filesystemPolicyYaml, networkPolicyYaml, writeRuntimeArtifacts } from "../runtime/openshell.js";
import { startRuntimeMCPServer } from "../runtime/mcp-server.js";

export function createRuntimeCommand(): Command {
  const runtime = new Command("runtime");
  runtime.description("Bootstrap and inspect the Solana Clawd runtime shell");

  runtime
    .command("init")
    .description("Write OpenShell-style runtime manifests, policies, and MCP bootstrap config")
    .action(() => {
      const written = writeRuntimeArtifacts(process.cwd());
      console.log(chalk.green("✓ Solana Clawd runtime shell initialized"));
      written.forEach((file) => console.log(`  ${file}`));
      console.log(chalk.blue("  MCP server registered as: solana-runtime-shell"));
    });

  runtime
    .command("doctor")
    .description("Print runtime environment and discovery summary")
    .action(() => {
      console.log(JSON.stringify({
        manifest: buildRuntimeManifest(),
        discovery: discoverRuntimeEnv(),
      }, null, 2));
    });

  runtime
    .command("print-policy")
    .description("Print generated OpenShell network and filesystem policies")
    .action(() => {
      console.log("# network-policy.yaml");
      console.log(networkPolicyYaml());
      console.log("# filesystem-policy.yaml");
      console.log(filesystemPolicyYaml());
    });

  runtime
    .command("mcp-server")
    .description("Run the local Solana runtime MCP server over stdio")
    .action(async () => {
      await startRuntimeMCPServer();
    });

  return runtime;
}
