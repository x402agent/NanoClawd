import type { Database } from "../db/index.js";
import type { Logger, TransactionEvent, TradeResult, ServiceContext } from "../types.js";
import { copyTradingConfigTable, transactionLogTable } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { JupiterService, getJupiterService } from "./jupiter-service.js";
import { nanoid } from "nanoid";

export interface CopyTradingServiceConfig {
  enabled: boolean;
  defaultMultiplier: number;
  maxTradeAmount?: number;
}

export type WalletProvider = (chatId: number) => Promise<{
  publicKey: string;
  signTransaction: (tx: string) => Promise<string>;
} | null>;

export type TransactionSender = (signedTx: string, rpcUrl: string) => Promise<string>;

export class CopyTradingService {
  private db: Database;
  private config: CopyTradingServiceConfig;
  private logger: Logger;
  private rpcUrl: string;
  private running = false;
  private sourceWallets = new Map<string, Set<number>>();
  private jupiter: JupiterService;
  private walletProvider: WalletProvider | null = null;
  private transactionSender: TransactionSender | null = null;
  private recentCopies = new Set<string>(); // Track recent copies to avoid duplicates

  constructor(ctx: ServiceContext & { copyConfig: CopyTradingServiceConfig }) {
    this.db = ctx.db;
    this.config = ctx.copyConfig;
    this.logger = ctx.logger;
    this.rpcUrl = ctx.rpcUrl;
    this.jupiter = getJupiterService(ctx.logger, {
      defaultSlippageBps: 200, // 2% default for copy trading
    });
  }

  setWalletProvider(provider: WalletProvider): void {
    this.walletProvider = provider;
  }

  setTransactionSender(sender: TransactionSender): void {
    this.transactionSender = sender;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.logger.info("[copy-trading] Starting copy trading service...");

    const configs = await this.db
      .select()
      .from(copyTradingConfigTable)
      .where(eq(copyTradingConfigTable.enabled, true));

    for (const cfg of configs) {
      if (!this.sourceWallets.has(cfg.sourceWallet)) {
        this.sourceWallets.set(cfg.sourceWallet, new Set());
      }
      this.sourceWallets.get(cfg.sourceWallet)!.add(cfg.chatId);
    }

    this.logger.info(
      `[copy-trading] Monitoring ${this.sourceWallets.size} source wallets for ${configs.length} users`
    );
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    this.sourceWallets.clear();
    this.recentCopies.clear();
    this.logger.info("[copy-trading] Copy trading service stopped");
  }

  // Called when a transaction is detected on a monitored wallet
  async handleSourceTransaction(event: TransactionEvent): Promise<void> {
    if (!this.running) return;

    const subscribers = this.sourceWallets.get(event.walletAddress);
    if (!subscribers || subscribers.size === 0) return;

    // Only copy swaps
    if (event.type !== "swap") return;

    // Deduplication: check if we've recently copied this transaction
    const dedupeKey = `${event.signature}`;
    if (this.recentCopies.has(dedupeKey)) {
      return;
    }
    this.recentCopies.add(dedupeKey);

    // Clean up old entries after 1 minute
    setTimeout(() => this.recentCopies.delete(dedupeKey), 60000);

    this.logger.info(
      `[copy-trading] Detected swap from ${event.walletAddress.slice(0, 8)}...: ${event.signature}`
    );

    // Execute copy trades for all subscribers (in parallel)
    const copyPromises = Array.from(subscribers).map((chatId) =>
      this.executeCopyTrade(chatId, event).catch((err) => {
        this.logger.error(`[copy-trading] Copy trade failed for chatId ${chatId}: ${err}`);
        return null;
      })
    );

    await Promise.all(copyPromises);
  }

