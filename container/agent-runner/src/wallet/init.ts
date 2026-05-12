import fs from 'fs';
import path from 'path';

import { Keypair } from '@solana/web3.js';

import type { WalletData } from './types.js';

const WALLET_DIR = '/workspace/agent/.wallet';
const WALLET_FILE = path.join(WALLET_DIR, 'keypair.json');

let _cachedKeypair: Keypair | null = null;
let _cachedData: WalletData | null = null;

export function getWalletPath(): string {
  return WALLET_FILE;
}

export function walletExists(): boolean {
  return fs.existsSync(WALLET_FILE);
}

function loadFromDisk(): WalletData {
  const raw = fs.readFileSync(WALLET_FILE, 'utf-8');
  return JSON.parse(raw) as WalletData;
}

function saveToDisk(data: WalletData): void {
  fs.mkdirSync(WALLET_DIR, { recursive: true });
  fs.writeFileSync(WALLET_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function initWallet(): { keypair: Keypair; data: WalletData; isNew: boolean } {
  if (_cachedKeypair && _cachedData) {
    return { keypair: _cachedKeypair, data: _cachedData, isNew: false };
  }

  if (walletExists()) {
    const data = loadFromDisk();
    const keypair = Keypair.fromSecretKey(Uint8Array.from(data.solana.secretKey));
    _cachedKeypair = keypair;
    _cachedData = data;
    return { keypair, data, isNew: false };
  }

  const keypair = Keypair.generate();
  const agentGroupId = process.env.NANOCLAWD_AGENT_GROUP_ID ?? 'unknown';

  const data: WalletData = {
    version: 1,
    created: new Date().toISOString(),
    agentGroupId,
    solana: {
      secretKey: Array.from(keypair.secretKey),
      publicKey: keypair.publicKey.toBase58(),
    },
  };

  saveToDisk(data);
  _cachedKeypair = keypair;
  _cachedData = data;

  console.error(`[wallet] New NanoClawd Wallet created: ${keypair.publicKey.toBase58()}`);
  return { keypair, data, isNew: true };
}

export function getKeypair(): Keypair {
  return initWallet().keypair;
}

export function getPublicKey(): string {
  return initWallet().data.solana.publicKey;
}
