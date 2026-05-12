/**
 * Bags.fm SDK Service for Clawdbot
 * Provides token launch, fee claiming, and trading on Bags.fm
 */

import bs58 from 'bs58';
import { nanoid } from 'nanoid';

import { BagsSDK } from '@bagsfm/bags-sdk';
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import type { Database } from '../db/index.js';
import { transactionLogTable } from '../db/schema.js';
import type {
  Logger,
  ServiceContext,
} from '../types.js';

export interface BagsSDKServiceConfig {
  apiKey: string;
  partnerConfigKey?: string;
  refCode?: string;
  rpcUrl: string;
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
}

export interface TokenLaunchResult {
  success: boolean;
  signature?: string;
  tokenMint?: string;
  metadataUrl?: string;
  error?: string;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  amountOut?: number;
  error?: string;
}

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  price?: number;
  marketCap?: number;
}

export class BagsSDKService {
  private db: Database;
  private config: BagsSDKServiceConfig;
  private logger: Logger;
  private connection: Connection;
  private sdk: BagsSDK;
  private walletKeypair: Keypair | null = null;

  constructor(ctx: ServiceContext & { bagsConfig: BagsSDKServiceConfig }) {
    this.db = ctx.db;
    this.config = ctx.bagsConfig;
    this.logger = ctx.logger;
    
    // Initialize Solana connection with Helius RPC
    this.connection = new Connection(ctx.bagsConfig.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    
    // Initialize Bags SDK
    this.sdk = new BagsSDK(
      ctx.bagsConfig.apiKey,
      this.connection,
      'confirmed'
    );
    
    this.logger.info('[bags-sdk] Service initialized with Helius RPC');
  }

  /**
   * Set the wallet keypair for signing transactions
   */
  setWallet(privateKey: string): void {
    try {
      // Support both base58 and array format
      if (privateKey.startsWith('[')) {
        const keyArray = JSON.parse(privateKey) as number[];
        this.walletKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
      } else {
        this.walletKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      }
      this.logger.info(`[bags-sdk] Wallet set: ${this.walletKeypair.publicKey.toBase58()}`);
    } catch (error) {
      this.logger.error(`[bags-sdk] Failed to set wallet: ${error}`);
      throw new Error('Invalid wallet private key format');
    }
  }

  /**
   * Get the wallet public key
   */
  getWalletPublicKey(): string | null {
    return this.walletKeypair?.publicKey.toBase58() ?? null;
  }

  /**
   * Launch a new token on Bags.fm
   */
  async launchToken(params: TokenLaunchParams): Promise<TokenLaunchResult> {
    this.logger.info(`[bags-sdk] Launching token: ${params.name} (${params.symbol})`);

    try {
      if (!this.walletKeypair) {
        return {
          success: false,
          error: 'Wallet not configured. Set SOLANA_TRADING_WALLET_PRIVATE env var.',
        };
      }

      // Step 1: Create token info and metadata using Bags API
      const tokenInfo = await this.sdk.tokenLaunch.createTokenInfoAndMetadata({
        name: params.name,
        symbol: params.symbol,
        description: params.description,
        imageUrl: params.imageUrl,
        twitter: params.twitterUrl,
        website: params.websiteUrl,
        telegram: params.telegramUrl,
      });

      this.logger.info(`[bags-sdk] Token info created: ${tokenInfo.tokenMetadata}`);

      // Step 2: Generate new token mint keypair
      const tokenMintKeypair = Keypair.generate();

      // Step 3: Get the config key to use (partner or default)
      const configKey = this.config.partnerConfigKey 
        ? new PublicKey(this.config.partnerConfigKey)
        : new PublicKey('7xt3NDPDtU6ud6mjxGYGbXwrstQ8uqMLEMt1E8mAdSqv'); // Default Bags config

      // Step 4: Create launch transaction
      const launchTransaction = await this.sdk.tokenLaunch.createLaunchTransaction({
        metadataUrl: tokenInfo.tokenMetadata,
        tokenMint: tokenMintKeypair.publicKey,
        launchWallet: this.walletKeypair.publicKey,
        initialBuyLamports: params.initialBuySOL ? Math.floor(params.initialBuySOL * 1e9) : 0,
        configKey,
      });

      // Step 5: Sign with both wallet and token mint
      launchTransaction.sign([this.walletKeypair, tokenMintKeypair]);

      // Step 6: Send transaction
      const signature = await this.connection.sendTransaction(launchTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      this.logger.info(`[bags-sdk] Token launched: ${tokenMintKeypair.publicKey.toBase58()} (tx: ${signature})`);

      // Log the transaction
      await this.db.insert(transactionLogTable).values({
        id: nanoid(),
        chatId: 0,
        type: 'bags-token-launch',
        signature,
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: tokenMintKeypair.publicKey.toBase58(),
        inputAmount: (params.initialBuySOL || 0).toString(),
        status: 'confirmed',
        metadata: {
          name: params.name,
          symbol: params.symbol,
          metadataUrl: tokenInfo.tokenMetadata,
        },
        createdAt: Date.now(),
      });

      return {
        success: true,
        signature,
        tokenMint: tokenMintKeypair.publicKey.toBase58(),
        metadataUrl: tokenInfo.tokenMetadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[bags-sdk] Token launch failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Buy tokens using Bags Trade API (Jupiter-powered)
   */
  async buyToken(tokenMint: string, solAmount: number, slippageBps: number = 500): Promise<SwapResult> {
    this.logger.info(`[bags-sdk] Buying ${tokenMint} for ${solAmount} SOL`);

    try {
      if (!this.walletKeypair) {
        return { success: false, error: 'Wallet not configured' };
      }

      const lamports = Math.floor(solAmount * 1e9);
      const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const outputMintPubkey = new PublicKey(tokenMint);

      // Get quote
      const quote = await this.sdk.trade.getQuote({
        inputMint: SOL_MINT,
        outputMint: outputMintPubkey,
        amount: lamports,
        slippageBps,
      });

      this.logger.info(`[bags-sdk] Quote: ${quote.outAmount} tokens for ${solAmount} SOL`);

      // Create swap transaction
      const swapResult = await this.sdk.trade.createSwapTransaction({
        quoteResponse: quote,
        userPublicKey: this.walletKeypair.publicKey,
      });

      // Sign transaction
      swapResult.transaction.sign([this.walletKeypair]);

      // Send transaction
      const signature = await this.connection.sendTransaction(swapResult.transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      await this.connection.confirmTransaction(signature, 'confirmed');

      // Log transaction
      await this.db.insert(transactionLogTable).values({
        id: nanoid(),
        chatId: 0,
        type: 'bags-buy',
        signature,
        inputMint: SOL_MINT.toBase58(),
        outputMint: tokenMint,
        inputAmount: solAmount.toString(),
        outputAmount: quote.outAmount,
        status: 'confirmed',
        createdAt: Date.now(),
      });

      return {
        success: true,
        signature,
        amountOut: Number(quote.outAmount) / 1e9,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[bags-sdk] Buy failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sell tokens using Bags Trade API (Jupiter-powered)
   */
  async sellToken(tokenMint: string, tokenAmount: number, slippageBps: number = 500): Promise<SwapResult> {
    this.logger.info(`[bags-sdk] Selling ${tokenAmount} of ${tokenMint}`);

    try {
      if (!this.walletKeypair) {
        return { success: false, error: 'Wallet not configured' };
      }

      const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const inputMintPubkey = new PublicKey(tokenMint);
      // Assume 9 decimals for the token (most common)
      const amountIn = Math.floor(tokenAmount * 1e9);

      // Get quote
      const quote = await this.sdk.trade.getQuote({
        inputMint: inputMintPubkey,
        outputMint: SOL_MINT,
        amount: amountIn,
        slippageBps,
      });

      this.logger.info(`[bags-sdk] Quote: ${quote.outAmount} lamports for ${tokenAmount} tokens`);

      // Create swap transaction
      const swapResult = await this.sdk.trade.createSwapTransaction({
        quoteResponse: quote,
        userPublicKey: this.walletKeypair.publicKey,
      });

      // Sign transaction
      swapResult.transaction.sign([this.walletKeypair]);

      // Send transaction
      const signature = await this.connection.sendTransaction(swapResult.transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      await this.connection.confirmTransaction(signature, 'confirmed');

      // Log transaction
      await this.db.insert(transactionLogTable).values({
        id: nanoid(),
        chatId: 0,
        type: 'bags-sell',
        signature,
        inputMint: tokenMint,
        outputMint: SOL_MINT.toBase58(),
        inputAmount: tokenAmount.toString(),
        outputAmount: quote.outAmount,
        status: 'confirmed',
        createdAt: Date.now(),
      });

      return {
        success: true,
        signature,
        amountOut: Number(quote.outAmount) / 1e9,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[bags-sdk] Sell failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get a swap quote without executing
   */
  async getSwapQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number = 500) {
    try {
      const inputMintPubkey = new PublicKey(inputMint);
      const outputMintPubkey = new PublicKey(outputMint);

      const quote = await this.sdk.trade.getQuote({
        inputMint: inputMintPubkey,
        outputMint: outputMintPubkey,
        amount: Math.floor(amount),
        slippageBps,
      });

      return {
        inputAmount: amount,
        outputAmount: Number(quote.outAmount),
        priceImpact: quote.priceImpactPct,
        route: quote.routePlan,
      };
    } catch (error) {
      this.logger.error(`[bags-sdk] Quote failed: ${error}`);
      return null;
    }
  }

  /**
   * Get wallet SOL balance
   */
  async getBalance(): Promise<number> {
    if (!this.walletKeypair) return 0;
    
    try {
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      return balance / 1e9;
    } catch (error) {
      this.logger.error(`[bags-sdk] Failed to get balance: ${error}`);
      return 0;
    }
  }

  /**
   * Get token balance for wallet
   */
  async getTokenBalance(tokenMint: string): Promise<number> {
    if (!this.walletKeypair) return 0;

    try {
      const mintPubkey = new PublicKey(tokenMint);
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        this.walletKeypair.publicKey,
        { mint: mintPubkey }
      );

      if (tokenAccounts.value.length === 0) return 0;

      const balance = await this.connection.getTokenAccountBalance(
        tokenAccounts.value[0].pubkey
      );

      return Number(balance.value.uiAmount || 0);
    } catch (error) {
      this.logger.error(`[bags-sdk] Failed to get token balance: ${error}`);
      return 0;
    }
  }
}
