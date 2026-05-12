/**
 * Comprehensive Bags.fm Agent Service
 *
 * Covers all Bags API v2 endpoints:
 * - Token Launch (create-token-info, create-launch-transaction)
 * - Fee Share (wallet lookup v2, bulk lookup, config creation)
 * - Analytics (creators, lifetime fees, claim stats, claim events)
 * - State (pool config keys)
 * - Fee Claiming (claimable positions, claim transactions v2)
 * - Trade/Swap (quote, swap, full execution)
 * - Partner (stats, claim transactions, create config, full claim flow)
 */

import bs58 from 'bs58';
import { nanoid } from 'nanoid';

import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import type { Database } from '../db/index.js';
import { transactionLogTable } from '../db/schema.js';
import type {
  Logger,
  ServiceContext,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION & TYPES
// ═══════════════════════════════════════════════════════════════

const BASE_URL = 'https://public-api-v2.bags.fm/api/v1';
const BAGS_LUT_ADDRESS = 'Eq1EVs15EAWww1YtPTtWPzJRLPJoS6VYP9oW9SbNr3yp';

export interface BagsAgentConfig {
  apiKey: string;
  partnerConfigKey?: string;
  refCode?: string;
  rpcUrl: string;
}

interface ApiResponse<T> {
  success: boolean;
  response?: T;
  error?: string;
}

// Trade Types
export interface TradeQuote {
  requestId: string;
  contextSlot: number;
  inAmount: string;
  inputMint: string;
  outAmount: string;
  outputMint: string;
  minOutAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: RouteLeg[];
  platformFee?: PlatformFee;
  outTransferFee: string;
  simulatedComputeUnits: number;
}

export interface RouteLeg {
  venue: string;
  inAmount: string;
  outAmount: string;
  inputMint: string;
  outputMint: string;
  inputMintDecimals: number;
  outputMintDecimals: number;
  marketKey: string;
  data: string;
}

export interface PlatformFee {
  amount: string;
  feeBps: number;
  feeAccount: string;
  segmenterFeeAmount: string;
  segmenterFeePct: number;
}

export interface SwapResult {
  swapTransaction: string;
  computeUnitLimit: number;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

// Token Launch Types
export interface TokenInfoResponse {
  tokenMint: string;
  tokenMetadata: string;
  tokenLaunch: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    tokenMint: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    telegram?: string;
    twitter?: string;
    website?: string;
    launchWallet?: string;
    launchSignature?: string;
    uri?: string;
  };
}

// Fee Share Types
export interface FeeShareWallet {
  provider: string;
  platformData: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
  wallet: string;
}

// Fee Claiming Types
export interface ClaimablePosition {
  isCustomFeeVault: boolean;
  baseMint: string;
  isMigrated: boolean;
  totalClaimableLamportsUserShare: string;
  programId: string;
  virtualPoolAddress?: string;
  virtualPoolClaimableAmount?: string;
  dammPoolClaimableAmount?: string;
  customFeeVaultBalance?: string;
  customFeeVaultBps?: number;
  customFeeVaultClaimerSide?: string;
}

// Analytics Types
export interface TokenCreator {
  username: string;
  pfp: string;
  royaltyBps: number;
  isCreator: boolean;
  provider: string;
  providerUsername: string;
  wallet: string;
}

// Partner Types
export interface PartnerStats {
  claimedFees: string;
  unclaimedFees: string;
}

// ═══════════════════════════════════════════════════════════════
// CORE HTTP HELPERS
// ═══════════════════════════════════════════════════════════════

async function apiGet<T>(apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });
  const data = await res.json() as ApiResponse<T>;
  if (!data.success) throw new Error(data.error || `GET ${path} failed`);
  return data.response!;
}

async function apiPost<T>(apiKey: string, path: string, body: any, isFormData = false): Promise<T> {
  const headers: Record<string, string> = { 'x-api-key': apiKey };
  let fetchBody: any;

  if (isFormData) {
    fetchBody = body;
  } else {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: fetchBody,
  });
  const data = await res.json() as ApiResponse<T>;
  if (!data.success) throw new Error(data.error || `POST ${path} failed`);
  return data.response!;
}

// ═══════════════════════════════════════════════════════════════
// BAGS AGENT SERVICE
// ═══════════════════════════════════════════════════════════════

