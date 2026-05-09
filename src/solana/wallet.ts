import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from '../log.js';
import { loadSolanaConfig } from './config.js';
import type { SolanaAddress } from './types.js';

export type OperatorWallet = {
  readonly pubkey: SolanaAddress;
  readonly keypairPath: string;
};

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/**
 * Load the operator's keypair path from config and verify the file exists.
 *
 * Scaffold: returns the path and a placeholder pubkey. Real implementation
 * will decode the JSON keyfile, verify it parses to a 64-byte ed25519 secret,
 * and derive the base58 pubkey via @solana/kit's createKeyPairSignerFromBytes.
 */
export function loadOperatorWallet(): OperatorWallet | null {
  const cfg = loadSolanaConfig();
  if (!cfg.operatorKeypairPath) {
    log.debug('Solana operator keypair not configured', { cluster: cfg.cluster });
    return null;
  }

  const expanded = expandHome(cfg.operatorKeypairPath);
  if (!fs.existsSync(expanded)) {
    log.warn('Solana operator keypair file not found', { path: expanded });
    return null;
  }

  return {
    pubkey: '__SCAFFOLD_PUBKEY__' as SolanaAddress,
    keypairPath: expanded,
  };
}
