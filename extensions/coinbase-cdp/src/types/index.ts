/**
 * Coinbase CDP Extension Types
 */

export interface CdpConfig {
  apiKeyId: string;
  apiKeySecret: string;
  walletSecret: string;
  paymasterUrl?: string;
}

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
}

export interface PluginContext {
  logger: Logger;
  registerTool: (tool: ClawdbotTool) => void;
}

export interface ClawdbotTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface ClawdbotPlugin {
  name: string;
  version: string;
  description: string;
  activate: (context: PluginContext) => Promise<void>;
  deactivate?: () => Promise<void>;
  getStatus?: () => Promise<{ enabled: boolean; message: string }>;
}

export interface EvmAccount {
  address: string;
  name?: string;
}

export interface SolanaAccount {
  address: string;
  name?: string;
}

export interface SmartAccount {
  address: string;
  ownerAddress: string;
  name?: string;
}

export interface TransactionResult {
  transactionHash: string;
  status: string;
}

export interface UserOperationResult {
  userOperationHash: string;
  transactionHash?: string;
  status: string;
}

export interface WalletInfo {
  type: 'evm' | 'solana' | 'smart';
  address: string;
  name?: string;
  network?: string;
  balance?: string;
}
