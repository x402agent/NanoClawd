import type { Logger } from "../types.js";

const JUPITER_API = "https://quote-api.jup.ag/v6";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  onlyDirectRoutes?: boolean;
}

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapParams {
  quoteResponse: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  computeUnitPriceMicroLamports?: number;
  dynamicComputeUnitLimit?: boolean;
}

export interface SwapTransactionResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
}

export interface JupiterServiceConfig {
  defaultSlippageBps: number;
  defaultPriorityFeeMicroLamports: number;
  maxPriorityFeeMicroLamports: number;
  maxRetries: number;
  maxPriceImpactPct: number;
}

const DEFAULT_CONFIG: JupiterServiceConfig = {
  defaultSlippageBps: 100, // 1%
  defaultPriorityFeeMicroLamports: 5000,
  maxPriorityFeeMicroLamports: 100000,
  maxRetries: 3,
  maxPriceImpactPct: 5,
};

export class JupiterService {
  private config: JupiterServiceConfig;
  private logger: Logger;
  private requestCount = 0;
  private lastRequestReset = Date.now();
  private readonly rateLimit = 60; // requests per minute

  constructor(logger: Logger, config?: Partial<JupiterServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger;
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRequestReset > 60000) {
      this.requestCount = 0;
      this.lastRequestReset = now;
    }

    if (this.requestCount >= this.rateLimit) {
      const waitTime = 60000 - (now - this.lastRequestReset);
      this.logger.warn(`[jupiter] Rate limited, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestReset = Date.now();
    }

    this.requestCount++;
  }

  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    await this.checkRateLimit();

    const url = new URL(`${JUPITER_API}/quote`);
    url.searchParams.set("inputMint", params.inputMint);
    url.searchParams.set("outputMint", params.outputMint);
    url.searchParams.set("amount", params.amount);
    url.searchParams.set("slippageBps", params.slippageBps.toString());

    if (params.onlyDirectRoutes !== undefined) {
      url.searchParams.set("onlyDirectRoutes", params.onlyDirectRoutes.toString());
    }

    this.logger.debug(`[jupiter] Getting quote: ${url.toString()}`);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Quote failed: ${response.status} - ${errorText}`);
    }

    const quote = (await response.json()) as QuoteResponse;

    // Check price impact
    const priceImpact = parseFloat(quote.priceImpactPct);
    if (priceImpact > this.config.maxPriceImpactPct) {
      this.logger.warn(
        `[jupiter] High price impact: ${priceImpact}% (max: ${this.config.maxPriceImpactPct}%)`
      );
    }

    return quote;
  }

  async getSwapTransaction(params: SwapParams): Promise<SwapTransactionResponse> {
    await this.checkRateLimit();

    const response = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: params.quoteResponse,
        userPublicKey: params.userPublicKey,
        wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
        computeUnitPriceMicroLamports:
          params.computeUnitPriceMicroLamports ?? this.config.defaultPriorityFeeMicroLamports,
        dynamicComputeUnitLimit: params.dynamicComputeUnitLimit ?? true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Swap transaction failed: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as SwapTransactionResponse;
  }

  async buildSwapTransaction(
    inputMint: string,
    outputMint: string,
    amountLamports: string,
    userPublicKey: string,
    slippageBps?: number,
    priorityFeeMicroLamports?: number
  ): Promise<{ swapTransaction: string; quote: QuoteResponse }> {
    // Get quote
    const quote = await this.getQuote({
      inputMint,
      outputMint,
      amount: amountLamports,
      slippageBps: slippageBps ?? this.config.defaultSlippageBps,
    });

    // Get swap transaction
    const { swapTransaction } = await this.getSwapTransaction({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports:
        priorityFeeMicroLamports ?? this.config.defaultPriorityFeeMicroLamports,
    });

    return { swapTransaction, quote };
  }

  // Convenience method for SOL -> Token swaps
  async buildBuyTransaction(
    tokenMint: string,
    solAmount: number,
    userPublicKey: string,
    slippageBps?: number
  ): Promise<{ swapTransaction: string; quote: QuoteResponse }> {
    const lamports = Math.floor(solAmount * 1e9).toString();
    return this.buildSwapTransaction(
      SOL_MINT,
      tokenMint,
      lamports,
      userPublicKey,
      slippageBps
    );
  }

  // Convenience method for Token -> SOL swaps
  async buildSellTransaction(
    tokenMint: string,
    tokenAmount: string,
    userPublicKey: string,
    slippageBps?: number
  ): Promise<{ swapTransaction: string; quote: QuoteResponse }> {
    return this.buildSwapTransaction(
      tokenMint,
      SOL_MINT,
      tokenAmount,
      userPublicKey,
      slippageBps
    );
  }

  getConfig(): JupiterServiceConfig {
    return { ...this.config };
  }
}

// Export singleton instance factory
let jupiterInstance: JupiterService | null = null;

export function getJupiterService(
  logger: Logger,
  config?: Partial<JupiterServiceConfig>
): JupiterService {
  if (!jupiterInstance) {
    jupiterInstance = new JupiterService(logger, config);
  }
  return jupiterInstance;
}