  private async executeCopyTrade(
    chatId: number,
    event: TransactionEvent
  ): Promise<TradeResult | null> {
    const SOL_MINT = "So11111111111111111111111111111111111111112";

    // Get user's copy trading config for this specific source wallet
    const configs = await this.db
      .select()
      .from(copyTradingConfigTable)
      .where(
        and(
          eq(copyTradingConfigTable.chatId, chatId),
          eq(copyTradingConfigTable.sourceWallet, event.walletAddress)
        )
      )
      .limit(1);

    if (configs.length === 0 || !configs[0].enabled) {
      return null;
    }

    const cfg = configs[0];
    const multiplier = parseFloat(cfg.multiplier);
    const maxTradeAmount = cfg.maxTradeAmount ? parseFloat(cfg.maxTradeAmount) : undefined;

    // Calculate trade amount based on source transaction
    const sourceAmount = parseFloat(event.inputAmount || "0");
    let tradeAmount = sourceAmount * multiplier;

    // Apply max trade amount limit
    if (maxTradeAmount && tradeAmount > maxTradeAmount) {
      tradeAmount = maxTradeAmount;
    }

    // Check filters
    if (cfg.filters) {
      const filters = cfg.filters as {
        allowedDex?: string[];
        minAmount?: string;
        maxAmount?: string;
        tokenAllowlist?: string[];
      };

      if (filters.minAmount && tradeAmount < parseFloat(filters.minAmount)) {
        this.logger.info(
          `[copy-trading] Trade amount ${tradeAmount} below minimum ${filters.minAmount}, skipping`
        );
        return null;
      }

      if (filters.maxAmount && tradeAmount > parseFloat(filters.maxAmount)) {
        tradeAmount = parseFloat(filters.maxAmount);
      }

      if (
        filters.tokenAllowlist &&
        event.outputMint &&
        !filters.tokenAllowlist.includes(event.outputMint)
      ) {
        this.logger.info(
          `[copy-trading] Token ${event.outputMint} not in allowlist, skipping`
        );
        return null;
      }
    }

    // Determine trade direction
    const inputMint = event.inputMint || SOL_MINT;
    const outputMint = event.outputMint || "";

    if (!outputMint) {
      this.logger.warn("[copy-trading] No output mint in source transaction, skipping");
      return null;
    }

    this.logger.info(
      `[copy-trading] Copying trade for chatId ${chatId}: ${tradeAmount.toFixed(4)} ${inputMint.slice(0, 8)}... -> ${outputMint.slice(0, 8)}...`
    );

    try {
      if (!this.walletProvider) {
        return {
          success: false,
          inputMint,
          outputMint,
          inputAmount: tradeAmount.toString(),
          error: "Wallet provider not configured",
        };
      }

      const wallet = await this.walletProvider(chatId);
      if (!wallet) {
        return {
          success: false,
          inputMint,
          outputMint,
          inputAmount: tradeAmount.toString(),
          error: "No wallet found for user",
        };
      }

      // Build the same swap with adjusted amount
      let swapTransaction: string;
      let quote: { outAmount: string };

      if (inputMint === SOL_MINT) {
        // Buying token with SOL
        const result = await this.jupiter.buildBuyTransaction(
          outputMint,
          tradeAmount,
          wallet.publicKey
        );
        swapTransaction = result.swapTransaction;
        quote = result.quote;
      } else if (outputMint === SOL_MINT) {
        // Selling token for SOL
        const result = await this.jupiter.buildSellTransaction(
          inputMint,
          Math.floor(tradeAmount).toString(), // Token amount
          wallet.publicKey
        );
        swapTransaction = result.swapTransaction;
        quote = result.quote;
      } else {
        // Token to token swap via SOL
        // For simplicity, we'll swap input to SOL, then SOL to output
        // In production, you might want a direct route
        const sellResult = await this.jupiter.buildSellTransaction(
          inputMint,
          Math.floor(tradeAmount).toString(),
          wallet.publicKey
        );
        swapTransaction = sellResult.swapTransaction;
        quote = sellResult.quote;
      }

      // Sign the transaction
      const signedTx = await wallet.signTransaction(swapTransaction);

      // Send the transaction
      let signature: string;
      if (this.transactionSender) {
        signature = await this.transactionSender(signedTx, this.rpcUrl);
      } else {
        const response = await fetch(this.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendTransaction",
            params: [signedTx, { encoding: "base64", skipPreflight: false }],
          }),
        });

        const result = (await response.json()) as { result?: string; error?: { message: string } };
        if (result.error) {
          throw new Error(result.error.message);
        }
        signature = result.result!;
      }

      this.logger.info(`[copy-trading] Copy trade sent: ${signature}`);

      // Log the transaction
      await this.db.insert(transactionLogTable).values({
        id: nanoid(),
        chatId,
        type: "copy",
        signature,
        inputMint,
        outputMint,
        inputAmount: tradeAmount.toString(),
        outputAmount: quote.outAmount,
        status: "pending",
        metadata: {
          sourceWallet: event.walletAddress,
          sourceSignature: event.signature,
          multiplier,
        },
        createdAt: Date.now(),
      });

      return {
        success: true,
        signature,
        inputMint,
        outputMint,
        inputAmount: tradeAmount.toString(),
        outputAmount: quote.outAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[copy-trading] Copy trade failed: ${errorMessage}`);

      return {
        success: false,
        inputMint,
        outputMint,
        inputAmount: tradeAmount.toString(),
        error: errorMessage,
      };
    }
  }

  async enableForChat(chatId: number, sourceWallet: string): Promise<void> {
    if (!this.sourceWallets.has(sourceWallet)) {
      this.sourceWallets.set(sourceWallet, new Set());
    }
    this.sourceWallets.get(sourceWallet)!.add(chatId);
    this.logger.info(`[copy-trading] Enabled copy trading for chatId ${chatId} from ${sourceWallet.slice(0, 8)}...`);
  }

  async disableForChat(chatId: number, sourceWallet: string): Promise<void> {
    const subs = this.sourceWallets.get(sourceWallet);
    if (subs) {
      subs.delete(chatId);
      if (subs.size === 0) {
        this.sourceWallets.delete(sourceWallet);
      }
      this.logger.info(`[copy-trading] Disabled copy trading for chatId ${chatId} from ${sourceWallet.slice(0, 8)}...`);
    }
  }

  getMonitoredWallets(): string[] {
    return Array.from(this.sourceWallets.keys());
  }

  getSubscriberCount(sourceWallet: string): number {
    return this.sourceWallets.get(sourceWallet)?.size ?? 0;
  }
}
