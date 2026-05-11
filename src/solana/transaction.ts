/**
 * Minimal Solana transaction builder — zero external dependencies.
 *
 * Builds, signs, serializes, and sends raw Solana transactions using
 * only Node.js crypto for ed25519 signing and the RPC module for submission.
 *
 * Transaction format:
 *   [compact-array of signatures] [message]
 *   message = [header] [compact-array of account keys] [blockhash] [instructions]
 */
import { createPrivateKey, sign } from 'crypto';
import type { SolanaAddress, SignatureBase58 } from './types.js';
import { base58Decode, base58Encode } from './base58.js';
import { getLatestBlockhash, sendTransaction } from './rpc.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type AccountMeta = {
  pubkey: SolanaAddress;
  isSigner: boolean;
  isWritable: boolean;
};

export type Instruction = {
  programId: SolanaAddress;
  accounts: AccountMeta[];
  data: Uint8Array;
};

export type Transaction = {
  signers: Uint8Array[]; // 64-byte keypairs
  instructions: Instruction[];
  feePayer: SolanaAddress;
  recentBlockhash?: string;
  lastValidBlockHeight?: number;
};

// ── Compact-Array helpers ──────────────────────────────────────────────────

/**
 * Encode a "compact-array" used in Solana's wire format:
 *   - 1-3 bytes: varint length (multibyte)
 *   - N bytes: concatenated items
 */

function encodeVarint(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  if (n < 0x4000) return new Uint8Array([(n & 0x7f) | 0x80, n >> 7]);
  if (n < 0x200000) return new Uint8Array([(n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, n >> 14]);
  throw new Error(`Varint too large: ${n}`);
}

function encodeCompactArray(items: Uint8Array[]): Uint8Array {
  const totalLen = items.reduce((s, i) => s + i.length, 0);
  const lenBytes = encodeVarint(items.length);
  const out = new Uint8Array(lenBytes.length + totalLen);
  let offset = 0;
  out.set(lenBytes, offset);
  offset += lenBytes.length;
  for (const item of items) {
    out.set(item, offset);
    offset += item.length;
  }
  return out;
}

// ── Public key helpers ──────────────────────────────────────────────────────

function pubkeyToBytes(pk: SolanaAddress): Uint8Array {
  return base58Decode(pk);
}

function sortPubkeys(keys: SolanaAddress[]): SolanaAddress[] {
  return [...keys].sort((a, b) => {
    const ab = base58Decode(a);
    const bb = base58Decode(b);
    for (let i = 0; i < 32; i++) {
      if (ab[i]! < bb[i]!) return -1;
      if (ab[i]! > bb[i]!) return 1;
    }
    return 0;
  });
}

// ── SHA-256 (for message hash) ────────────────────────────────────────────

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(hashBuffer);
}

// ── Transaction building ───────────────────────────────────────────────────

/**
 * Build the Solana wire-format message bytes from instructions.
 *
 * Message layout:
 *   [1 byte]  numRequiredSignatures
 *   [1 byte]  numReadonlySignedAccounts
 *   [1 byte]  numReadonlyUnsignedAccounts
 *   [compact-array of pubkeys]  (sorted: signers first, then writables, then read-only)
 *   [32 bytes] recent blockhash
 *   [compact-array of compiled instructions]
 */
