import type { Database } from "../db/index.js";
import type { Logger, TransactionEvent, ServiceContext } from "../types.js";
import { trackedWalletsTable } from "../db/schema.js";
import WebSocket from "ws";

export interface WalletTrackerConfig {
  heliusApiKey?: string;
  webhookUrl?: string;
  maxTrackedWallets?: number;
}

// Helius Enhanced WebSocket payload types
interface HeliusWebhookPayload {
  signature: string;
  slot: number;
  timestamp: number;
  fee: number;
  feePayer: string;
  type: string;
  source: string;
  description: string;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard: string;
  }>;
  accountData: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: Array<{
      userAccount: string;
      tokenAccount: string;
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
    }>;
  }>;
  events: {
    swap?: {
      nativeInput?: { account: string; amount: string };
      nativeOutput?: { account: string; amount: string };
      tokenInputs: Array<{
        userAccount: string;
        tokenAccount: string;
        mint: string;
        rawTokenAmount: { tokenAmount: string; decimals: number };
      }>;
      tokenOutputs: Array<{
        userAccount: string;
        tokenAccount: string;
        mint: string;
        rawTokenAmount: { tokenAmount: string; decimals: number };
      }>;
    };
  };
}

export type TransactionCallback = (event: TransactionEvent) => Promise<void>;

export class WalletTrackerService {
  private db: Database;
  private config: WalletTrackerConfig;
  private logger: Logger;
  private subscribers = new Map<string, Set<number>>(); // walletAddress -> chatIds
  private running = false;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private transactionCallback: TransactionCallback | null = null;

  constructor(ctx: ServiceContext & { trackerConfig: WalletTrackerConfig }) {
    this.db = ctx.db;
    this.config = ctx.trackerConfig;
    this.logger = ctx.logger;
  }

  setTransactionCallback(callback: TransactionCallback): void {
    this.transactionCallback = callback;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.logger.info("[wallet-tracker] Starting wallet tracker service...");

    // Load tracked wallets from database
    await this.loadTrackedWallets();

    // Set up Helius Enhanced WebSocket connection
    if (this.config.heliusApiKey) {
      await this.setupHeliusWebSocket();
    } else {
      this.logger.warn("[wallet-tracker] No Helius API key configured, skipping WebSocket setup");
    }

    this.logger.info(
      `[wallet-tracker] Tracking ${this.subscribers.size} unique wallet addresses`
    );
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribers.clear();
    this.logger.info("[wallet-tracker] Wallet tracker service stopped");
  }

  private async loadTrackedWallets(): Promise<void> {
    const wallets = await this.db.select().from(trackedWalletsTable);

    for (const wallet of wallets) {
      if (!this.subscribers.has(wallet.walletAddress)) {
        this.subscribers.set(wallet.walletAddress, new Set());
      }
      this.subscribers.get(wallet.walletAddress)!.add(wallet.chatId);
    }
  }

