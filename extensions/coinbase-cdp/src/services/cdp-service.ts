/**
 * Coinbase CDP Service
 * Handles wallet creation, management, and transactions for EVM and Solana
 */

import { CdpClient } from "@coinbase/cdp-sdk";
import type { Logger, CdpConfig, WalletInfo } from "../types/index.js";

// CDP SDK network types - exported for use in tools
export type EvmFaucetNetwork = "base-sepolia" | "ethereum-sepolia";
export type EvmFaucetToken = "eth" | "usdc" | "eurc" | "cbbtc";
export type EvmTransactionNetwork = "base-sepolia" | "base" | "ethereum-sepolia" | "ethereum" | "arbitrum-sepolia" | "arbitrum" | "optimism-sepolia" | "optimism";
export type SolanaFaucetToken = "sol" | "usdc";

// Store created wallets in memory for the session
interface WalletStore {
  evmAccounts: Map<string, { address: string; name?: string }>;
  solanaAccounts: Map<string, { address: string; name?: string }>;
  smartAccounts: Map<string, { address: string; ownerAddress: string; name?: string }>;
}

/**
 * Convert a base64-encoded key to PEM format if needed
 */
function ensurePemFormat(key: string): string {
  // If already in PEM format, return as-is
  if (key.includes('-----BEGIN')) {
    return key;
  }

  // Check if it looks like a base64-encoded PKCS#8 key
  if (key.startsWith('MIG') || key.startsWith('MC')) {
    // Wrap in PRIVATE KEY PEM headers (PKCS#8 format)
    return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }

  // Return as-is if format is unknown
  return key;
}

export class CdpService {
  private cdp: CdpClient;
  private logger: Logger;
  private wallets: WalletStore;
  private paymasterUrl?: string;

  constructor(config: CdpConfig, logger: Logger) {
    this.logger = logger;
    this.paymasterUrl = config.paymasterUrl;

    // Convert API key secret to PEM format if needed
    const apiKeySecret = ensurePemFormat(config.apiKeySecret);

    // Initialize CDP client with explicit credentials
    this.cdp = new CdpClient({
      apiKeyId: config.apiKeyId,
      apiKeySecret: apiKeySecret,
      walletSecret: config.walletSecret,
    });

    this.wallets = {
      evmAccounts: new Map(),
      solanaAccounts: new Map(),
      smartAccounts: new Map(),
    };
  }

  /**
   * Test connectivity to CDP API
   */
  async ping(): Promise<boolean> {
    try {
      // Try to list accounts as a connectivity test
      await this.cdp.evm.listAccounts({ pageSize: 1 });
      return true;
    } catch (error) {
      this.logger.error(`[cdp] Connectivity test failed: ${error}`);
      return false;
    }
  }

  // ============ EVM Account Methods ============

  /**
   * Create a new EVM account
   */
  async createEvmAccount(name?: string): Promise<WalletInfo> {
    try {
      const account = name
        ? await this.cdp.evm.getOrCreateAccount({ name })
        : await this.cdp.evm.createAccount();

      this.wallets.evmAccounts.set(account.address, {
        address: account.address,
        name: name,
      });

      this.logger.info(`[cdp] Created EVM account: ${account.address}`);

      return {
        type: 'evm',
        address: account.address,
        name: name,
      };
    } catch (error) {
      this.logger.error(`[cdp] Failed to create EVM account: ${error}`);
      throw error;
    }
  }

  /**
   * Get or create an EVM account by name
   */
  async getOrCreateEvmAccount(name: string): Promise<WalletInfo> {
    try {
      const account = await this.cdp.evm.getOrCreateAccount({ name });

      this.wallets.evmAccounts.set(account.address, {
        address: account.address,
        name: name,
      });

      return {
        type: 'evm',
        address: account.address,
        name: name,
      };
    } catch (error) {
      this.logger.error(`[cdp] Failed to get/create EVM account: ${error}`);
      throw error;
    }
  }

  /**
   * List all EVM accounts
   */
  async listEvmAccounts(): Promise<WalletInfo[]> {
    try {
      const response = await this.cdp.evm.listAccounts();
      const accounts: WalletInfo[] = [];

      for (const account of response.accounts) {
        accounts.push({
          type: 'evm',
          address: account.address,
          name: account.name,
        });
        this.wallets.evmAccounts.set(account.address, {
          address: account.address,
          name: account.name,
        });
      }

      return accounts;
    } catch (error) {
      this.logger.error(`[cdp] Failed to list EVM accounts: ${error}`);
      throw error;
    }
  }

  /**
   * Request testnet funds for EVM account
   */
  async requestEvmFaucet(
    address: string,
    network: EvmFaucetNetwork = "base-sepolia",
    token: EvmFaucetToken = "eth"
  ): Promise<string> {
    try {
      const response = await this.cdp.evm.requestFaucet({
        address: address as `0x${string}`,
        network,
        token,
      });

      this.logger.info(`[cdp] Requested faucet for ${address}: ${response.transactionHash}`);
      return response.transactionHash;
    } catch (error) {
      this.logger.error(`[cdp] Failed to request EVM faucet: ${error}`);
      throw error;
    }
  }

