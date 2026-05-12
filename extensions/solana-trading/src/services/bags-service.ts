import { nanoid } from 'nanoid';

import type { Database } from '../db/index.js';
import { transactionLogTable } from '../db/schema.js';
import type {
  Logger,
  ServiceContext,
} from '../types.js';

export interface BagsServiceConfig {
  apiKey?: string;
  partnerConfigKey?: string;
  refCode?: string;
}

export interface TokenLaunchParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  initialBuySOL?: number;
  twitterUrl?: string;
  websiteUrl?: string;
  telegramUrl?: string;
  feeClaimers?: Array<{
    provider: "twitter" | "kick" | "github";
    username: string;
    bps: number;
  }>;
  usePartnerConfig?: boolean;
}

export interface TokenLaunchResult {
  success: boolean;
  signature?: string;
  tokenMint?: string;
  error?: string;
}

export interface FeeClaimResult {
  success: boolean;
  signature?: string;
  amountClaimed?: number;
  error?: string;
}

export type WalletProvider = (chatId: number) => Promise<{
  publicKey: string;
  signTransaction: (tx: string) => Promise<string>;
} | null>;

export type TransactionSender = (signedTx: string, rpcUrl: string) => Promise<string>;

const BAGS_API_BASE = "https://api.bags.fm/v1";

export class BagsService {
  private db: Database;
  private config: BagsServiceConfig;
  private logger: Logger;
  private rpcUrl: string;
  private walletProvider: WalletProvider | null = null;
  private transactionSender: TransactionSender | null = null;

  constructor(ctx: ServiceContext & { bagsConfig: BagsServiceConfig }) {
    this.db = ctx.db;
    this.config = ctx.bagsConfig;
    this.logger = ctx.logger;
    this.rpcUrl = ctx.rpcUrl;
  }

  setWalletProvider(provider: WalletProvider): void {
    this.walletProvider = provider;
  }

  setTransactionSender(sender: TransactionSender): void {
    this.transactionSender = sender;
  }

