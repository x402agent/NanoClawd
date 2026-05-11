/**
 * Solana keypair generation — no external dependencies.
 *
 * Uses Node.js crypto.generateKeyPairSync to create ed25519 keys,
 * then packs them into the standard 64-byte Solana keypair format
 * (32-byte seed || 32-byte pubkey).
 */
import { generateKeyPairSync } from 'crypto';
import { base58Encode } from './base58.js';
import type { SolanaAddress } from './types.js';

/**
 * Generate a new Solana keypair.
 * Returns the keypair as a 64-byte Uint8Array.
 */
export function generateKeyPair(): Uint8Array {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // Extract seed from PKCS8 DER (last 32 bytes)
  const seed = privateKey.subarray(-32);
  if (seed.length !== 32) {
    throw new Error(`Unexpected PKCS8 key length: privateKey=${privateKey.length}, seed=${seed.length}`);
  }

  // Extract pubkey from SPKI DER (last 32 bytes)
  const pubkey = publicKey.subarray(-32);
  if (pubkey.length !== 32) {
    throw new Error(`Unexpected SPKI key length: publicKey=${publicKey.length}, pubkey=${pubkey.length}`);
  }

  // Solana CLI format: [32-byte seed || 32-byte pubkey]
  const keypair = new Uint8Array(64);
  keypair.set(seed, 0);
  keypair.set(pubkey, 32);

  return keypair;
}

/**
 * Derive the SolanaAddress from a 64-byte keypair.
 */
export function pubkeyFromKeypair(keypair: Uint8Array): SolanaAddress {
  if (keypair.length !== 64) {
    throw new Error(`Expected 64-byte keypair, got ${keypair.length}`);
  }
  return base58Encode(keypair.slice(32)) as SolanaAddress;
}