  /**
   * Send EVM transaction
   */
  async sendEvmTransaction(
    address: string,
    to: string,
    value: string,
    network: EvmTransactionNetwork = "base-sepolia"
  ): Promise<string> {
    try {
      const result = await this.cdp.evm.sendTransaction({
        address: address as `0x${string}`,
        transaction: {
          to: to as `0x${string}`,
          value: BigInt(value),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        network: network as any,  // SDK accepts more networks at runtime than types suggest
      });

      this.logger.info(`[cdp] EVM transaction sent: ${result.transactionHash}`);
      return result.transactionHash;
    } catch (error) {
      this.logger.error(`[cdp] Failed to send EVM transaction: ${error}`);
      throw error;
    }
  }

  // ============ Smart Account Methods ============

  /**
   * Create a smart account (ERC-4337)
   */
  async createSmartAccount(ownerAddress: string, name?: string): Promise<WalletInfo> {
    try {
      // Get the owner account first
      const owner = await this.cdp.evm.getAccount({ address: ownerAddress as `0x${string}` });
      if (!owner) {
        throw new Error(`Owner account not found: ${ownerAddress}`);
      }

      const smartAccount = name
        ? await this.cdp.evm.getOrCreateSmartAccount({ owner, name })
        : await this.cdp.evm.createSmartAccount({ owner });

      this.wallets.smartAccounts.set(smartAccount.address, {
        address: smartAccount.address,
        ownerAddress,
        name,
      });

      this.logger.info(`[cdp] Created Smart Account: ${smartAccount.address}`);

      return {
        type: 'smart',
        address: smartAccount.address,
        name,
      };
    } catch (error) {
      this.logger.error(`[cdp] Failed to create Smart Account: ${error}`);
      throw error;
    }
  }

  // ============ Solana Account Methods ============

  /**
   * Create a new Solana account
   */
  async createSolanaAccount(name?: string): Promise<WalletInfo> {
    try {
      const account = name
        ? await this.cdp.solana.getOrCreateAccount({ name })
        : await this.cdp.solana.createAccount();

      this.wallets.solanaAccounts.set(account.address, {
        address: account.address,
        name,
      });

      this.logger.info(`[cdp] Created Solana account: ${account.address}`);

      return {
        type: 'solana',
        address: account.address,
        name,
      };
    } catch (error) {
      this.logger.error(`[cdp] Failed to create Solana account: ${error}`);
      throw error;
    }
  }

  /**
   * Get or create a Solana account by name
   */
  async getOrCreateSolanaAccount(name: string): Promise<WalletInfo> {
    try {
      const account = await this.cdp.solana.getOrCreateAccount({ name });

      this.wallets.solanaAccounts.set(account.address, {
        address: account.address,
        name,
      });

      return {
        type: 'solana',
        address: account.address,
        name,
      };
    } catch (error) {
      this.logger.error(`[cdp] Failed to get/create Solana account: ${error}`);
      throw error;
    }
  }

  /**
   * List all Solana accounts
   */
  async listSolanaAccounts(): Promise<WalletInfo[]> {
    try {
      const response = await this.cdp.solana.listAccounts();
      const accounts: WalletInfo[] = [];

      for (const account of response.accounts) {
        accounts.push({
          type: 'solana',
          address: account.address,
          name: account.name,
        });
        this.wallets.solanaAccounts.set(account.address, {
          address: account.address,
          name: account.name,
        });
      }

      return accounts;
    } catch (error) {
      this.logger.error(`[cdp] Failed to list Solana accounts: ${error}`);
      throw error;
    }
  }

  /**
   * Request devnet funds for Solana account
   */
  async requestSolanaFaucet(address: string, token: SolanaFaucetToken = "sol"): Promise<string> {
    try {
      const response = await this.cdp.solana.requestFaucet({
        address,
        token,
      });

      this.logger.info(`[cdp] Requested Solana faucet for ${address}: ${response.signature}`);
      return response.signature;
    } catch (error) {
      this.logger.error(`[cdp] Failed to request Solana faucet: ${error}`);
      throw error;
    }
  }

  /**
   * Sign a Solana transaction
   */
  async signSolanaTransaction(address: string, transaction: string): Promise<string> {
    try {
      const result = await this.cdp.solana.signTransaction({
        address,
        transaction,
      });

      this.logger.info(`[cdp] Signed Solana transaction for ${address}`);
      return result.signature;
    } catch (error) {
      this.logger.error(`[cdp] Failed to sign Solana transaction: ${error}`);
      throw error;
    }
  }

  /**
   * Sign a Solana message
   */
  async signSolanaMessage(address: string, message: string): Promise<string> {
    try {
      const result = await this.cdp.solana.signMessage({
        address,
        message,
      });

      this.logger.info(`[cdp] Signed Solana message for ${address}`);
      return result.signature;
    } catch (error) {
      this.logger.error(`[cdp] Failed to sign Solana message: ${error}`);
      throw error;
    }
  }

  // ============ Utility Methods ============

  /**
   * Get all wallets (from local cache)
   */
  getAllWallets(): WalletInfo[] {
    const wallets: WalletInfo[] = [];

    for (const [, account] of this.wallets.evmAccounts) {
      wallets.push({ type: 'evm', ...account });
    }

    for (const [, account] of this.wallets.solanaAccounts) {
      wallets.push({ type: 'solana', ...account });
    }

    for (const [, account] of this.wallets.smartAccounts) {
      wallets.push({ type: 'smart', address: account.address, name: account.name });
    }

    return wallets;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.wallets.evmAccounts.clear();
    this.wallets.solanaAccounts.clear();
    this.wallets.smartAccounts.clear();
  }
}