export class BagsAgentService {
  private db: Database;
  private config: BagsAgentConfig;
  private logger: Logger;
  private connection: Connection;
  private walletKeypair: Keypair | null = null;

  constructor(ctx: ServiceContext & { bagsConfig: BagsAgentConfig }) {
    this.db = ctx.db;
    this.config = ctx.bagsConfig;
    this.logger = ctx.logger;
    this.connection = new Connection(ctx.bagsConfig.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    this.logger.info('[bags-agent] Service initialized');
  }

  // ─────────────────────────────────────────────────
  // WALLET MANAGEMENT
  // ─────────────────────────────────────────────────

  setWallet(privateKey: string): void {
    try {
      if (privateKey.startsWith('[')) {
        const keyArray = JSON.parse(privateKey) as number[];
        this.walletKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
      } else {
        this.walletKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      }
      this.logger.info(`[bags-agent] Wallet set: ${this.walletKeypair.publicKey.toBase58()}`);
    } catch (error) {
      this.logger.error(`[bags-agent] Failed to set wallet: ${error}`);
      throw new Error('Invalid wallet private key format');
    }
  }

  get walletPublicKey(): PublicKey | null {
    return this.walletKeypair?.publicKey ?? null;
  }

  // ─────────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────────

  async ping(): Promise<string> {
    const res = await fetch('https://public-api-v2.bags.fm/ping');
    const data = await res.json() as { message: string };
    return data.message; // "pong"
  }

  // ═══════════════════════════════════════════════════
  // TOKEN LAUNCH ENDPOINTS
  // ═══════════════════════════════════════════════════

  /**
   * POST /token-launch/create-token-info
   * Create token info and metadata with image upload.
   */
  async createTokenInfoAndMetadata(params: {
    name: string;
    symbol: string;
    description: string;
    imageUrl?: string;
    imageFile?: Blob;
    metadataUrl?: string;
    telegram?: string;
    twitter?: string;
    website?: string;
  }): Promise<TokenInfoResponse> {
    const formData = new FormData();
    formData.append('name', params.name);
    formData.append('symbol', params.symbol.toUpperCase().replace('$', ''));
    formData.append('description', params.description);

    if (params.imageFile) {
      formData.append('image', params.imageFile);
    }
    if (params.imageUrl) formData.append('imageUrl', params.imageUrl);
    if (params.metadataUrl) formData.append('metadataUrl', params.metadataUrl);
    if (params.telegram) formData.append('telegram', params.telegram);
    if (params.twitter) formData.append('twitter', params.twitter);
    if (params.website) formData.append('website', params.website);

    this.logger.info(`[bags-agent] Creating token info: ${params.name} ($${params.symbol})`);
    return apiPost<TokenInfoResponse>(this.config.apiKey, '/token-launch/create-token-info', formData, true);
  }

  /**
   * POST /token-launch/create-launch-transaction
   * Create a token launch transaction.
   */
  async createTokenLaunchTransaction(params: {
    ipfs: string;
    tokenMint: string;
    wallet: string;
    initialBuyLamports: number;
    configKey: string;
    tipWallet?: string;
    tipLamports?: number;
  }): Promise<string> {
    this.logger.info(`[bags-agent] Creating launch transaction for mint: ${params.tokenMint}`);
    return apiPost<string>(this.config.apiKey, '/token-launch/create-launch-transaction', params);
  }

  // ═══════════════════════════════════════════════════
  // FEE SHARE ENDPOINTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /token-launch/fee-share/wallet/v2
   * Get wallet address for a social provider and username.
   */
  async getFeeShareWalletV2(
    provider: 'twitter' | 'kick' | 'github',
    username: string
  ): Promise<FeeShareWallet> {
    this.logger.info(`[bags-agent] Looking up fee share wallet: ${provider}/${username}`);
    return apiGet<FeeShareWallet>(this.config.apiKey, '/token-launch/fee-share/wallet/v2', {
      provider,
      username,
    });
  }

  /**
   * POST /token-launch/fee-share/wallet/v2/bulk
   * Bulk lookup of fee share wallets.
   */
  async getFeeShareWalletV2Bulk(
    users: Array<{ provider: 'twitter' | 'kick' | 'github'; username: string }>
  ): Promise<FeeShareWallet[]> {
    this.logger.info(`[bags-agent] Bulk looking up ${users.length} fee share wallets`);
    return apiPost<FeeShareWallet[]>(this.config.apiKey, '/token-launch/fee-share/wallet/v2/bulk', { users });
  }

  /**
   * POST /fee-share/config
   * Create fee share configuration transaction.
   */
  async createFeeShareConfig(params: {
    payer: string;
    baseMint: string;
    feeClaimers: Array<{ user: string; userBps: number }>;
    partner?: string;
    partnerConfig?: string;
    additionalLookupTables?: string[];
    tipWallet?: string;
    tipLamports?: number;
  }): Promise<any> {
    this.logger.info(`[bags-agent] Creating fee share config for mint: ${params.baseMint}`);
    return apiPost(this.config.apiKey, '/fee-share/config', params);
  }

  // ═══════════════════════════════════════════════════
  // ANALYTICS ENDPOINTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /token-launch/creator/v3
   * Get token launch creators/deployers.
   */
  async getTokenLaunchCreators(tokenMint: string): Promise<TokenCreator[]> {
    this.logger.info(`[bags-agent] Getting creators for token: ${tokenMint}`);
    return apiGet<TokenCreator[]>(this.config.apiKey, '/token-launch/creator/v3', { tokenMint });
  }

  /**
   * GET /token-launch/lifetime-fees
   * Get token lifetime fees.
   */
  async getTokenLifetimeFees(tokenMint: string): Promise<any> {
    this.logger.info(`[bags-agent] Getting lifetime fees for token: ${tokenMint}`);
    return apiGet(this.config.apiKey, '/token-launch/lifetime-fees', { tokenMint });
  }

  /**
   * GET /token-launch/claim-stats
   * Get token claim stats.
   */
  async getTokenClaimStats(tokenMint: string): Promise<any> {
    this.logger.info(`[bags-agent] Getting claim stats for token: ${tokenMint}`);
    return apiGet(this.config.apiKey, '/token-launch/claim-stats', { tokenMint });
  }

  /**
   * GET /token-launch/claim-events
   * Get token claim events.
   */
  async getTokenClaimEvents(tokenMint: string): Promise<any> {
    this.logger.info(`[bags-agent] Getting claim events for token: ${tokenMint}`);
    return apiGet(this.config.apiKey, '/token-launch/claim-events', { tokenMint });
  }

  // ═══════════════════════════════════════════════════
  // STATE ENDPOINTS
  // ═══════════════════════════════════════════════════

  /**
   * POST /token-launch/pool-config-keys
   * Get pool config keys by fee claimer vaults.
   */
  async getPoolConfigKeysByFeeClaimerVaults(
    feeClaimerVaults: string[]
  ): Promise<{ poolConfigKeys: string[] }> {
    this.logger.info(`[bags-agent] Getting pool config keys for ${feeClaimerVaults.length} vaults`);
    return apiPost<{ poolConfigKeys: string[] }>(this.config.apiKey, '/token-launch/pool-config-keys', {
      feeClaimerVaults,
    });
  }

  // ═══════════════════════════════════════════════════
  // FEE CLAIMING ENDPOINTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /token-launch/claimable-positions
   * Get all claimable fee positions for a wallet.
   */
  async getClaimablePositions(wallet?: string): Promise<ClaimablePosition[]> {
    const w = wallet || this.walletPublicKey?.toBase58();
    if (!w) throw new Error('Wallet not configured');

    this.logger.info(`[bags-agent] Getting claimable positions for: ${w}`);
    return apiGet<ClaimablePosition[]>(this.config.apiKey, '/token-launch/claimable-positions', { wallet: w });
  }

  /**
   * POST /token-launch/claim-txs/v2
   * Generate transactions to claim fees from virtual pools and/or DAMM v2 positions.
   */
  async getClaimTransactions(params: {
    feeClaimer: string;
    tokenMint: string;
    programId?: string;
    isCustomFeeVault?: boolean;
    virtualPoolAddress?: string;
    isMigrated?: boolean;
  }): Promise<any[]> {
    this.logger.info(`[bags-agent] Generating claim transactions for token: ${params.tokenMint}`);
    return apiPost<any[]>(this.config.apiKey, '/token-launch/claim-txs/v2', params);
  }

  // ═══════════════════════════════════════════════════
  // TRADE (SWAP) ENDPOINTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /trade/quote
   * Get a quote for swapping tokens.
   */
  async getTradeQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageMode?: 'auto' | 'manual';
    slippageBps?: number;
  }): Promise<TradeQuote> {
    const queryParams: Record<string, string> = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount.toString(),
      slippageMode: params.slippageMode || 'auto',
    };
    if (params.slippageBps !== undefined) {
      queryParams.slippageBps = params.slippageBps.toString();
    }

    this.logger.info(`[bags-agent] Getting trade quote: ${params.inputMint} → ${params.outputMint}`);
    return apiGet<TradeQuote>(this.config.apiKey, '/trade/quote', queryParams);
  }

  /**
   * POST /trade/swap
   * Create a swap transaction from a trade quote.
   */
  async createSwapTransaction(params: {
    quoteResponse: TradeQuote;
    userPublicKey: string;
  }): Promise<SwapResult> {
    this.logger.info('[bags-agent] Creating swap transaction...');
    return apiPost<SwapResult>(this.config.apiKey, '/trade/swap', params);
  }

  /**
   * Full swap flow: get quote → create transaction → sign → send
   */
  async executeSwap(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageMode?: 'auto' | 'manual';
    slippageBps?: number;
  }): Promise<{ signature: string; quote: TradeQuote }> {
    if (!this.walletKeypair) {
      throw new Error('Wallet not configured');
    }

    // Step 1: Get quote
    const quote = await this.getTradeQuote(params);

    this.logger.info(`\n[bags-agent] Quote Details:`);
    this.logger.info(`   Input:  ${quote.inAmount} (${quote.inputMint})`);
    this.logger.info(`   Output: ${quote.outAmount} (${quote.outputMint})`);
    this.logger.info(`   Price Impact: ${quote.priceImpactPct}%`);
    this.logger.info(`   Slippage: ${quote.slippageBps / 100}%`);

    // Step 2: Create swap transaction
    const swapResult = await this.createSwapTransaction({
      quoteResponse: quote,
      userPublicKey: this.walletKeypair.publicKey.toBase58(),
    });

    // Step 3: Deserialize, sign, and send
    const txBuffer = Buffer.from(swapResult.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([this.walletKeypair]);

    const signature = await this.connection.sendTransaction(transaction, {
      maxRetries: 3,
    });

    // Step 4: Confirm
    const latestBlockhash = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: swapResult.lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    );

    this.logger.info(`\n[bags-agent] Swap executed! Signature: ${signature}`);

    // Log transaction
    await this.db.insert(transactionLogTable).values({
      id: nanoid(),
      chatId: 0,
      type: 'bags-swap',
      signature,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.amount.toString(),
      outputAmount: quote.outAmount,
      status: 'confirmed',
      createdAt: Date.now(),
    });

    return { signature, quote };
  }

  // ═══════════════════════════════════════════════════
  // PARTNER ENDPOINTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /fee-share/partner-config/stats
   * Get partner statistics including claimed and unclaimed fees.
   */
  async getPartnerStats(partner: string): Promise<PartnerStats> {
    this.logger.info(`[bags-agent] Getting partner stats for: ${partner}`);
    return apiGet<PartnerStats>(this.config.apiKey, '/fee-share/partner-config/stats', { partner });
  }

  /**
   * POST /fee-share/partner-config/claim-txs
   * Create partner claim transactions.
   */
  async createPartnerClaimTransactions(partner: string): Promise<any[]> {
    this.logger.info(`[bags-agent] Creating partner claim transactions for: ${partner}`);
    return apiPost<any[]>(this.config.apiKey, '/fee-share/partner-config/claim-txs', { partner });
  }

  /**
   * POST /fee-share/partner-config
   * Create a partner configuration.
   */
  async createPartnerConfig(params: {
    partner: string;
    bps: number;
  }): Promise<any> {
    this.logger.info(`[bags-agent] Creating partner config: ${params.partner} at ${params.bps} bps`);
    return apiPost(this.config.apiKey, '/fee-share/partner-config', params);
  }

  /**
   * Full partner fee claim flow
   */
  async claimPartnerFees(partnerWallet?: string): Promise<void> {
    const wallet = partnerWallet || this.walletKeypair?.publicKey.toBase58();
    if (!wallet) throw new Error('Wallet not configured');
    if (!this.walletKeypair) throw new Error('Wallet keypair not configured');

    // Check stats
    const stats = await this.getPartnerStats(wallet);
    const unclaimedLamports = BigInt(stats.unclaimedFees);
    const claimedLamports = BigInt(stats.claimedFees);

    this.logger.info(`[bags-agent] Claimed: ${Number(claimedLamports) / LAMPORTS_PER_SOL} SOL`);
    this.logger.info(`[bags-agent] Unclaimed: ${Number(unclaimedLamports) / LAMPORTS_PER_SOL} SOL`);

    if (unclaimedLamports === 0n) {
      this.logger.info('[bags-agent] No unclaimed fees to claim');
      return;
    }

    // Get and execute claim transactions
    const claimTxs = await this.createPartnerClaimTransactions(wallet);
    if (!claimTxs || claimTxs.length === 0) {
      this.logger.info('[bags-agent] No claim transactions generated');
      return;
    }

    this.logger.info(`[bags-agent] Executing ${claimTxs.length} claim transaction(s)...`);
    for (let i = 0; i < claimTxs.length; i++) {
      const txBuffer = Buffer.from(claimTxs[i].transaction, 'base64');
      const tx = VersionedTransaction.deserialize(txBuffer);
      tx.sign([this.walletKeypair]);
      const sig = await this.connection.sendTransaction(tx, { maxRetries: 3 });
      this.logger.info(`[bags-agent] ✅ ${sig}`);
    }

    this.logger.info('[bags-agent] Partner fees claimed!');
  }

  // ═══════════════════════════════════════════════════
  // HIGH-LEVEL FLOWS
  // ═══════════════════════════════════════════════════

  /**
   * Complete token launch: create metadata → configure fees → launch
   */
  async launchToken(params: {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    initialBuyLamports: number;
    feeClaimers?: Array<{
      provider: 'twitter' | 'kick' | 'github';
      username: string;
      bps: number;
    }>;
    partner?: string;
    partnerConfig?: string;
    tipWallet?: string;
    tipLamports?: number;
    twitter?: string;
    website?: string;
    telegram?: string;
  }): Promise<{ tokenMint: string; signature: string }> {
    if (!this.walletKeypair) {
      throw new Error('Wallet not configured');
    }

    this.logger.info(`\n[bags-agent] === LAUNCHING TOKEN: ${params.name} ($${params.symbol}) ===\n`);

    // Step 1: Create metadata
    const tokenInfo = await this.createTokenInfoAndMetadata({
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      imageUrl: params.imageUrl,
      twitter: params.twitter,
      website: params.website,
      telegram: params.telegram,
    });

    this.logger.info(`[bags-agent] Token mint: ${tokenInfo.tokenMint}`);
    this.logger.info(`[bags-agent] Metadata URI: ${tokenInfo.tokenMetadata}`);

    // Step 2: Build fee claimers array
    let feeClaimersList: Array<{ user: string; userBps: number }> = [];

    if (params.feeClaimers && params.feeClaimers.length > 0) {
      const totalFeeClaimerBps = params.feeClaimers.reduce((sum, fc) => sum + fc.bps, 0);
      const creatorBps = 10000 - totalFeeClaimerBps;

      if (creatorBps < 0) throw new Error('Total fee claimer BPS exceeds 10000');

      if (creatorBps > 0) {
        feeClaimersList.push({
          user: this.walletKeypair.publicKey.toBase58(),
          userBps: creatorBps,
        });
      }

      for (const fc of params.feeClaimers) {
        const wallet = await this.getFeeShareWalletV2(fc.provider, fc.username);
        feeClaimersList.push({ user: wallet.wallet, userBps: fc.bps });
      }
    } else {
      feeClaimersList = [{ user: this.walletKeypair.publicKey.toBase58(), userBps: 10000 }];
    }

    // Step 3: Create fee share config
    const configResult = await this.createFeeShareConfig({
      payer: this.walletKeypair.publicKey.toBase58(),
      baseMint: tokenInfo.tokenMint,
      feeClaimers: feeClaimersList,
      partner: params.partner,
      partnerConfig: params.partnerConfig,
    });

    // Sign and send config transactions if needed
    if (configResult.transactions) {
      for (const txData of configResult.transactions) {
        const txBuf = Buffer.from(txData, 'base64');
        const tx = VersionedTransaction.deserialize(txBuf);
        tx.sign([this.walletKeypair]);
        await this.connection.sendTransaction(tx, { maxRetries: 3 });
      }
    }

    const configKey = configResult.meteoraConfigKey || configResult.configKey;
    this.logger.info(`[bags-agent] Config key: ${configKey}`);

    // Step 4: Create and send launch transaction
    const launchTxBase58 = await this.createTokenLaunchTransaction({
      ipfs: tokenInfo.tokenMetadata,
      tokenMint: tokenInfo.tokenMint,
      wallet: this.walletKeypair.publicKey.toBase58(),
      initialBuyLamports: params.initialBuyLamports,
      configKey: configKey,
      tipWallet: params.tipWallet,
      tipLamports: params.tipLamports,
    });

    const launchTxBuf = Buffer.from(launchTxBase58, 'base64');
    const launchTx = VersionedTransaction.deserialize(launchTxBuf);
    launchTx.sign([this.walletKeypair]);

    const signature = await this.connection.sendTransaction(launchTx, { maxRetries: 3 });

    this.logger.info(`\n[bags-agent] Token launched!`);
    this.logger.info(`   Mint: ${tokenInfo.tokenMint}`);
    this.logger.info(`   Signature: ${signature}`);
    this.logger.info(`   View: https://bags.fm/${tokenInfo.tokenMint}`);

    // Log transaction
    await this.db.insert(transactionLogTable).values({
      id: nanoid(),
      chatId: 0,
      type: 'bags-launch',
      signature,
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: tokenInfo.tokenMint,
      inputAmount: (params.initialBuyLamports / LAMPORTS_PER_SOL).toString(),
      status: 'confirmed',
      metadata: {
        name: params.name,
        symbol: params.symbol,
        metadataUrl: tokenInfo.tokenMetadata,
      },
      createdAt: Date.now(),
    });

    return { tokenMint: tokenInfo.tokenMint, signature };
  }

  /**
   * Claim all fees for a specific token mint
   */
  async claimFeesForToken(tokenMint: string): Promise<void> {
    if (!this.walletKeypair) {
      throw new Error('Wallet not configured');
    }

    const wallet = this.walletKeypair.publicKey.toBase58();

    // Get claimable positions
    const positions = await this.getClaimablePositions(wallet);

    if (positions.length === 0) {
      this.logger.info('[bags-agent] No claimable positions found');
      return;
    }

    // Filter for target token
    const targetPositions = positions.filter((p) => p.baseMint === tokenMint);

    if (targetPositions.length === 0) {
      this.logger.info(`[bags-agent] No positions for token: ${tokenMint}`);
      return;
    }

    this.logger.info(`[bags-agent] Found ${targetPositions.length} position(s) for token`);

    for (const position of targetPositions) {
      const total = Number(position.totalClaimableLamportsUserShare || 0) / LAMPORTS_PER_SOL;
      this.logger.info(`[bags-agent] Claimable: ${total.toFixed(6)} SOL`);

      const claimTxs = await this.getClaimTransactions({
        feeClaimer: wallet,
        tokenMint: position.baseMint,
        programId: position.programId,
        isCustomFeeVault: position.isCustomFeeVault,
        virtualPoolAddress: position.virtualPoolAddress,
        isMigrated: position.isMigrated,
      });

      for (const txData of claimTxs) {
        const txBuf = Buffer.from(txData.transaction || txData, 'base64');
        const tx = VersionedTransaction.deserialize(txBuf);
        tx.sign([this.walletKeypair]);
        const sig = await this.connection.sendTransaction(tx, { maxRetries: 3 });
        this.logger.info(`[bags-agent] ✅ Claimed: ${sig}`);
      }
    }

    this.logger.info('[bags-agent] All fees claimed!');
  }

  // ═══════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════

  async getBalance(): Promise<number> {
    if (!this.walletKeypair) return 0;

    try {
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      this.logger.error(`[bags-agent] Failed to get balance: ${error}`);
      return 0;
    }
  }

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
      this.logger.error(`[bags-agent] Failed to get token balance: ${error}`);
      return 0;
    }
  }
}