  async launchToken(
    chatId: number,
    params: TokenLaunchParams
  ): Promise<TokenLaunchResult> {
    this.logger.info(
      `[bags] Launching token for chatId ${chatId}: ${params.name} (${params.symbol})`
    );

    try {
      if (!this.config.apiKey) {
        return {
          success: false,
          error: "Bags API key not configured",
        };
      }

      if (!this.walletProvider) {
        return {
          success: false,
          error: "Wallet provider not configured",
        };
      }

      const wallet = await this.walletProvider(chatId);
      if (!wallet) {
        return {
          success: false,
          error: "No wallet found for user",
        };
      }

      // Prepare fee claimers with proper BPS allocation
      let feeClaimers = params.feeClaimers || [];
      const totalClaimerBps = feeClaimers.reduce((sum, c) => sum + c.bps, 0);

      // Creator gets the remainder (must add up to 10000)
      const creatorBps = 10000 - totalClaimerBps;
      if (creatorBps < 0) {
        return {
          success: false,
          error: "Fee claimer BPS exceeds 100% (10000 bps)",
        };
      }

      // Build the launch request
      const launchRequest = {
        name: params.name,
        symbol: params.symbol,
        description: params.description,
        imageUrl: params.imageUrl,
        initialBuyLamports: params.initialBuySOL
          ? Math.floor(params.initialBuySOL * 1e9)
          : 0,
        socials: {
          twitter: params.twitterUrl,
          website: params.websiteUrl,
          telegram: params.telegramUrl,
        },
        feeClaimers: feeClaimers.map((c) => ({
          provider: c.provider,
          username: c.username,
          bps: c.bps,
        })),
        creatorBps,
        creatorWallet: wallet.publicKey,
        partnerConfigKey: params.usePartnerConfig
          ? this.config.partnerConfigKey
          : undefined,
      };

      // Get unsigned transaction from Bags API
      const response = await fetch(`${BAGS_API_BASE}/tokens/launch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(launchRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bags API error: ${response.status} - ${errorText}`);
      }

      const { transaction: unsignedTx, tokenMint } = (await response.json()) as {
        transaction: string;
        tokenMint: string;
      };

      // Sign the transaction
      const signedTx = await wallet.signTransaction(unsignedTx);

      // Send the transaction
      let signature: string;
      if (this.transactionSender) {
        signature = await this.transactionSender(signedTx, this.rpcUrl);
      } else {
        const sendResponse = await fetch(this.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendTransaction",
            params: [signedTx, { encoding: "base64", skipPreflight: false }],
          }),
        });

        const result = (await sendResponse.json()) as {
          result?: string;
          error?: { message: string };
        };
        if (result.error) {
          throw new Error(result.error.message);
        }
        signature = result.result!;
      }

      this.logger.info(`[bags] Token launched: ${tokenMint} (tx: ${signature})`);

      // Log the transaction
      await this.db.insert(transactionLogTable).values({
        id: nanoid(),
        chatId,
        type: "token-launch",
        signature,
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: tokenMint,
        inputAmount: (params.initialBuySOL || 0).toString(),
        status: "pending",
        metadata: {
          name: params.name,
          symbol: params.symbol,
          feeClaimers,
          creatorBps,
        },
        createdAt: Date.now(),
      });

      return {
        success: true,
        signature,
        tokenMint,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[bags] Token launch failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async claimFees(
    chatId: number,
    tokenMint?: string
  ): Promise<FeeClaimResult> {
    this.logger.info(
      `[bags] Claiming fees for chatId ${chatId}${tokenMint ? ` (token: ${tokenMint})` : " (all)"}`
    );

    try {
      if (!this.config.apiKey) {
        return {
          success: false,
          error: "Bags API key not configured",
        };
      }

      if (!this.walletProvider) {
        return {
          success: false,
          error: "Wallet provider not configured",
        };
      }

      const wallet = await this.walletProvider(chatId);
      if (!wallet) {
        return {
          success: false,
          error: "No wallet found for user",
        };
      }

      // Get claimable fees from Bags API
      const claimRequest = {
        walletAddress: wallet.publicKey,
        tokenMint: tokenMint || undefined,
      };

      const response = await fetch(`${BAGS_API_BASE}/fees/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(claimRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bags API error: ${response.status} - ${errorText}`);
      }

      const { transaction: unsignedTx, amountClaimable } = (await response.json()) as {
        transaction: string;
        amountClaimable: number;
      };

      if (!unsignedTx || amountClaimable === 0) {
        return {
          success: true,
          amountClaimed: 0,
        };
      }

      // Sign the transaction
      const signedTx = await wallet.signTransaction(unsignedTx);

      // Send the transaction
      let signature: string;
      if (this.transactionSender) {
        signature = await this.transactionSender(signedTx, this.rpcUrl);
      } else {
        const sendResponse = await fetch(this.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendTransaction",
            params: [signedTx, { encoding: "base64", skipPreflight: false }],
          }),
        });

        const result = (await sendResponse.json()) as {
          result?: string;
          error?: { message: string };
        };
        if (result.error) {
          throw new Error(result.error.message);
        }
        signature = result.result!;
      }

      this.logger.info(`[bags] Fees claimed: ${amountClaimable} SOL (tx: ${signature})`);

      // Log the transaction
      await this.db.insert(transactionLogTable).values({
        id: nanoid(),
        chatId,
        type: "fee-claim",
        signature,
        inputMint: tokenMint || "all",
        outputMint: "So11111111111111111111111111111111111111112",
        inputAmount: "0",
        outputAmount: amountClaimable.toString(),
        status: "pending",
        createdAt: Date.now(),
      });

      return {
        success: true,
        signature,
        amountClaimed: amountClaimable,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[bags] Fee claim failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getClaimableFees(chatId: number): Promise<{
    total: number;
    byToken: Array<{ mint: string; amount: number }>;
  } | null> {
    try {
      if (!this.config.apiKey) {
        this.logger.warn("[bags] API key not configured");
        return null;
      }

      if (!this.walletProvider) {
        return null;
      }

      const wallet = await this.walletProvider(chatId);
      if (!wallet) {
        return null;
      }

      const response = await fetch(
        `${BAGS_API_BASE}/fees/claimable?wallet=${wallet.publicKey}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as {
        total: number;
        byToken: Array<{ mint: string; amount: number }>;
      };
    } catch (error) {
      this.logger.error(`[bags] Failed to get claimable fees: ${error}`);
      return null;
    }
  }

  async getTokenInfo(tokenMint: string): Promise<{
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    creator: string;
    supply: string;
    holders: number;
  } | null> {
    try {
      const response = await fetch(`${BAGS_API_BASE}/tokens/${tokenMint}`, {
        headers: this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {},
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as {
        name: string;
        symbol: string;
        description: string;
        imageUrl: string;
        creator: string;
        supply: string;
        holders: number;
      };
    } catch (error) {
      this.logger.error(`[bags] Failed to get token info: ${error}`);
      return null;
    }
  }
}
