/**
 * Pump.fun Protocol Service
 * 
 * Implements bonding curve token creation, trading, and migration to PumpSwap AMM.
 * Based on official Pump.fun protocol documentation.
 */

import BN from 'bn.js';

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// ============================================================================
// PROGRAM IDs AND ADDRESSES
// ============================================================================

export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const PUMP_SWAP_PROGRAM_ID = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
export const PUMP_FEES_PROGRAM_ID = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
export const MAYHEM_PROGRAM_ID = new PublicKey("MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e");

// Global State PDAs
export const PUMP_GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
export const PUMP_SWAP_GLOBAL_CONFIG = new PublicKey("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw");
export const MAYHEM_GLOBAL_PARAMS = new PublicKey("13ec7XdrjF3h3YcqBTFDSReRcUFwbCnJaAQspM4j6DDJ");
export const MAYHEM_SOL_VAULT = new PublicKey("BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s");

// Standard Fee Recipients (use any one randomly for better TX throughput)
export const FEE_RECIPIENTS = [
  new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"),
  new PublicKey("7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ"),
  new PublicKey("7hTckgnGnLQR6sdH7YkqFTAA7VwTfYFaZ6EhEsU3saCX"),
  new PublicKey("9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz"),
  new PublicKey("AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY"),
  new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM"),
  new PublicKey("FWsW1xNtWscwNmKv6wVsU1iTzRN6wmmk3MjxRP5tT7Hz"),
  new PublicKey("G5UZAVbAf46s7cKWoyKu8kYTip9DGTpbLZ2qa9Aq69dP"),
];

// Mayhem Fee Recipients (for is_mayhem_mode = true coins)
export const MAYHEM_FEE_RECIPIENTS = [
  new PublicKey("GesfTA3X2arioaHp8bbKdjG9vJtskViWACZoYvxp4twS"),
  new PublicKey("4budycTjhs9fD6xw62VBducVTNgMgJJ5BgtKq7mAZwn6"),
  new PublicKey("8SBKzEQU4nLSzcwF4a74F2iaUDQyTfjGndn6qUWBnrpR"),
  new PublicKey("4UQeTP1T39KZ9Sfxzo3WR5skgsaP6NZa87BAkuazLEKH"),
];

// ============================================================================
// BONDING CURVE CONSTANTS
// ============================================================================

export const BONDING_CURVE_CONSTANTS = {
  INITIAL_VIRTUAL_TOKEN_RESERVES: new BN("1073000000000000"),
  INITIAL_VIRTUAL_SOL_RESERVES: new BN("30000000000"), // 30 SOL
  INITIAL_REAL_TOKEN_RESERVES: new BN("793100000000000"),
  TOKEN_TOTAL_SUPPLY: new BN("1000000000000000"),
  FEE_BASIS_POINTS: 100, // 1%
};

// ============================================================================
// TYPES
// ============================================================================

export interface BondingCurveData {
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;
  creator: PublicKey;
  isMayhemMode: boolean;
}

export interface TokenLaunchParams {
  name: string;
  symbol: string;
  uri: string; // Metadata URI (IPFS or similar)
  creator: PublicKey;
  isMayhemMode?: boolean;
}

export interface BuyParams {
  mint: PublicKey;
  user: PublicKey;
  solAmount: BN;
  minTokensOut: BN;
}

export interface SellParams {
  mint: PublicKey;
  user: PublicKey;
  tokenAmount: BN;
  minSolOut: BN;
}

export interface SwapQuote {
  inputAmount: BN;
  outputAmount: BN;
  priceImpact: number;
  fee: BN;
}

export interface PumpFunConfig {
  rpcUrl: string;
  commitment?: "confirmed" | "finalized";
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

export function getMintAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority")],
    PUMP_PROGRAM_ID
  );
}

export function getBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID
  );
}

export function getCreatorVaultPDA(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_PROGRAM_ID
  );
}

export function getPoolAuthorityPDA(baseMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool-authority"), baseMint.toBuffer()],
    PUMP_PROGRAM_ID
  );
}

export function getMayhemStatePDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mayhem-state"), mint.toBuffer()],
    MAYHEM_PROGRAM_ID
  );
}

// ============================================================================
// BONDING CURVE MATH
// ============================================================================

/**
 * Calculate tokens received for a given SOL input (buy)
 */
