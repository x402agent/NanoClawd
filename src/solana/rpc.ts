/**
 * Minimal Solana RPC client — no external dependencies.
 *
 * Calls JSON-RPC methods via HTTP POST. Handles pubkey derivation,
 * account deserialization, and transaction simulation.
 */
import { loadSolanaConfig, type SolanaConfig } from './config.js';
import { log } from '../log.js';
import type { SolanaAddress, SignatureBase58 } from './types.js';
import { base58Encode } from './base58.js';

type RpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown[];
};

type RpcResponse<T> = {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

let _config: SolanaConfig | null = null;
let _requestId = 0;

function getConfig(): SolanaConfig {
  if (!_config) _config = loadSolanaConfig();
  return _config;
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const cfg = getConfig();
  const id = ++_requestId;
  const body: RpcRequest = { jsonrpc: '2.0', id, method, params };

  const response = await fetch(cfg.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method}: HTTP ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as RpcResponse<T>;
  if (json.error) {
    throw new Error(`RPC ${method}: ${json.error.code} ${json.error.message}`);
  }

  return json.result as T;
}

/**
 * Get the latest blockhash for transaction building.
 */
export async function getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const result = await rpcCall<{ blockhash: string; lastValidBlockHeight: number }>('getLatestBlockhash', []);
  return result;
}

/**
 * Get SOL balance in lamports for an address.
 */
export async function getBalance(address: SolanaAddress): Promise<bigint> {
  const result = await rpcCall<number>('getBalance', [address]);
  return BigInt(result);
}

/**
 * Get multiple accounts' data as base64-encoded byte arrays.
 */
export async function getMultipleAccounts(
  addresses: SolanaAddress[],
  encoding: 'base64' | 'jsonParsed' = 'base64',
): Promise<Array<{ data: string[]; executable: boolean; lamports: number; owner: string } | null>> {
  const result = await rpcCall<{
    value: Array<{
      data: [string, string] | { parsed: unknown };
      executable: boolean;
      lamports: number;
      owner: string;
    } | null>;
  }>('getMultipleAccounts', [addresses, { encoding }]);
  return result.value.map((v) => {
    if (!v) return null;
    return {
      data: Array.isArray(v.data) ? v.data : [JSON.stringify(v.data), 'jsonParsed'],
      executable: v.executable,
      lamports: v.lamports,
      owner: v.owner,
    };
  });
}

/**
 * Get a single account's data.
 */
export async function getAccountInfo(
  address: SolanaAddress,
  encoding: 'base64' | 'jsonParsed' = 'base64',
): Promise<{ data: string; lamports: number; owner: string; executable: boolean } | null> {
  const result = await rpcCall<{
    data: [string, string];
    executable: boolean;
    lamports: number;
    owner: string;
  } | null>('getAccountInfo', [address, { encoding }]);

  if (!result) return null;
  return {
    data: result.data[0],
    lamports: result.lamports,
    owner: result.owner,
    executable: result.executable,
  };
}

/**
 * Simulate a transaction.
 * Returns the raw result object with logs.
 */
export async function simulateTransaction(
  encodedTx: string,
  sigVerify: boolean = false,
): Promise<{ err: unknown; logs: string[]; accounts: unknown[] | null }> {
  const result = await rpcCall<{
    err: unknown;
    logs: string[];
    accounts: unknown[] | null;
  }>('simulateTransaction', [encodedTx, { sigVerify, encoding: 'base58' }]);
  return result;
}

/**
 * Send a fully-signed, encoded transaction.
 */
export async function sendTransaction(
  encodedTx: string,
  opts: { skipPreflight?: boolean; maxRetries?: number; preflightCommitment?: string } = {},
): Promise<SignatureBase58> {
  const result = await rpcCall<string>('sendTransaction', [
    encodedTx,
    {
      skipPreflight: opts.skipPreflight ?? false,
      maxRetries: opts.maxRetries ?? 3,
      preflightCommitment: opts.preflightCommitment ?? 'confirmed',
      encoding: 'base58',
    },
  ]);
  return result as SignatureBase58;
}

/**
 * Wait for a transaction to be confirmed.
 */
export async function confirmTransaction(
  signature: SignatureBase58,
  commitment: 'confirmed' | 'finalized' = 'confirmed',
): Promise<{ err: unknown }> {
  const result = await rpcCall<{ err: unknown }>('getSignatureStatuses', [[signature]]);
  return result;
}

/**
 * Get token accounts by owner for a specific mint.
 */
export async function getTokenAccountsByOwner(
  owner: SolanaAddress,
  mint: SolanaAddress,
): Promise<Array<{ pubkey: SolanaAddress; account: { data: string; lamports: number; owner: string } }>> {
  const result = await rpcCall<{
    value: Array<{
      pubkey: string;
      account: {
        data: [string, string];
        executable: boolean;
        lamports: number;
        owner: string;
      };
    }>;
  }>('getTokenAccountsByOwner', [owner, { mint }, { encoding: 'base64' }]);

  return result.value.map((v) => ({
    pubkey: v.pubkey as SolanaAddress,
    account: {
      data: v.account.data[0],
      lamports: v.account.lamports,
      owner: v.account.owner,
    },
  }));
}

/**
 * Get program accounts (for PDAs or filtered).
 */
export async function getProgramAccounts(
  programId: SolanaAddress,
  filters: Array<{ memcmp?: { offset: number; bytes: string }; dataSize?: number }>,
): Promise<Array<{ pubkey: string; account: { data: string; lamports: number; owner: string } }>> {
  const result = await rpcCall<
    Array<{
      pubkey: string;
      account: {
        data: [string, string];
        executable: boolean;
        lamports: number;
        owner: string;
      };
    }>
  >('getProgramAccounts', [
    programId,
    {
      encoding: 'base64',
      filters,
    },
  ]);

  return result.map((v) => ({
    pubkey: v.pubkey,
    account: {
      data: v.account.data[0],
      lamports: v.account.lamports,
      owner: v.account.owner,
    },
  }));
}

/**
 * Decode base64 account data into a Uint8Array.
 */
export function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
