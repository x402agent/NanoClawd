import { readEnvFile } from '../env.js';

export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet' | 'custom';

export type SolanaConfig = {
  cluster: SolanaCluster;
  rpcUrl: string;
  wsUrl: string | null;
  operatorKeypairPath: string | null;
};

const CLUSTER_RPC_DEFAULTS: Record<Exclude<SolanaCluster, 'custom'>, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  localnet: 'http://127.0.0.1:8899',
};

function parseCluster(raw: string | undefined): SolanaCluster {
  switch (raw) {
    case 'mainnet-beta':
    case 'devnet':
    case 'testnet':
    case 'localnet':
      return raw;
    case undefined:
    case '':
      return 'devnet';
    default:
      return 'custom';
  }
}

export function loadSolanaConfig(): SolanaConfig {
  const envValues = readEnvFile(['SOLANA_CLUSTER', 'SOLANA_RPC_URL', 'SOLANA_WS_URL', 'SOLANA_OPERATOR_KEYPAIR']);
  const raw = envValues.SOLANA_CLUSTER;
  const cluster = parseCluster(raw);
  const explicitRpc = envValues.SOLANA_RPC_URL;

  const rpcUrl =
    explicitRpc ??
    (cluster === 'custom' ? (raw as string) : CLUSTER_RPC_DEFAULTS[cluster as Exclude<SolanaCluster, 'custom'>]);

  return {
    cluster,
    rpcUrl,
    wsUrl: envValues.SOLANA_WS_URL ?? null,
    operatorKeypairPath: envValues.SOLANA_OPERATOR_KEYPAIR ?? null,
  };
}
