/**
 * Clawdbot Wallet Adapter for Solana Agent Kit
 *
 * Implements the BaseWallet interface required by solana-agent-kit.
 * Supports multiple wallet modes:
 * - Local keypair (for server-side operations)
 * - Remote signing (for mobile wallet integration)
 * - Sign-only mode (returns unsigned transactions)
 */

import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  type SendOptions,
  type TransactionSignature,
  Connection,
} from "@solana/web3.js";
import bs58 from "bs58";
import { EventEmitter } from "node:events";

/**
 * Configuration for ClawdbotWallet
 */
export interface ClawdbotWalletConfig {
  /** Base58-encoded private key for local signing */
  privateKey?: string;
  /** Public key if using remote signing */
  publicKey?: string;
  /** RPC connection for sending transactions */
  connection: Connection;
  /** Remote signing callback */
  onSignRequest?: (request: SignRequest) => Promise<SignResponse>;
  /** Sign-only mode - don't broadcast */
  signOnly?: boolean;
}

/**
 * Request sent to remote wallet for signing
 */
export interface SignRequest {
  id: string;
  type: "transaction" | "message" | "allTransactions";
  payload: string; // Base64 encoded
  description?: string;
}

/**
 * Response from remote wallet
 */
export interface SignResponse {
  id: string;
  signature?: string;
  signedPayload?: string; // Base64 encoded signed transaction
  error?: string;
}

/**
 * Clawdbot wallet implementation compatible with Solana Agent Kit
 */
export class ClawdbotWallet extends EventEmitter {
  public readonly publicKey: PublicKey;
  private keypair?: Keypair;
  private connection: Connection;
  private onSignRequest?: (request: SignRequest) => Promise<SignResponse>;
  private signOnly: boolean;
  private pendingRequests = new Map<string, {
    resolve: (value: SignResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(config: ClawdbotWalletConfig) {
    super();
    this.connection = config.connection;
    this.onSignRequest = config.onSignRequest;
    this.signOnly = config.signOnly ?? false;

    if (config.privateKey) {
      // Local keypair mode
      const secretKey = bs58.decode(config.privateKey);
      this.keypair = Keypair.fromSecretKey(secretKey);
      this.publicKey = this.keypair.publicKey;
    } else if (config.publicKey) {
      // Remote signing mode
      this.publicKey = new PublicKey(config.publicKey);
    } else {
      throw new Error("Either privateKey or publicKey must be provided");
    }
  }

  /**
   * Check if wallet has local signing capability
   */
  get hasLocalSigning(): boolean {
    return !!this.keypair;
  }

  /**
   * Sign a single transaction
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T> {
    if (this.keypair) {
      // Local signing
      if (transaction instanceof VersionedTransaction) {
        transaction.sign([this.keypair]);
      } else {
        transaction.partialSign(this.keypair);
      }
      return transaction;
    }

    // Remote signing
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const payload = Buffer.from(serialized).toString("base64");

    const response = await this.requestRemoteSign({
      id: `sign_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: "transaction",
      payload,
    });

    if (response.error) {
      throw new Error(`Signing failed: ${response.error}`);
    }

    if (!response.signedPayload) {
      throw new Error("No signed payload returned");
    }

    const signedBytes = Buffer.from(response.signedPayload, "base64");
    if (transaction instanceof VersionedTransaction) {
      return VersionedTransaction.deserialize(signedBytes) as T;
    } else {
      return Transaction.from(signedBytes) as T;
    }
  }

  /**
   * Sign multiple transactions
   */
  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[],
  ): Promise<T[]> {
    if (this.keypair) {
      // Local signing
      for (const tx of transactions) {
        if (tx instanceof VersionedTransaction) {
          tx.sign([this.keypair]);
        } else {
          tx.partialSign(this.keypair);
        }
      }
      return transactions;
    }

    // Remote signing - batch request
    const serialized = transactions.map((tx) =>
      Buffer.from(
        tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
      ).toString("base64"),
    );

    const response = await this.requestRemoteSign({
      id: `signAll_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: "allTransactions",
      payload: JSON.stringify(serialized),
    });

    if (response.error) {
      throw new Error(`Signing failed: ${response.error}`);
    }

    if (!response.signedPayload) {
      throw new Error("No signed payload returned");
    }

    const signedPayloads: string[] = JSON.parse(response.signedPayload);
    return signedPayloads.map((payload, i) => {
      const bytes = Buffer.from(payload, "base64");
      if (transactions[i] instanceof VersionedTransaction) {
        return VersionedTransaction.deserialize(bytes) as T;
      } else {
        return Transaction.from(bytes) as T;
      }
    });
  }

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
    options?: SendOptions,
  ): Promise<{ signature: TransactionSignature }> {
    const signed = await this.signTransaction(transaction);

    if (this.signOnly) {
      // Return a placeholder signature for sign-only mode
      return { signature: "SIGN_ONLY_MODE" };
    }

    const signature = await this.connection.sendRawTransaction(
      signed.serialize(),
      {
        skipPreflight: options?.skipPreflight ?? false,
        preflightCommitment: options?.preflightCommitment ?? "confirmed",
        maxRetries: options?.maxRetries ?? 3,
      },
    );

    // Wait for confirmation
    const latestBlockhash = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    return { signature };
  }

  /**
   * Send a pre-signed transaction
   */
  async sendTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<string> {
    if (this.signOnly) {
      throw new Error("Cannot send transaction in sign-only mode");
    }

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
    );

    return signature;
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (this.keypair) {
      // Local signing using tweetnacl
      const { sign } = await import("tweetnacl");
      return sign.detached(message, this.keypair.secretKey);
    }

    // Remote signing
    const payload = Buffer.from(message).toString("base64");

    const response = await this.requestRemoteSign({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: "message",
      payload,
    });

    if (response.error) {
      throw new Error(`Message signing failed: ${response.error}`);
    }

    if (!response.signature) {
      throw new Error("No signature returned");
    }

    return Buffer.from(response.signature, "base64");
  }

  /**
   * Request remote signing (from mobile wallet)
   */
  private async requestRemoteSign(request: SignRequest): Promise<SignResponse> {
    if (!this.onSignRequest) {
      throw new Error(
        "Remote signing not configured. Provide onSignRequest callback or use local keypair.",
      );
    }

    // Emit event for tracking
    this.emit("signRequest", request);

    try {
      const response = await this.onSignRequest(request);
      this.emit("signResponse", response);
      return response;
    } catch (error) {
      const errorResponse: SignResponse = {
        id: request.id,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      this.emit("signResponse", errorResponse);
      throw error;
    }
  }

  /**
   * Handle incoming signed transaction from mobile
   * Used when mobile wallet sends back signed transaction
   */
  handleSignedTransaction(requestId: string, response: SignResponse): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(response);
    }
  }

  /**
   * Get wallet address as string
   */
  getAddress(): string {
    return this.publicKey.toBase58();
  }

  /**
   * Export public key as base58
   */
  toBase58(): string {
    return this.publicKey.toBase58();
  }
}

/**
 * Create a wallet from environment variables
 */
export function createWalletFromEnv(connection: Connection): ClawdbotWallet {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  const publicKey = process.env.SOLANA_PUBLIC_KEY;

  if (!privateKey && !publicKey) {
    throw new Error(
      "SOLANA_PRIVATE_KEY or SOLANA_PUBLIC_KEY environment variable required",
    );
  }

  return new ClawdbotWallet({
    privateKey,
    publicKey,
    connection,
    signOnly: process.env.SOLANA_SIGN_ONLY === "true",
  });
}