export function calculateBuyTokens(
  curve: BondingCurveData,
  solAmount: BN
): SwapQuote {
  const fee = solAmount.mul(new BN(BONDING_CURVE_CONSTANTS.FEE_BASIS_POINTS)).div(new BN(10000));
  const solAfterFee = solAmount.sub(fee);
  
  // AMM formula: x * y = k
  // tokens_out = (sol_in * token_reserves) / (sol_reserves + sol_in)
  const tokensOut = solAfterFee
    .mul(curve.virtualTokenReserves)
    .div(curve.virtualSolReserves.add(solAfterFee));
  
  // Calculate price impact
  const priceImpact = calculatePriceImpact(
    solAfterFee,
    tokensOut,
    curve.virtualSolReserves,
    curve.virtualTokenReserves
  );
  
  return {
    inputAmount: solAmount,
    outputAmount: tokensOut,
    priceImpact,
    fee,
  };
}

/**
 * Calculate SOL received for a given token input (sell)
 */
export function calculateSellTokens(
  curve: BondingCurveData,
  tokenAmount: BN
): SwapQuote {
  // AMM formula: x * y = k
  // sol_out = (tokens_in * sol_reserves) / (token_reserves + tokens_in)
  const solOutBeforeFee = tokenAmount
    .mul(curve.virtualSolReserves)
    .div(curve.virtualTokenReserves.add(tokenAmount));
  
  const fee = solOutBeforeFee.mul(new BN(BONDING_CURVE_CONSTANTS.FEE_BASIS_POINTS)).div(new BN(10000));
  const solOut = solOutBeforeFee.sub(fee);
  
  const priceImpact = calculatePriceImpact(
    tokenAmount,
    solOut,
    curve.virtualTokenReserves,
    curve.virtualSolReserves
  );
  
  return {
    inputAmount: tokenAmount,
    outputAmount: solOut,
    priceImpact,
    fee,
  };
}

function calculatePriceImpact(
  inputAmount: BN,
  outputAmount: BN,
  inputReserve: BN,
  outputReserve: BN
): number {
  const spotPrice = outputReserve.mul(new BN(1e9)).div(inputReserve);
  const executionPrice = outputAmount.mul(new BN(1e9)).div(inputAmount);
  const impact = spotPrice.sub(executionPrice).mul(new BN(10000)).div(spotPrice);
  return impact.toNumber() / 100; // Return as percentage
}

/**
 * Calculate bonding curve market cap
 */
export function calculateMarketCap(curve: BondingCurveData): BN {
  return curve.virtualSolReserves
    .mul(curve.tokenTotalSupply)
    .div(curve.virtualTokenReserves);
}

// ============================================================================
// PUMP.FUN SERVICE
// ============================================================================

export class PumpFunService {
  private connection: Connection;
  private logger: any;

  constructor(config: PumpFunConfig, logger?: any) {
    this.connection = new Connection(config.rpcUrl, config.commitment || "confirmed");
    this.logger = logger || console;
  }

  /**
   * Get a random fee recipient for better TX throughput
   */
  getRandomFeeRecipient(isMayhemMode: boolean = false): PublicKey {
    const recipients = isMayhemMode ? MAYHEM_FEE_RECIPIENTS : FEE_RECIPIENTS;
    return recipients[Math.floor(Math.random() * recipients.length)];
  }

  /**
   * Fetch and parse bonding curve account data
   */
  async getBondingCurve(mint: PublicKey): Promise<BondingCurveData | null> {
    const [bondingCurvePDA] = getBondingCurvePDA(mint);
    
    try {
      const accountInfo = await this.connection.getAccountInfo(bondingCurvePDA);
      if (!accountInfo || accountInfo.data.length < 82) {
        return null;
      }
      
      const data = accountInfo.data;
      let offset = 8; // Skip discriminator
      
      const virtualTokenReserves = new BN(data.slice(offset, offset + 8), "le");
      offset += 8;
      const virtualSolReserves = new BN(data.slice(offset, offset + 8), "le");
      offset += 8;
      const realTokenReserves = new BN(data.slice(offset, offset + 8), "le");
      offset += 8;
      const realSolReserves = new BN(data.slice(offset, offset + 8), "le");
      offset += 8;
      const tokenTotalSupply = new BN(data.slice(offset, offset + 8), "le");
      offset += 8;
      const complete = data[offset] === 1;
      offset += 1;
      const creator = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      const isMayhemMode = data.length > offset && data[offset] === 1;
      
      return {
        virtualTokenReserves,
        virtualSolReserves,
        realTokenReserves,
        realSolReserves,
        tokenTotalSupply,
        complete,
        creator,
        isMayhemMode,
      };
    } catch (error) {
      this.logger.error(`[PumpFun] Error fetching bonding curve: ${error}`);
      return null;
    }
  }

