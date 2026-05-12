import type { Database } from "../db/index.js";
import type { Logger, SniperTarget, TradeResult, ServiceContext } from "../types.js";
import { sniperConfigTable, transactionLogTable } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { JupiterService, getJupiterService } from "./jupiter-service.js";
import { nanoid } from "nanoid";

export interface SniperServiceConfig {
  enabled: boolean;
  defaultBuyAmount: number;
  defaultSlippage: number;
  maxConcurrentSnipes: number;
}

export type WalletProvider = (chatId: number) => Promise<{
  publicKey: string;
  signTransaction: (tx: string) => Promise<string>;
} | null>;

export type TransactionSender = (signedTx: string, rpcUrl: string) => Promise<string>;

export class SniperService {
  private db: Database;
  private config: SniperServiceConfig;
  private logger: Logger;
  private rpcUrl: string;
  private running = false;
  private activeSnipes = new Map<string, Promise<TradeResult>>();
  private jupiter: JupiterService;
  private walletProvider: WalletProvider | null = null;
  private transactionSender: TransactionSender | null = null;

  constructor(ctx: ServiceContext & { sniperConfig: SniperServiceConfig }) {
    this.db = ctx.db;
    this.config = ctx.sniperConfig;
    this.logger = ctx.logger;
    this.rpcUrl = ctx.rpcUrl;
    this.jupiter = getJupiterService(ctx.logger, {
      defaultSlippageBps: ctx.sniperConfig.defaultSlippage * 100,
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

    this.logger.info("[sniper] Starting sniper service...");
    this.logger.info("[sniper] Sniper service ready (waiting for launch events)");
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.activeSnipes.size > 0) {
      this.logger.info(`[sniper] Waiting for ${this.activeSnipes.size} active snipes...`);
      await Promise.allSettled(this.activeSnipes.values());
    }

    this.logger.info("[sniper] Sniper service stopped");
  }

  async handleNewLaunch(target: SniperTarget): Promise<void> {
    if (!this.running) return;

    if (this.activeSnipes.size >= this.config.maxConcurrentSnipes) {
      this.logger.info(`[sniper] Max concurrent snipes reached, skipping ${target.tokenMint}`);
      return;
    }

    const configs = await this.db
      .select()
      .from(sniperConfigTable)
      .where(eq(sniperConfigTable.enabled, true));

    for (const cfg of configs) {
      if (!this.passesFilters(target, cfg.filters)) {
        continue;
      }

      const snipePromise = this.executeSnipe(cfg.chatId, target, {
        buyAmount: parseFloat(cfg.buyAmount),
        slippage: cfg.slippage,
        maxBuyAmount: cfg.maxBuyAmount ? parseFloat(cfg.maxBuyAmount) : undefined,
      });

      this.activeSnipes.set(`${cfg.chatId}-${target.tokenMint}`, snipePromise);

      snipePromise.finally(() => {
        this.activeSnipes.delete(`${cfg.chatId}-${target.tokenMint}`);
      });
    }
  }

  private passesFilters(
    target: SniperTarget,
    filters?: {
      minLiquidity?: number;
      maxMarketCap?: number;
      requireSocials?: boolean;
      allowedDex?: string[];
    } | null
  ): boolean {
    if (!filters) return true;

    if (filters.minLiquidity && target.liquidity && target.liquidity < filters.minLiquidity) {
      return false;
    }

    if (filters.maxMarketCap && target.marketCap && target.marketCap > filters.maxMarketCap) {
      return false;
    }

    if (filters.allowedDex && !filters.allowedDex.includes(target.dex)) {
      return false;
    }

    return true;
  }

  private async executeSnipe(
    chatId: number,
    target: SniperTarget,
    params: { buyAmount: number; slippage: number; maxBuyAmount?: number }
  ): Promise<TradeResult> {
    const SOL_MINT = "So11111111111111111111111111111111111111112";

    this.logger.info(
      `[sniper] Executing snipe for chatId ${chatId}: ${target.tokenMint} with ${params.buyAmount} SOL`
    );

    try {
      // Check if wallet provider is configured
      if (!this.walletProvider) {
        return {
          success: false,
          inputMint: SOL_MINT,
          outputMint: target.tokenMint,
          inputAmount: params.buyAmount.toString(),
          error: "Wallet provider not configured",
        };
      }

      // Get user's wallet
      const wallet = await this.walletProvider(chatId);
      if (!wallet) {
        return {
          success: false,
          inputMint: SOL_MINT,
          outputMint: target.tokenMint,
          inputAmount: params.buyAmount.toString(),
          error: "No wallet found for user",
        };
      }

      // Build swap transaction via Jupiter
      const { swapTransaction, quote } = await this.jupiter.buildBuyTransaction(
        target.tokenMint,
        params.buyAmount,
        wallet.publicKey,
        params.slippage * 100 // Convert to basis points
      );

      this.logger.info(
        `[sniper] Got quote: ${params.buyAmount} SOL -> ~${quote.outAmount} ${target.tokenMint.slice(0, 8)}...`
      );

      // Sign the transaction
      const signedTx = await wallet.signTransaction(swapTransaction);

      // Send the transaction
      let signature: string;
      if (this.transactionSender) {
        signature = await this.transactionSender(signedTx, this.rpcUrl);
      } else {
        // Use fetch to send via RPC
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

      this.logger.info(`[sniper] Transaction sent: ${signature}`);

      // Log the transaction
      await this.db.insert(transactionLogTable).values({
        id: nanoid(),
        chatId,
        type: "snipe",
        signature,
        inputMint: SOL_MINT,
        outputMint: target.tokenMint,
        inputAmount: params.buyAmount.toString(),
        outputAmount: quote.outAmount,
        status: "pending",
        metadata: { dex: target.dex, poolId: target.poolId },
        createdAt: Date.now(),
      });

      return {
        success: true,
        signature,
        inputMint: SOL_MINT,
        outputMint: target.tokenMint,
        inputAmount: params.buyAmount.toString(),
        outputAmount: quote.outAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[sniper] Snipe failed for ${target.tokenMint}: ${errorMessage}`);

      return {
        success: false,
        inputMint: SOL_MINT,
        outputMint: target.tokenMint,
        inputAmount: params.buyAmount.toString(),
        error: errorMessage,
      };
    }
  }

  // Manual snipe trigger (for testing or direct calls)
  async snipeToken(
    chatId: number,
    tokenMint: string,
    solAmount: number,
    slippageBps?: number
  ): Promise<TradeResult> {
    const target: SniperTarget = {
      tokenMint,
      dex: "jupiter",
      timestamp: Date.now(),
    };

    return this.executeSnipe(chatId, target, {
      buyAmount: solAmount,
      slippage: slippageBps ? slippageBps / 100 : this.config.defaultSlippage,
    });
  }

  getActiveSnipeCount(): number {
    return this.activeSnipes.size;
  }
}
