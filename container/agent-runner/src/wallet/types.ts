export interface WalletData {
  version: 1;
  created: string;
  agentGroupId: string;
  solana: {
    secretKey: number[];
    publicKey: string;
  };
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  amount: string;
  uiAmount: number;
}

export interface WalletBalance {
  sol: number;
  tokens: TokenBalance[];
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  priceImpactPct: number;
  routePlan: unknown[];
}
