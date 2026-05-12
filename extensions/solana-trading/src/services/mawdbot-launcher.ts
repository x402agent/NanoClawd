/**
 * MawdBot Bags Launcher - Complete Autonomous Token Launch System
 * Full implementation using @bagsfm/bags-sdk with:
 * - Fee Share V2 with config creation
 * - Jito bundle support with dynamic tip pricing
 * - Partner operations
 * - Fee claiming
 * - Analytics
 * - Exponential backoff retry logic
 */

import bs58 from 'bs58';

import type {
  CreateTokenInfoParams,
  SupportedSocialProvider,
} from '@bagsfm/bags-sdk';
import {
  BagsSDK,
  createTipTransaction,
  sendBundleAndConfirm,
  signAndSendTransaction,
  waitForSlotsToPass,
} from '@bagsfm/bags-sdk';
import {
  type Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';

import type { Logger } from '../types.js';

// Constants from Bags API
const BAGS_FEE_SHARE_V2_MAX_CLAIMERS_NON_LUT = 15;

// ============================================================
// Configuration
// ============================================================

export interface MawdBotConfig {
  bagsApiKey: string;
  solanaRpcUrl: string;
  privateKey: string;
  commitment: Commitment;
  defaultTipLamports: number;
  enableJitoBundles: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export function loadMawdBotConfig(): MawdBotConfig {
  const bagsApiKey = process.env.BAGS_API_KEY;
  const solanaRpcUrl = process.env.HELIUS_MAINNET_URL 
    || process.env.SOLANA_RPC_URL 
    || process.env.RPC_URL;
  const privateKey = process.env.SOLANA_TRADING_WALLET_PRIVATE 
    || process.env.PRIVATE_KEY;

  if (!bagsApiKey || !solanaRpcUrl || !privateKey) {
    throw new Error(
      'Missing required env vars: BAGS_API_KEY, HELIUS_MAINNET_URL/SOLANA_RPC_URL, SOLANA_TRADING_WALLET_PRIVATE'
    );
  }

  return {
    bagsApiKey,
    solanaRpcUrl,
    privateKey,
    commitment: (process.env.COMMITMENT as Commitment) || 'processed',
    defaultTipLamports: Number(process.env.TIP_LAMPORTS) || 0.015 * LAMPORTS_PER_SOL,
    enableJitoBundles: process.env.ENABLE_JITO_BUNDLES !== 'false',
    maxRetries: Number(process.env.MAX_RETRIES) || 3,
    retryDelayMs: Number(process.env.RETRY_DELAY_MS) || 2000,
  };
}

// ============================================================
// Token Launch Parameters
// ============================================================

export interface TokenLaunchParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
  imagePath?: string; // local file path alternative
  twitterUrl?: string;
  websiteUrl?: string;
  telegramUrl?: string;
  initialBuyAmountSol: number;
  feeClaimers?: Array<{
    provider: SupportedSocialProvider;
    username: string;
    bps: number;
  }>;
  partner?: {
    wallet: string;
    configPda: string;
  };
  tipConfig?: {
    tipWallet: string;
    tipLamports: number;
  };
}

export interface LaunchResult {
  tokenMint: string;
  metadataUri: string;
  configKey: string;
  launchSignature: string;
  tokenUrl: string;
}

// ============================================================
// MawdBot Launcher Class
// ============================================================

export class MawdBotLauncher {
  private sdk: BagsSDK;
  private connection: Connection;
  private keypair: Keypair;
  private config: MawdBotConfig;
  private logger?: Logger;

  constructor(config?: MawdBotConfig, logger?: Logger) {
    this.config = config || loadMawdBotConfig();
    this.logger = logger;
    this.connection = new Connection(this.config.solanaRpcUrl);
    this.sdk = new BagsSDK(
      this.config.bagsApiKey,
      this.connection,
      this.config.commitment
    );
    
    // Parse private key (support both base58 and array format)
    if (this.config.privateKey.startsWith('[')) {
      const keyArray = JSON.parse(this.config.privateKey) as number[];
      this.keypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
    } else {
      this.keypair = Keypair.fromSecretKey(bs58.decode(this.config.privateKey));
    }
  }

  get walletAddress(): string {
    return this.keypair.publicKey.toBase58();
  }

  private log(message: string): void {
    if (this.logger) {
      this.logger.info(`[mawdbot] ${message}`);
    } else {
      console.log(message);
    }
  }

  private warn(message: string): void {
    if (this.logger) {
      this.logger.warn(`[mawdbot] ${message}`);
    } else {
      console.warn(message);
    }
  }

  // -------------------------------------------------------
  // Core: Autonomous Token Launch
  // -------------------------------------------------------

  async launchToken(params: TokenLaunchParams): Promise<LaunchResult> {
    const startTime = Date.now();
    this.log(`🤖 MawdBot launching $${params.symbol}...`);
    this.log(`   Wallet: ${this.walletAddress}`);

    // Step 1: Create token info and metadata
    this.log('📝 Step 1/5: Creating token info and metadata...');
    const tokenInfo = await this.retryWithBackoff(() =>
      this.createTokenMetadata(params)
    );
    this.log(`   ✅ Token mint: ${tokenInfo.tokenMint}`);
    this.log(`   ✅ Metadata URI: ${tokenInfo.tokenMetadata}`);

    const tokenMint = new PublicKey(tokenInfo.tokenMint);

    // Step 2: Build fee claimers
    this.log('⚙️  Step 2/5: Building fee share configuration...');
    const feeClaimers = await this.buildFeeClaimers(params);

    // Step 3: Create fee share config
    this.log('🔧 Step 3/5: Creating on-chain fee share config...');
    const configKey = await this.retryWithBackoff(() =>
      this.createFeeShareConfig(tokenMint, feeClaimers, params.partner)
    );
    this.log(`   ✅ Config key: ${configKey.toBase58()}`);

    // Step 4: Get launch transaction
    this.log('🚀 Step 4/5: Creating launch transaction...');
    const launchTx = await this.retryWithBackoff(() =>
      this.sdk.tokenLaunch.createLaunchTransaction({
        metadataUrl: tokenInfo.tokenMetadata,
        tokenMint: tokenMint,
        launchWallet: this.keypair.publicKey,
        initialBuyLamports: Math.floor(
          params.initialBuyAmountSol * LAMPORTS_PER_SOL
        ),
        configKey: configKey,
        tipConfig: params.tipConfig
          ? {
              tipWallet: new PublicKey(params.tipConfig.tipWallet),
              tipLamports: params.tipConfig.tipLamports,
            }
          : undefined,
      })
    );

    // Step 5: Sign and broadcast
    this.log('📡 Step 5/5: Signing and broadcasting...');
    let signature: string;

    if (this.config.enableJitoBundles) {
      signature = await this.sendViaJitoBundle([launchTx]);
    } else {
      signature = await signAndSendTransaction(
        this.connection,
        this.config.commitment,
        launchTx,
        this.keypair
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const result: LaunchResult = {
      tokenMint: tokenInfo.tokenMint,
      metadataUri: tokenInfo.tokenMetadata,
      configKey: configKey.toBase58(),
      launchSignature: signature,
      tokenUrl: `https://bags.fm/${tokenInfo.tokenMint}`,
    };

    this.log(`🎉 Token launched successfully in ${elapsed}s!`);
    this.log(`   🪙 Mint: ${result.tokenMint}`);
    this.log(`   🔑 Signature: ${result.launchSignature}`);
    this.log(`   🌐 URL: ${result.tokenUrl}`);

    return result;
  }

  // -------------------------------------------------------
  // Metadata Creation
  // -------------------------------------------------------

  private async createTokenMetadata(params: TokenLaunchParams) {
    const createParams: CreateTokenInfoParams = params.imageUrl
      ? {
          imageUrl: params.imageUrl,
          name: params.name,
          symbol: params.symbol.toUpperCase().replace('$', ''),
          description: params.description,
          twitter: params.twitterUrl,
          website: params.websiteUrl,
          telegram: params.telegramUrl,
        }
      : {
          image: params.imagePath!,
          name: params.name,
          symbol: params.symbol.toUpperCase().replace('$', ''),
          description: params.description,
          twitter: params.twitterUrl,
          website: params.websiteUrl,
          telegram: params.telegramUrl,
        };

    return this.sdk.tokenLaunch.createTokenInfoAndMetadata(createParams);
  }

  // -------------------------------------------------------
  // Fee Share Config
  // -------------------------------------------------------

  private async buildFeeClaimers(
    params: TokenLaunchParams
  ): Promise<Array<{ user: PublicKey; userBps: number }>> {
    if (!params.feeClaimers || params.feeClaimers.length === 0) {
      // Creator gets 100% of all fees
      this.log('   💰 Creator receives 100% of fees (10000 bps)');
      return [{ user: this.keypair.publicKey, userBps: 10000 }];
    }

    const totalClaimerBps = params.feeClaimers.reduce(
      (sum, fc) => sum + fc.bps,
      0
    );
    const creatorBps = 10000 - totalClaimerBps;

    if (creatorBps < 0) {
      throw new Error(
        `Fee claimer BPS total (${totalClaimerBps}) exceeds 10000`
      );
    }

    const feeClaimers: Array<{ user: PublicKey; userBps: number }> = [];

    // Creator first with explicit BPS
    if (creatorBps > 0) {
      feeClaimers.push({ user: this.keypair.publicKey, userBps: creatorBps });
      this.log(`   💰 Creator: ${creatorBps / 100}%`);
    }

    // Resolve fee claimer wallets from social providers
    for (const fc of params.feeClaimers) {
      this.log(`   🔍 Resolving ${fc.provider}:${fc.username}...`);
      const walletResult = await this.sdk.state.getLaunchWalletV2(
        fc.username,
        fc.provider
      );
      feeClaimers.push({ user: walletResult.wallet, userBps: fc.bps });
      this.log(
        `   ✅ ${fc.username}: ${walletResult.wallet.toBase58()} (${fc.bps / 100}%)`
      );
    }

    return feeClaimers;
  }

  private async createFeeShareConfig(
    tokenMint: PublicKey,
    feeClaimers: Array<{ user: PublicKey; userBps: number }>,
    partner?: { wallet: string; configPda: string }
  ): Promise<PublicKey> {
    const commitment = this.sdk.state.getCommitment();

    // Handle LUTs if needed (>15 claimers)
    let additionalLookupTables: PublicKey[] | undefined;
    if (feeClaimers.length > BAGS_FEE_SHARE_V2_MAX_CLAIMERS_NON_LUT) {
      this.log(
        `   📋 Creating LUTs for ${feeClaimers.length} claimers...`
      );
      const lutResult =
        await this.sdk.config.getConfigCreationLookupTableTransactions({
          payer: this.keypair.publicKey,
          baseMint: tokenMint,
          feeClaimers,
        });

      if (lutResult) {
        await signAndSendTransaction(
          this.connection,
          commitment,
          lutResult.creationTransaction,
          this.keypair
        );
        await waitForSlotsToPass(this.connection, commitment, 1);

        for (const extendTx of lutResult.extendTransactions) {
          await signAndSendTransaction(
            this.connection,
            commitment,
            extendTx,
            this.keypair
          );
        }
        additionalLookupTables = lutResult.lutAddresses;
        this.log('   ✅ LUTs created');
      }
    }

    // Create the config
    const configResult = await this.sdk.config.createBagsFeeShareConfig({
      payer: this.keypair.publicKey,
      baseMint: tokenMint,
      feeClaimers,
      partner: partner ? new PublicKey(partner.wallet) : undefined,
      partnerConfig: partner ? new PublicKey(partner.configPda) : undefined,
      additionalLookupTables,
    });

    // Send bundle transactions
    if (configResult.bundles && configResult.bundles.length > 0) {
      for (const bundle of configResult.bundles) {
        await this.sendViaJitoBundle(bundle);
      }
    }

    // Send remaining transactions
    for (const tx of configResult.transactions || []) {
      await signAndSendTransaction(
        this.connection,
        commitment,
        tx,
        this.keypair
      );
    }

    return configResult.meteoraConfigKey;
  }

  // -------------------------------------------------------
  // Jito Bundle Submission
  // -------------------------------------------------------

  private async sendViaJitoBundle(
    unsignedTransactions: VersionedTransaction[]
  ): Promise<string> {
    const commitment = this.sdk.state.getCommitment();
    const bundleBlockhash =
      unsignedTransactions[0]?.message.recentBlockhash;
    if (!bundleBlockhash) {
      throw new Error('Bundle transactions must have a blockhash');
    }

    // Get recommended Jito tip
    let jitoTip = this.config.defaultTipLamports;
    try {
      const recommendedTip = await this.sdk.solana.getJitoRecentFees();
      if (recommendedTip?.landed_tips_95th_percentile) {
        jitoTip = Math.floor(
          recommendedTip.landed_tips_95th_percentile * LAMPORTS_PER_SOL
        );
      }
    } catch {
      this.warn('Using fallback Jito tip');
    }

    this.log(`   💰 Jito tip: ${jitoTip / LAMPORTS_PER_SOL} SOL`);

    // Create tip transaction
    const tipTx = await createTipTransaction(
      this.connection,
      commitment,
      this.keypair.publicKey,
      jitoTip,
      { blockhash: bundleBlockhash }
    );

    // Sign all transactions
    const signedTransactions = [tipTx, ...unsignedTransactions].map((tx) => {
      tx.sign([this.keypair]);
      return tx;
    });

    this.log('   📦 Sending bundle via Jito...');
    const bundleId = await sendBundleAndConfirm(signedTransactions, this.sdk);
    this.log(`   ✅ Bundle confirmed: ${bundleId}`);
    return bundleId;
  }

  // -------------------------------------------------------
  // Trading
  // -------------------------------------------------------

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageMode: 'auto' | 'manual' = 'auto',
    slippageBps?: number
  ) {
    return this.sdk.trade.getQuote({
      inputMint: new PublicKey(inputMint),
      outputMint: new PublicKey(outputMint),
      amount,
      slippageMode,
      slippageBps,
    });
  }

  async executeSwap(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageMode: 'auto' | 'manual' = 'auto',
    slippageBps?: number
  ): Promise<string> {
    const quote = await this.getQuote(
      inputMint,
      outputMint,
      amount,
      slippageMode,
      slippageBps
    );

    const swapResult = await this.sdk.trade.createSwapTransaction({
      quoteResponse: quote,
      userPublicKey: this.keypair.publicKey,
    });

    const signature = await signAndSendTransaction(
      this.connection,
      this.config.commitment,
      swapResult.transaction,
      this.keypair
    );

    return signature;
  }

  // -------------------------------------------------------
  // Analytics
  // -------------------------------------------------------

  async getTokenLifetimeFees(tokenMint: string): Promise<number> {
    return this.sdk.state.getTokenLifetimeFees(new PublicKey(tokenMint));
  }

  async getTokenCreators(tokenMint: string) {
    return this.sdk.state.getTokenCreators(new PublicKey(tokenMint));
  }

  async getTokenClaimStats(tokenMint: string) {
    return this.sdk.state.getTokenClaimStats(new PublicKey(tokenMint));
  }

  async getTokenClaimEvents(
    tokenMint: string,
    options?: { mode?: 'offset' | 'time'; limit?: number; offset?: number; from?: number; to?: number }
  ) {
    return this.sdk.state.getTokenClaimEvents(new PublicKey(tokenMint), options);
  }

  // -------------------------------------------------------
  // Fee Claiming
  // -------------------------------------------------------

  async claimAllFees(): Promise<string[]> {
    const positions = await this.sdk.fee.getAllClaimablePositions(
      this.keypair.publicKey
    );
    if (positions.length === 0) {
      this.log('No claimable positions found');
      return [];
    }

    const signatures: string[] = [];
    for (const position of positions) {
      const claimTxs = await this.sdk.fee.getClaimTransaction(
        this.keypair.publicKey,
        position
      );
      for (const tx of claimTxs) {
        // fee service returns legacy Transaction objects
        tx.sign(this.keypair);
        const sig = await this.connection.sendTransaction(tx, [this.keypair], {
          skipPreflight: true,
        });
        signatures.push(sig);
      }
    }
    return signatures;
  }

  async claimFeesForToken(tokenMint: string): Promise<string[]> {
    const positions = await this.sdk.fee.getAllClaimablePositions(
      this.keypair.publicKey
    );
    const targetPositions = positions.filter(
      (p) => p.baseMint === tokenMint
    );

    const signatures: string[] = [];
    for (const position of targetPositions) {
      const claimTxs = await this.sdk.fee.getClaimTransaction(
        this.keypair.publicKey,
        position
      );
      for (const tx of claimTxs) {
        tx.sign(this.keypair);
        const sig = await this.connection.sendTransaction(tx, [this.keypair], {
          skipPreflight: true,
        });
        signatures.push(sig);
      }
    }
    return signatures;
  }

  async getClaimablePositions() {
    return this.sdk.fee.getAllClaimablePositions(this.keypair.publicKey);
  }

  // -------------------------------------------------------
  // Partner Operations
  // -------------------------------------------------------

  async createPartnerKey(): Promise<string> {
    // Check if already exists
    try {
      await this.sdk.partner.getPartnerConfig(
        this.keypair.publicKey
      );
      this.log('Partner config already exists');
      // Return wallet address as the partner identifier
      return this.keypair.publicKey.toBase58();
    } catch {
      // doesn't exist, create it
    }

    const { transaction, blockhash } =
      await this.sdk.partner.getPartnerConfigCreationTransaction(
        this.keypair.publicKey
      );

    await signAndSendTransaction(
      this.connection,
      this.config.commitment,
      transaction,
      this.keypair,
      blockhash
    );

    this.log('Partner config created successfully');
    return this.keypair.publicKey.toBase58();
  }

  async getPartnerConfig() {
    return this.sdk.partner.getPartnerConfig(this.keypair.publicKey);
  }

  async claimPartnerFees(): Promise<string[]> {
    const stats = await this.sdk.partner.getPartnerConfigClaimStats(
      this.keypair.publicKey
    );
    const unclaimed = BigInt(stats.unclaimedFees);
    if (unclaimed === 0n) {
      this.log('No unclaimed partner fees');
      return [];
    }

    const claimTxs =
      await this.sdk.partner.getPartnerConfigClaimTransactions(
        this.keypair.publicKey
      );

    const signatures: string[] = [];
    for (let i = 0; i < claimTxs.length; i++) {
      const { transaction, blockhash } = claimTxs[i];
      const sig = await signAndSendTransaction(
        this.connection,
        this.config.commitment,
        transaction,
        this.keypair,
        blockhash
      );
      signatures.push(sig);
    }
    return signatures;
  }

  // -------------------------------------------------------
  // Utility: Retry with Exponential Backoff
  // -------------------------------------------------------

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.config.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Don't retry 4xx client errors
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500) {
          throw error;
        }
        if (attempt < retries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          this.warn(
            `Attempt ${attempt} failed, retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  // -------------------------------------------------------
  // Health Check
  // -------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://public-api-v2.bags.fm/ping');
      const data = await response.json() as { message?: string };
      return data.message === 'pong';
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------
  // Balance Checks
  // -------------------------------------------------------

  async getSolBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getTokenBalance(tokenMint: string): Promise<number> {
    try {
      const mintPubkey = new PublicKey(tokenMint);
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        this.keypair.publicKey,
        { mint: mintPubkey }
      );

      if (tokenAccounts.value.length === 0) return 0;

      const balance = await this.connection.getTokenAccountBalance(
        tokenAccounts.value[0].pubkey
      );

      return Number(balance.value.uiAmount || 0);
    } catch {
      return 0;
    }
  }
}