function buildMessage(tx: Transaction): {
  message: Uint8Array;
  signerPubkeys: SolanaAddress[];
  accountKeys: SolanaAddress[];
} {
  // Collect unique account keys
  const signerSet = new Set<SolanaAddress>();
  const writableSet = new Set<SolanaAddress>();
  const readonlySet = new Set<SolanaAddress>();

  // Fee payer is always a signer and writable
  signerSet.add(tx.feePayer);
  writableSet.add(tx.feePayer);

  // Mark signers from keypairs
  for (const kp of tx.signers) {
    const pk = base58Encode(kp.slice(32)) as SolanaAddress;
    signerSet.add(pk);
    writableSet.add(pk);
  }

  for (const ix of tx.instructions) {
    readonlySet.add(ix.programId);
    for (const acct of ix.accounts) {
      if (acct.isSigner) signerSet.add(acct.pubkey);
      if (acct.isWritable) writableSet.add(acct.pubkey);
      else readonlySet.add(acct.pubkey);
    }
  }

  // Build sorted account list: signers first (writable then readonly),
  // then non-signers (writable then readonly)
  const signerWritable: SolanaAddress[] = [];
  const signerReadonly: SolanaAddress[] = [];
  const nonSignerWritable: SolanaAddress[] = [];
  const nonSignerReadonly: SolanaAddress[] = [];

  for (const pk of [...signerSet]) {
    if (writableSet.has(pk)) signerWritable.push(pk);
    else signerReadonly.push(pk);
  }
  for (const pk of [...writableSet]) {
    if (!signerSet.has(pk)) nonSignerWritable.push(pk);
  }
  for (const pk of [...readonlySet]) {
    if (!signerSet.has(pk)) nonSignerReadonly.push(pk);
  }

  const accountKeys = [
    ...sortPubkeys(signerWritable),
    ...sortPubkeys(signerReadonly),
    ...sortPubkeys(nonSignerWritable),
    ...sortPubkeys(nonSignerReadonly),
  ];

  const numRequiredSignatures = signerSet.size;
  const numReadonlySignedAccounts = signerReadonly.length;
  const numReadonlyUnsignedAccounts = nonSignerReadonly.length;

  // Build account key index map
  const keyIndex = new Map<SolanaAddress, number>();
  for (let i = 0; i < accountKeys.length; i++) keyIndex.set(accountKeys[i]!, i);

  // Compile instructions
  const compiledIxs: Uint8Array[] = [];
  for (const ix of tx.instructions) {
    const progIdx = keyIndex.get(ix.programId);
    if (progIdx === undefined) throw new Error(`Program ${ix.programId} not in account list`);

    // Compact array of account indices (1 byte each since we assume < 256)
    const acctIndices = new Uint8Array(ix.accounts.length);
    for (let i = 0; i < ix.accounts.length; i++) {
      const idx = keyIndex.get(ix.accounts[i]!.pubkey);
      if (idx === undefined) throw new Error(`Account ${ix.accounts[i]!.pubkey} not in account list`);
      acctIndices[i] = idx;
    }

    const compiledIx = new Uint8Array([
      0, // programIdIndex placeholder
      ...encodeVarint(ix.accounts.length), // accounts compact array
      ...acctIndices,
      ...encodeVarint(ix.data.length), // data compact array
      ...ix.data,
    ]);
    compiledIx[0] = progIdx;

    compiledIxs.push(compiledIx);
  }

  // Build message header (3 bytes)
  const header = new Uint8Array([numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts]);

  // Build account keys compact array
  const keyBytes = accountKeys.map((pk) => pubkeyToBytes(pk));
  const keysCompact = encodeCompactArray(keyBytes);

  // Blockhash
  const recentBlockhash = tx.recentBlockhash;
  if (!recentBlockhash) throw new Error('recentBlockhash required');
  const blockhashBytes = base58Decode(recentBlockhash);

  // Instructions compact array
  const ixsCompact = encodeCompactArray(compiledIxs);

  // Assemble full message
  const message = new Uint8Array(header.length + keysCompact.length + blockhashBytes.length + ixsCompact.length);
  let offset = 0;
  message.set(header, offset);
  offset += header.length;
  message.set(keysCompact, offset);
  offset += keysCompact.length;
  message.set(blockhashBytes, offset);
  offset += blockhashBytes.length;
  message.set(ixsCompact, offset);

  return { message, signerPubkeys: [...signerSet] as SolanaAddress[], accountKeys };
}

/**
 * Sign a message bytes with an ed25519 keypair (PKCS8 wrapped seed).
 */
function signBytes(message: Uint8Array, keypair: Uint8Array): Uint8Array {
  const seed = keypair.slice(0, 32);
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const privateKey = createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.from(seed)]),
    format: 'der',
    type: 'pkcs8',
  });
  return sign(null, Buffer.from(message), privateKey);
}

/**
 * Serialize a signed transaction to base58 for RPC submission.
 * Format: [compact-array of 64-byte signatures] [message bytes]
 */
function serializeTransaction(message: Uint8Array, signatures: Uint8Array[]): string {
  const sigBytes = encodeCompactArray(signatures);
  const txBytes = new Uint8Array(sigBytes.length + message.length);
  txBytes.set(sigBytes, 0);
  txBytes.set(message, sigBytes.length);
  return base58Encode(txBytes);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Sign and send a transaction.
 *
 * Fetches recent blockhash if not provided, signs all signers,
 * serializes, and submits to the RPC.
 */
export async function signAndSendTransaction(
  tx: Transaction,
  opts: { skipPreflight?: boolean; maxRetries?: number } = {},
): Promise<SignatureBase58> {
  // Fetch blockhash if not set
  if (!tx.recentBlockhash) {
    const bh = await getLatestBlockhash();
    tx.recentBlockhash = bh.blockhash;
    tx.lastValidBlockHeight = bh.lastValidBlockHeight;
  }

  // Build message
  const { message } = buildMessage(tx);

  // Hash message for signing (Solana uses a double-hash for signing)
  // Actually Solana signs the raw message bytes directly, but the message
  // is first hashed once before being passed to ed25519
  const messageHash = await sha256(message);

  // Sign with each keypair
  const signatures: Uint8Array[] = [];
  for (const kp of tx.signers) {
    const sig = signBytes(messageHash, kp);
    signatures.push(sig);
  }

  // Serialize
  const encodedTx = serializeTransaction(message, signatures);

  // Send
  return sendTransaction(encodedTx, opts);
}

/**
 * Simulate a transaction without signing (for dry-run / cost estimation).
 * Returns base58-encoded unsigned transaction for simulation.
 */
export async function simulateTransactionBuilder(tx: Transaction): Promise<string> {
  if (!tx.recentBlockhash) {
    const bh = await getLatestBlockhash();
    tx.recentBlockhash = bh.blockhash;
  }

  const { message } = buildMessage(tx);

  // Unsigned tx has empty signatures compact array
  const encoded = serializeTransaction(message, []);
  return encoded;
}