  /**
   * Get quote for buying tokens
   */
  async getBuyQuote(mint: PublicKey, solAmount: number): Promise<SwapQuote | null> {
    const curve = await this.getBondingCurve(mint);
    if (!curve || curve.complete) {
      return null;
    }
    
    const solLamports = new BN(solAmount * LAMPORTS_PER_SOL);
    return calculateBuyTokens(curve, solLamports);
  }

  /**
   * Get quote for selling tokens
   */
  async getSellQuote(mint: PublicKey, tokenAmount: BN): Promise<SwapQuote | null> {
    const curve = await this.getBondingCurve(mint);
    if (!curve || curve.complete) {
      return null;
    }
    
    return calculateSellTokens(curve, tokenAmount);
  }

  /**
   * Create token launch transaction (create_v2)
   */
  async createTokenLaunchTx(
    params: TokenLaunchParams,
    mintKeypair: Keypair
  ): Promise<Transaction> {
    const [mintAuthority] = getMintAuthority();
    const [bondingCurve] = getBondingCurvePDA(mintKeypair.publicKey);
    
    // Get associated token account for bonding curve (Token2022)
    const associatedBondingCurve = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      bondingCurve,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Build instruction data
    const nameBuffer = Buffer.from(params.name.slice(0, 32).padEnd(32, "\0"));
    const symbolBuffer = Buffer.from(params.symbol.slice(0, 10).padEnd(10, "\0"));
    const uriBuffer = Buffer.from(params.uri);
    
    // Instruction discriminator for create_v2 (first 8 bytes of SHA256("global:create_v2"))
    const discriminator = Buffer.from([0x76, 0x6b, 0x33, 0xd3, 0x9d, 0x45, 0x7a, 0xa9]);
    
    const dataLength = 8 + 4 + nameBuffer.length + 4 + symbolBuffer.length + 4 + uriBuffer.length;
    const data = Buffer.alloc(dataLength);
    let offset = 0;
    
    discriminator.copy(data, offset);
    offset += 8;
    
    // Name (length-prefixed string)
    data.writeUInt32LE(params.name.length, offset);
    offset += 4;
    Buffer.from(params.name).copy(data, offset);
    offset += params.name.length;
    
    // Symbol (length-prefixed string)
    data.writeUInt32LE(params.symbol.length, offset);
    offset += 4;
    Buffer.from(params.symbol).copy(data, offset);
    offset += params.symbol.length;
    
    // URI (length-prefixed string)
    data.writeUInt32LE(params.uri.length, offset);
    offset += 4;
    Buffer.from(params.uri).copy(data, offset);
    
    const accounts: any[] = [
      { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: params.creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    // Add Mayhem accounts if mayhem mode
    if (params.isMayhemMode) {
      const [mayhemState] = getMayhemStatePDA(mintKeypair.publicKey);
      accounts.push(
        { pubkey: MAYHEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MAYHEM_GLOBAL_PARAMS, isSigner: false, isWritable: false },
        { pubkey: MAYHEM_SOL_VAULT, isSigner: false, isWritable: true },
        { pubkey: mayhemState, isSigner: false, isWritable: true },
      );
    }
    
    const createIx = new TransactionInstruction({
      keys: accounts,
      programId: PUMP_PROGRAM_ID,
      data: data.slice(0, offset + uriBuffer.length),
    });
    
    const tx = new Transaction();
    
    // Add compute budget for reliability
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
    );
    
    tx.add(createIx);
    
    return tx;
  }

  /**
   * Create buy transaction on bonding curve
   */
  async createBuyTx(params: BuyParams): Promise<Transaction> {
    const [bondingCurve] = getBondingCurvePDA(params.mint);
    
    // Get user's associated token account
    const userTokenAccount = await getAssociatedTokenAddress(
      params.mint,
      params.user,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Get bonding curve's associated token account
    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      params.mint,
      bondingCurve,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Fetch curve to check mayhem mode
    const curve = await this.getBondingCurve(params.mint);
    const feeRecipient = this.getRandomFeeRecipient(curve?.isMayhemMode || false);
    
    // Instruction discriminator for buy
    const discriminator = Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);
    
    const data = Buffer.alloc(8 + 8 + 8);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.solAmount.toString()), 8);
    data.writeBigUInt64LE(BigInt(params.minTokensOut.toString()), 16);
    
