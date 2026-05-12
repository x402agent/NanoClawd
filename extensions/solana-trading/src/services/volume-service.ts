import type { Database } from "../db/index.js";
import type { Logger, TradeResult, ServiceContext } from "../types.js";
import { volumeBotConfigTable, transactionLogTable } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { JupiterService, getJupiterService } from "./jupiter-service.js";
import { nanoid } from "nanoid";

export interface VolumeBotServiceConfig {
  enabled: boolean;
  defaultInterval: number;
  maxWallets: number;
}

export type WalletProvider = (chatId: number) => Promise<{
  publicKey: string;
  signTransaction: (tx: string) => Promise<string>;
} | null>;

export type TransactionSender = (signedTx: string, rpcUrl: string) => Promise<string>;

export class VolumeBotService {
  private db: Database;
  private config: VolumeBotServiceConfig;
  private logger: Logger;
  private rpcUrl: string;
  private running = false;
  private intervals = new Map<number, NodeJS.Timeout>();
  private jupiter: JupiterService;
  private walletProvider: WalletProvider | null = null;
  private transactionSender: TransactionSender | null = null;
  private lastTradeDirection = new Map<number, "buy" | "sell">(); // Track last trade direction per chat

  constructor(ctx: ServiceContext & { volumeConfig: VolumeBotServiceConfig }) {
    this.db = ctx.db;
    this.config = ctx.volumeConfig;
    this.logger = ctx.logger;
    this.rpcUrl = ctx.rpcUrl;
    this.jupiter = getJupiterService(ctx.logger, {
      defaultSlippageBps: 300, // 3% default for volume trades
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

    this.logger.info("[volume-bot] Starting volume bot service...");

    const configs = await this.db
      .select()
      .from(volumeBotConfigTable)
      .where(eq(volumeBotConfigTable.enabled, true));

    for (const cfg of configs) {
      this.startVolumeGeneration(cfg.chatId, cfg);
    }

    this.logger.info(`[volume-bot] Started ${configs.length} volume generation tasks`);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();

    this.logger.info("[volume-bot] Volume bot service stopped");
  }

  private startVolumeGeneration(
    chatId: number,
    config: {
      tokenMint: string;
      poolId: string;
      buyMin: string;
      buyMax: string;
      interval: number;
      walletNum: number;
    }
  ): void {
    if (this.intervals.has(chatId)) {
      clearInterval(this.intervals.get(chatId)!);
    }

    const intervalMs = config.interval * 1000;

    const interval = setInterval(async () => {
      if (!this.running) return;

      await this.executeVolumeTrade(chatId, config);
    }, intervalMs);

    this.intervals.set(chatId, interval);

    this.logger.info(
      `[volume-bot] Started volume generation for chatId ${chatId}: ${config.tokenMint} every ${config.interval}s`
    );
  }

  private async executeVolumeTrade(
    chatId: number,
    config: {
      tokenMint: string;
      poolId: string;
      buyMin: string;
      buyMax: string;
      walletNum: number;
    }
  ): Promise<TradeResult> {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const buyMin = parseFloat(config.buyMin);
    const buyMax = parseFloat(config.buyMax);
    const amount = buyMin + Math.random() * (buyMax - buyMin);

    // Alternate between buy and sell for natural volume
    const lastDirection = this.lastTradeDirection.get(chatId) || "sell";
    const direction = lastDirection === "buy" ? "sell" : "buy";
    this.lastTradeDirection.set(chatId, direction);

    this.logger.info(
      `[volume-bot] Executing ${direction} for chatId ${chatId}: ${amount.toFixed(4)} SOL worth`
    );

    try {
      if (!this.walletProvider) {
        return {
          success: false,
          inputMint: SOL_MINT,
          outputMint: config.tokenMint,
          inputAmount: amount.toString(),
          error: "Wallet provider not configured",
        };
      }

      const wallet = await this.walletProvider(chatId);
      if (!wallet) {
        return {
          success: false,
          inputMint: SOL_MINT,
          outputMint: config.tokenMint,
          inputAmount: amount.toString(),
          error: "No wallet found for user",
        };
      }

      let swapTransaction: string;
      let quote: { outAmount: string };
      let inputMint: string;
      let outputMint: string;

      if (direction === "buy") {
        // Buy: SOL -> Token
        const result = await this.jupiter.buildBuyTransaction(
          config.tokenMint,
          amount,
          wallet.publicKey
        );
        swapTransaction = result.swapTransaction;
        quote = result.quote;
        inputMint = SOL_MINT;
        outputMint = config.tokenMint;
      } else {
        // Sell: Token -> SOL
        // For sell, we need to estimate token amount from SOL value
        // First get a quote to see exchange rate
        const buyQuote = await this.jupiter.getQuote({
          inputMint: SOL_MINT,
          outputMint: config.tokenMint,
          amount: Math.floor(amount * 1e9).toString(),
          slippageBps: 300,
        });

        // Use the output amount as our sell input
        const result = await this.jupiter.buildSellTransaction(
          config.tokenMint,
          buyQuote.outAmount,
          wallet.publicKey
        );
        swapTransaction = result.swapTransaction;
        quote = result.quote;
        inputMint = config.tokenMint;
        outputMint = SOL_MINT;
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

      this.logger.info(`[volume-bot] ${direction} transaction sent: ${signature}`);

      // Log the transaction
      await this.db.insert(transactionLogTable).values({
        id: nanoid(),
        chatId,
        type: `volume-${direction}`,
        signature,
        inputMint,
        outputMint,
        inputAmount: amount.toString(),
        outputAmount: quote.outAmount,
        status: "pending",
        metadata: { poolId: config.poolId },
        createdAt: Date.now(),
      });

      return {
        success: true,
        signature,
        inputMint,
        outputMint,
        inputAmount: amount.toString(),
        outputAmount: quote.outAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[volume-bot] Trade failed: ${errorMessage}`);

      return {
        success: false,
        inputMint: SOL_MINT,
        outputMint: config.tokenMint,
        inputAmount: amount.toString(),
        error: errorMessage,
      };
    }
  }

  async enableForChat(chatId: number): Promise<void> {
    const config = await this.db
      .select()
      .from(volumeBotConfigTable)
      .where(eq(volumeBotConfigTable.chatId, chatId))
      .limit(1);

    if (config.length > 0 && config[0].enabled) {
      this.startVolumeGeneration(chatId, config[0]);
    }
  }

  async disableForChat(chatId: number): Promise<void> {
    if (this.intervals.has(chatId)) {
      clearInterval(this.intervals.get(chatId)!);
      this.intervals.delete(chatId);
      this.logger.info(`[volume-bot] Stopped volume generation for chatId ${chatId}`);
    }
  }

  getActiveTaskCount(): number {
    return this.intervals.size;
  }
}
