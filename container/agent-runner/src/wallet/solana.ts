/**
 * NanoClawd Wallet — Solana operations.
 *
 * Uses the RPC at NANOCLAWD_SOLANA_RPC (default: mainnet-beta).
 * For swaps, delegates to Jupiter v6 API (no API key required).
 */
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

import type { SwapQuote, TokenBalance, WalletBalance } from './types.js';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
const JUPITER_QUOTE = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP = 'https://quote-api.jup.ag/v6/swap';

const KNOWN_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  So11111111111111111111111111111111111111112: { symbol: 'SOL', name: 'Wrapped SOL', decimals: 9 },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'ETH', name: 'Wrapped Ether (Wormhole)', decimals: 8 },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: { symbol: 'mSOL', name: 'Marinade staked SOL', decimals: 9 },
  '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump': { symbol: 'CLAWD', name: '$CLAWD', decimals: 6 },
};

function getConnection(): Connection {
  const rpc = process.env.NANOCLAWD_SOLANA_RPC ?? DEFAULT_RPC;
  return new Connection(rpc, 'confirmed');
}

export async function getSolBalance(pubkey: string): Promise<number> {
  const conn = getConnection();
  const lamports = await conn.getBalance(new PublicKey(pubkey));
  return lamports / LAMPORTS_PER_SOL;
}

export async function getTokenBalances(pubkey: string): Promise<TokenBalance[]> {
  const conn = getConnection();
  const resp = await conn.getParsedTokenAccountsByOwner(new PublicKey(pubkey), {
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  });

  const balances: TokenBalance[] = [];
  for (const { account } of resp.value) {
    const info = account.data.parsed?.info;
    if (!info) continue;
    const mint = info.mint as string;
    const raw = info.tokenAmount?.amount as string;
    const uiAmount = info.tokenAmount?.uiAmount as number ?? 0;
    const decimals = info.tokenAmount?.decimals as number ?? 0;
    if (uiAmount === 0) continue;
    const known = KNOWN_TOKENS[mint];
    balances.push({
      mint,
      symbol: known?.symbol ?? mint.slice(0, 6) + '…',
      name: known?.name ?? 'Unknown Token',
      decimals: known?.decimals ?? decimals,
      amount: raw,
      uiAmount,
    });
  }
  return balances;
}

export async function getWalletBalance(pubkey: string): Promise<WalletBalance> {
  const [sol, tokens] = await Promise.all([getSolBalance(pubkey), getTokenBalances(pubkey)]);
  return { sol, tokens };
}

export async function sendSol(
  keypair: Keypair,
  toAddress: string,
  amountSol: number,
): Promise<string> {
  const conn = getConnection();
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports,
    }),
  );
  const sig = await sendAndConfirmTransaction(conn, tx, [keypair]);
  return sig;
}

export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps = 50,
): Promise<SwapQuote> {
  const url = new URL(JUPITER_QUOTE);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', String(amountLamports));
  url.searchParams.set('slippageBps', String(slippageBps));

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Jupiter quote failed: ${resp.status} — ${body}`);
  }
  const data = await resp.json() as Record<string, unknown>;
  return {
    inputMint: data.inputMint as string,
    outputMint: data.outputMint as string,
    inputAmount: data.inAmount as string,
    outputAmount: data.outAmount as string,
    priceImpactPct: Number(data.priceImpactPct ?? 0),
    routePlan: data.routePlan as unknown[],
  };
}

export async function executeSwap(
  keypair: Keypair,
  quote: SwapQuote & { _raw: unknown },
): Promise<string> {
  const resp = await fetch(JUPITER_SWAP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote._raw,
      userPublicKey: keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Jupiter swap failed: ${resp.status} — ${body}`);
  }

  const { swapTransaction } = await resp.json() as { swapTransaction: string };

  const conn = getConnection();
  const txBuf = Buffer.from(swapTransaction, 'base64');

  // Deserialize, sign, and send
  const { VersionedTransaction } = await import('@solana/web3.js');
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([keypair]);
  const sig = await conn.sendTransaction(tx);
  await conn.confirmTransaction(sig, 'confirmed');
  return sig;
}

export async function resolveTokenMint(symbolOrMint: string): Promise<string | null> {
  const upper = symbolOrMint.toUpperCase();
  for (const [mint, info] of Object.entries(KNOWN_TOKENS)) {
    if (info.symbol.toUpperCase() === upper) return mint;
  }
  // Try as a raw mint address
  try {
    new PublicKey(symbolOrMint);
    return symbolOrMint;
  } catch {
    return null;
  }
}
