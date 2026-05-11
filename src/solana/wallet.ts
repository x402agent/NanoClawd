import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from '../log.js';
import { loadSolanaConfig } from './config.js';
import { base58Decode, base58Encode } from './base58.js';
import type { SolanaAddress } from './types.js';

export type OperatorWallet = {
  readonly pubkey: SolanaAddress;
  readonly secretKey: Uint8Array;
  readonly keypairPath: string;
};

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/**
 * Decode a Solana CLI keypair file. Two accepted shapes:
 *   1. JSON: a 64-element number array (Solana CLI default) — 32 bytes secret seed
 *      followed by 32 bytes pubkey.
 *   2. Plain text: a base58-encoded 64-byte secret key (Phantom export format).
 */
export function decodeKeypairFile(contents: string): Uint8Array {
  const trimmed = contents.trim();

  if (trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 64 ||
      !parsed.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255)
    ) {
      throw new Error('keypair JSON must be a 64-element array of bytes (0–255)');
    }
    return new Uint8Array(parsed as number[]);
  }

  const bytes = base58Decode(trimmed);
  if (bytes.length !== 64) {
    throw new Error(`base58 keypair must decode to 64 bytes, got ${bytes.length}`);
  }
  return bytes;
}

/**
 * Extract the 32-byte ed25519 public key from a 64-byte Solana keypair.
 * Solana CLI keypair format places the pubkey at bytes [32..64].
 */
export function pubkeyFromKeypair(keypair: Uint8Array): SolanaAddress {
  if (keypair.length !== 64) {
    throw new Error(`expected 64-byte keypair, got ${keypair.length}`);
  }
  return base58Encode(keypair.slice(32)) as SolanaAddress;
}

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

  let raw: string;
  try {
    raw = fs.readFileSync(expanded, 'utf-8');
  } catch (err) {
    log.error('Failed to read Solana operator keypair', { path: expanded, err });
    return null;
  }

  let secretKey: Uint8Array;
  try {
    secretKey = decodeKeypairFile(raw);
  } catch (err) {
    log.error('Failed to decode Solana operator keypair', { path: expanded, err });
    return null;
  }

  return {
    pubkey: pubkeyFromKeypair(secretKey),
    secretKey,
    keypairPath: expanded,
  };
}