  private async setupHeliusWebSocket(): Promise<void> {
    const wsUrl = `wss://atlas-mainnet.helius-rpc.com/?api-key=${this.config.heliusApiKey}`;

    this.logger.info("[wallet-tracker] Connecting to Helius Enhanced WebSocket...");

    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      this.logger.info("[wallet-tracker] Helius WebSocket connected");
      this.reconnectAttempts = 0;

      // Subscribe to account changes for all tracked wallets
      this.subscribeToTrackedWallets();
    });

    this.ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        this.logger.error(`[wallet-tracker] Failed to parse WebSocket message: ${error}`);
      }
    });

    this.ws.on("error", (error: any) => {
      this.logger.error(`[wallet-tracker] WebSocket error: ${error.message}`);
      if (error.message?.includes("403")) {
        this.logger.error("[wallet-tracker] Helius API key unauthorized (403). Disabling auto-reconnect.");
        this.running = false;
      }
    });

    this.ws.on("close", () => {
      this.logger.warn("[wallet-tracker] WebSocket disconnected");
      if (this.running) {
        this.attemptReconnect();
      }
    });
  }

  private subscribeToTrackedWallets(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const addresses = Array.from(this.subscribers.keys());
    if (addresses.length === 0) {
      this.logger.info("[wallet-tracker] No wallets to track");
      return;
    }

    // Subscribe to account notifications for each tracked wallet
    let subscriptionId = 1;
    for (const address of addresses) {
      const subscribeMsg = {
        jsonrpc: "2.0",
        id: subscriptionId++,
        method: "accountSubscribe",
        params: [address, { commitment: "confirmed", encoding: "jsonParsed" }],
      };
      this.ws.send(JSON.stringify(subscribeMsg));
    }

    // Also subscribe to logs for program interactions
    const logsMsg = {
      jsonrpc: "2.0",
      id: subscriptionId++,
      method: "logsSubscribe",
      params: [
        { mentions: addresses },
        { commitment: "confirmed" },
      ],
    };
    this.ws.send(JSON.stringify(logsMsg));

    this.logger.info(`[wallet-tracker] Subscribed to ${addresses.length} wallet addresses`);
  }

  private handleWebSocketMessage(message: unknown): void {
    const msg = message as { method?: string; params?: { result?: { signature?: string; value?: unknown } } };

    if (msg.method === "accountNotification" || msg.method === "logsNotification") {
      const result = msg.params?.result;
      if (result?.signature) {
        // Fetch enhanced transaction details
        this.fetchEnhancedTransaction(result.signature);
      }
    }
  }

  private async fetchEnhancedTransaction(signature: string): Promise<void> {
    if (!this.config.heliusApiKey) return;

    try {
      const response = await fetch(
        `https://api.helius.xyz/v0/transactions/?api-key=${this.config.heliusApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: [signature] }),
        }
      );

      if (!response.ok) {
        this.logger.error(`[wallet-tracker] Failed to fetch transaction: ${response.status}`);
        return;
      }

      const transactions = (await response.json()) as HeliusWebhookPayload[];
      if (transactions.length > 0) {
        const tx = transactions[0];
        await this.processTransaction(tx);
      }
    } catch (error) {
      this.logger.error(`[wallet-tracker] Error fetching transaction: ${error}`);
    }
  }

  private async processTransaction(tx: HeliusWebhookPayload): Promise<void> {
    // Determine which tracked wallet this transaction belongs to
    const involvedAddresses = new Set<string>();

    // Add fee payer
    involvedAddresses.add(tx.feePayer);

    // Add accounts from native transfers
    for (const transfer of tx.nativeTransfers) {
      involvedAddresses.add(transfer.fromUserAccount);
      involvedAddresses.add(transfer.toUserAccount);
    }

    // Add accounts from token transfers
    for (const transfer of tx.tokenTransfers) {
      involvedAddresses.add(transfer.fromUserAccount);
      involvedAddresses.add(transfer.toUserAccount);
    }

    // Find tracked wallets in this transaction
    for (const address of involvedAddresses) {
      const subs = this.subscribers.get(address);
      if (!subs || subs.size === 0) continue;

      // Convert to TransactionEvent
      const event = this.convertToTransactionEvent(tx, address);

      // Call the transaction callback if set
      if (this.transactionCallback) {
        await this.transactionCallback(event);
      }

      // Also call handleTransaction for subscribers
      await this.handleTransaction(event);
    }
  }

  private convertToTransactionEvent(tx: HeliusWebhookPayload, walletAddress: string): TransactionEvent {
    let type: TransactionEvent["type"] = "unknown";
    let inputMint: string | undefined;
    let outputMint: string | undefined;
    let inputAmount: string | undefined;
    let outputAmount: string | undefined;

    // Determine type from Helius type field
    const txType = tx.type.toLowerCase();
    if (txType === "swap" || txType.includes("swap")) {
      type = "swap";

      // Extract swap details from events
      if (tx.events.swap) {
        const swap = tx.events.swap;

        if (swap.nativeInput) {
          inputMint = "So11111111111111111111111111111111111111112"; // SOL
          inputAmount = swap.nativeInput.amount;
        } else if (swap.tokenInputs.length > 0) {
          inputMint = swap.tokenInputs[0].mint;
          inputAmount = swap.tokenInputs[0].rawTokenAmount.tokenAmount;
        }

        if (swap.nativeOutput) {
          outputMint = "So11111111111111111111111111111111111111112"; // SOL
          outputAmount = swap.nativeOutput.amount;
        } else if (swap.tokenOutputs.length > 0) {
          outputMint = swap.tokenOutputs[0].mint;
          outputAmount = swap.tokenOutputs[0].rawTokenAmount.tokenAmount;
        }
      }
    } else if (txType === "transfer" || txType.includes("transfer")) {
      type = "transfer";
    } else if (txType === "mint" || txType.includes("mint")) {
      type = "mint";
    } else if (txType === "burn" || txType.includes("burn")) {
      type = "burn";
    }

    return {
      signature: tx.signature,
      walletAddress,
      type,
      inputMint,
      outputMint,
      inputAmount,
      outputAmount,
      timestamp: tx.timestamp,
      programId: tx.source,
      raw: tx,
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error("[wallet-tracker] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.info(
      `[wallet-tracker] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (this.running) {
        this.setupHeliusWebSocket();
      }
    }, delay);
  }

  async addWallet(chatId: number, walletAddress: string): Promise<void> {
    const isNew = !this.subscribers.has(walletAddress);

    if (isNew) {
      this.subscribers.set(walletAddress, new Set());
    }
    this.subscribers.get(walletAddress)!.add(chatId);

    // Subscribe to the new wallet if WebSocket is connected
    if (isNew && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMsg = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "accountSubscribe",
        params: [walletAddress, { commitment: "confirmed", encoding: "jsonParsed" }],
      };
      this.ws.send(JSON.stringify(subscribeMsg));
      this.logger.info(`[wallet-tracker] Subscribed to new wallet: ${walletAddress}`);
    }
  }

  async removeWallet(chatId: number, walletAddress: string): Promise<void> {
    const subs = this.subscribers.get(walletAddress);
    if (subs) {
      subs.delete(chatId);
      if (subs.size === 0) {
        this.subscribers.delete(walletAddress);
        this.logger.info(`[wallet-tracker] Removed wallet from tracking: ${walletAddress}`);
      }
    }
  }

  // Called when a transaction is detected
  async handleTransaction(event: TransactionEvent): Promise<void> {
    const subs = this.subscribers.get(event.walletAddress);
    if (!subs || subs.size === 0) return;

    // Log transaction for all subscribers
    for (const chatId of subs) {
      this.logger.info(
        `[wallet-tracker] ${event.type} detected for chatId ${chatId}: ${event.signature} ` +
        `(wallet: ${event.walletAddress.slice(0, 8)}...)`
      );
    }
  }

  getTrackedAddresses(): string[] {
    return Array.from(this.subscribers.keys());
  }

  getSubscriberCount(walletAddress: string): number {
    return this.subscribers.get(walletAddress)?.size ?? 0;
  }

  getSubscribersForWallet(walletAddress: string): number[] {
    const subs = this.subscribers.get(walletAddress);
    return subs ? Array.from(subs) : [];
  }
}
