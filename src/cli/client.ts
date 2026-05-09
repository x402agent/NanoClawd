/**
 * `nclwd` binary entry point.
 *
 * Parses argv, builds a request frame, sends it via the picked transport,
 * formats the response, exits non-zero on error.
 *
 * Usage:
 *   nclwd <resource> <verb> [target] [--key value ...] [--json]
 *
 * Examples:
 *   nclwd groups list
 *   nclwd groups get abc123
 *   nclwd groups create --name foo --folder bar
 *   nclwd groups update abc123 --name baz
 *   nclwd help
 *   nclwd groups help
 */
import { randomUUID } from 'crypto';

import { formatResponse } from './format.js';
import type { RequestFrame } from './frame.js';
import { SocketTransport } from './socket-client.js';
import type { Transport } from './transport.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const { command, args, json } = parseArgv(argv);
  const req: RequestFrame = { id: randomUUID(), command, args };
  const transport: Transport = pickTransport();

  let res;
  try {
    res = await transport.sendFrame(req);
  } catch (e) {
    process.stderr.write(formatTransportError(e));
    process.exit(2);
  }

  process.stdout.write(formatResponse(res, json ? 'json' : 'human'));
  process.exit(res.ok ? 0 : 1);
}

function pickTransport(): Transport {
  return new SocketTransport();
}

function parseArgv(argv: string[]): {
  command: string;
  args: Record<string, unknown>;
  json: boolean;
} {
  const positional: string[] = [];
  const args: Record<string, unknown> = {};
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') {
      json = true;
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
      continue;
    }
    positional.push(a);
  }

  if (positional.length === 0) {
    process.stderr.write('nclwd: missing command\n');
    printUsage();
    process.exit(2);
  }

  // Join all positionals with dashes to form the command name.
  // If the full name isn't a command, the dispatcher will try trimming
  // the last segment and using it as the target ID (e.g. `groups get abc`
  // → command "groups-get", id "abc").
  const command = positional.join('-');

  return { command, args, json };
}

function printUsage(): void {
  process.stdout.write(
    [
      'Usage: nclwd <resource> <verb> [target] [--key value ...] [--json]',
      '',
      'Run `nclwd help` to list available resources and commands.',
      '',
    ].join('\n'),
  );
}

function formatTransportError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('ENOENT') || msg.includes('ECONNREFUSED')) {
    return [
      `nclwd: cannot reach NanoClawd host (${msg}).`,
      `Is the host running? Start it with: pnpm run dev`,
      `Or, if installed as a service:`,
      `  macOS:  launchctl kickstart -k gui/$(id -u)/com.nanoclawd`,
      `  Linux:  systemctl --user restart nanoclawd`,
      ``,
    ].join('\n');
  }
  return `nclwd: transport error: ${msg}\n`;
}

main().catch((err) => {
  process.stderr.write(`nclwd: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