    const accounts = [
      { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    const buyIx = new TransactionInstruction({
      keys: accounts,
      programId: PUMP_PROGRAM_ID,
      data,
    });
    
    const tx = new Transaction();
    
    // Add compute budget
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
    );
    
    // Create ATA if it doesn't exist
    const ataInfo = await this.connection.getAccountInfo(userTokenAccount);
    if (!ataInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          params.user,
          userTokenAccount,
          params.user,
          params.mint,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }
    
    tx.add(buyIx);
    
    return tx;
  }

  /**
   * Create sell transaction on bonding curve
   */
  async createSellTx(params: SellParams): Promise<Transaction> {
    const [bondingCurve] = getBondingCurvePDA(params.mint);
    
    // Get user's associated token account
    const userTokenAccount = await getAssociatedTokenAddress(
      params.mint,
      params.user,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Get bonding curve's associated token account
    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      params.mint,
      bondingCurve,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Fetch curve to check mayhem mode
    const curve = await this.getBondingCurve(params.mint);
    const feeRecipient = this.getRandomFeeRecipient(curve?.isMayhemMode || false);
    
    // Instruction discriminator for sell
    const discriminator = Buffer.from([0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]);
    
    const data = Buffer.alloc(8 + 8 + 8);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.tokenAmount.toString()), 8);
    data.writeBigUInt64LE(BigInt(params.minSolOut.toString()), 16);
    
    const accounts = [
      { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    const sellIx = new TransactionInstruction({
      keys: accounts,
      programId: PUMP_PROGRAM_ID,
      data,
    });
    
    const tx = new Transaction();
    
    // Add compute budget
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
    );
    
    tx.add(sellIx);
    
    return tx;
  }

  /**
   * Create collect creator fee transaction
   */
  async createCollectCreatorFeeTx(creator: PublicKey): Promise<Transaction> {
    const [creatorVault] = getCreatorVaultPDA(creator);
    
    // Instruction discriminator for collectCreatorFee
    const discriminator = Buffer.from([0x1c, 0x07, 0x17, 0xd4, 0x82, 0x63, 0x51, 0x9e]);
    
    const accounts = [
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const collectIx = new TransactionInstruction({
      keys: accounts,
      programId: PUMP_PROGRAM_ID,
      data: discriminator,
    });
    
    const tx = new Transaction();
    tx.add(collectIx);
    
    return tx;
  }

  /**
   * Check claimable creator fees
   */
  async getClaimableCreatorFees(creator: PublicKey): Promise<number> {
    const [creatorVault] = getCreatorVaultPDA(creator);
    
    try {
      const balance = await this.connection.getBalance(creatorVault);
      // Leave minimum rent-exempt balance
      const rentExempt = await this.connection.getMinimumBalanceForRentExemption(0);
      return Math.max(0, (balance - rentExempt) / LAMPORTS_PER_SOL);
    } catch {
      return 0;
    }
  }

  /**
   * Check if bonding curve is complete (ready for migration)
   */
  async isBondingCurveComplete(mint: PublicKey): Promise<boolean> {
    const curve = await this.getBondingCurve(mint);
    return curve?.complete || false;
  }

  /**
   * Get current token price from bonding curve
   */
  async getTokenPrice(mint: PublicKey): Promise<number | null> {
    const curve = await this.getBondingCurve(mint);
    if (!curve) return null;
    
    // Price = SOL reserves / Token reserves
    const price = curve.virtualSolReserves
      .mul(new BN(1e9))
      .div(curve.virtualTokenReserves);
    
    return price.toNumber() / 1e9 / LAMPORTS_PER_SOL;
  }

  /**
   * Get bonding curve progress (percentage to graduation)
   */
  async getBondingCurveProgress(mint: PublicKey): Promise<number | null> {
    const curve = await this.getBondingCurve(mint);
    if (!curve) return null;
    
    if (curve.complete) return 100;
    
    // Progress based on real SOL reserves vs target (~85 SOL to graduate)
    const targetSol = new BN(85 * LAMPORTS_PER_SOL);
    const progress = curve.realSolReserves
      .mul(new BN(100))
      .div(targetSol);
    
    return Math.min(100, progress.toNumber());
  }
}

export default PumpFunService;
