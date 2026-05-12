/**
 * NanoClawd Wallet MCP tools.
 *
 * Self-custodial Solana wallet that is generated on first use and
 * persisted to /workspace/agent/.wallet/keypair.json (the agent group's
 * private RW volume). Every agent group gets its own keypair at birth.
 *
 * Tools:
 *   wallet_info     — addresses + network + creation date
 *   wallet_balance  — SOL + token balances
 *   wallet_send     — send SOL to an address
 *   wallet_swap     — swap tokens via Jupiter v6
 *   wallet_quote    — get a swap quote without executing
 */
import { getKeypair, getPublicKey, initWallet } from '../wallet/init.js';
import {
  executeSwap,
  getSwapQuote,
  getWalletBalance,
  resolveTokenMint,
  sendSol,
} from '../wallet/solana.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

const tools: McpToolDefinition[] = [
  {
    tool: {
      name: 'wallet_info',
      description:
        'Get your NanoClawd Wallet addresses, network, and creation date. ' +
        'Creates the wallet automatically on first call.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    async handler(_args) {
      try {
        const { data, isNew } = initWallet();
        const rpc = process.env.NANOCLAWD_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
        const network = rpc.includes('devnet') ? 'devnet' : rpc.includes('testnet') ? 'testnet' : 'mainnet-beta';
        const lines = [
          isNew ? '⬡ New NanoClawd Wallet created!' : '⬡ NanoClawd Wallet',
          '',
          `Solana address : ${data.solana.publicKey}`,
          `Network        : ${network}`,
          `Created        : ${data.created}`,
          '',
          'Use wallet_balance to check balances.',
          'Use wallet_send to send SOL.',
          'Use wallet_swap to swap tokens via Jupiter.',
        ];
        return ok(lines.join('\n'));
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  },

  {
    tool: {
      name: 'wallet_balance',
      description: 'Get your NanoClawd Wallet SOL and token balances.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    async handler(_args) {
      try {
        const pubkey = getPublicKey();
        const { sol, tokens } = await getWalletBalance(pubkey);
        const lines = [
          `⬡ NanoClawd Wallet — ${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`,
          '',
          `SOL : ${sol.toFixed(6)}`,
        ];
        if (tokens.length > 0) {
          lines.push('');
          lines.push('Tokens:');
          for (const t of tokens) {
            lines.push(`  ${t.symbol.padEnd(8)} ${t.uiAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })}`);
          }
        } else {
          lines.push('No token balances.');
        }
        return ok(lines.join('\n'));
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  },

  {
    tool: {
      name: 'wallet_send',
      description: 'Send SOL from your NanoClawd Wallet to another address.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient Solana address (base58)' },
          amount_sol: { type: 'number', description: 'Amount of SOL to send' },
        },
        required: ['to', 'amount_sol'],
      },
    },
    async handler(args) {
      const to = args['to'] as string;
      const amount = args['amount_sol'] as number;
      if (!to || typeof to !== 'string') return err('Missing "to" address.');
      if (!amount || typeof amount !== 'number' || amount <= 0) return err('Invalid amount_sol.');
      try {
        const keypair = getKeypair();
        const sig = await sendSol(keypair, to, amount);
        return ok(`Sent ${amount} SOL to ${to}\nSignature: ${sig}`);
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  },

  {
    tool: {
      name: 'wallet_quote',
      description:
        'Get a Jupiter swap quote for your NanoClawd Wallet without executing. ' +
        'Use token symbols (SOL, USDC, CLAWD) or mint addresses.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Input token symbol or mint address' },
          to: { type: 'string', description: 'Output token symbol or mint address' },
          amount: { type: 'number', description: 'Input amount (in token units, e.g. 1.5 for 1.5 SOL)' },
          slippage_bps: {
            type: 'number',
            description: 'Slippage tolerance in basis points (default: 50 = 0.5%)',
          },
        },
        required: ['from', 'to', 'amount'],
      },
    },
    async handler(args) {
      const fromSym = args['from'] as string;
      const toSym = args['to'] as string;
      const amount = args['amount'] as number;
      const slippageBps = typeof args['slippage_bps'] === 'number' ? args['slippage_bps'] : 50;

      try {
        const [fromMint, toMint] = await Promise.all([
          resolveTokenMint(fromSym),
          resolveTokenMint(toSym),
        ]);
        if (!fromMint) return err(`Unknown token: ${fromSym}`);
        if (!toMint) return err(`Unknown token: ${toSym}`);

        // Convert amount to smallest unit
        // SOL = 9 decimals, USDC = 6
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const decimalsMap: Record<string, number> = {
          [SOL_MINT]: 9,
          [USDC_MINT]: 6,
        };
        const fromDecimals = decimalsMap[fromMint] ?? 6;
        const amountRaw = Math.round(amount * Math.pow(10, fromDecimals));

        const quote = await getSwapQuote(fromMint, toMint, amountRaw, slippageBps);
        const toDecimals = decimalsMap[toMint] ?? 6;
        const outAmount = Number(quote.outputAmount) / Math.pow(10, toDecimals);

        return ok(
          [
            `Quote: ${amount} ${fromSym} → ~${outAmount.toFixed(6)} ${toSym}`,
            `Price impact: ${(quote.priceImpactPct * 100).toFixed(4)}%`,
            `Slippage: ${slippageBps / 100}%`,
            '',
            'Use wallet_swap with the same parameters to execute.',
          ].join('\n'),
        );
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  },

  {
    tool: {
      name: 'wallet_swap',
      description:
        'Swap tokens via Jupiter on your NanoClawd Wallet. ' +
        'Use token symbols (SOL, USDC, CLAWD) or mint addresses. ' +
        'Always get a wallet_quote first to confirm the rate.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Input token symbol or mint address' },
          to: { type: 'string', description: 'Output token symbol or mint address' },
          amount: { type: 'number', description: 'Input amount in token units (e.g. 1.5 for 1.5 SOL)' },
          slippage_bps: {
            type: 'number',
            description: 'Slippage tolerance in basis points (default: 50 = 0.5%)',
          },
        },
        required: ['from', 'to', 'amount'],
      },
    },
    async handler(args) {
      const fromSym = args['from'] as string;
      const toSym = args['to'] as string;
      const amount = args['amount'] as number;
      const slippageBps = typeof args['slippage_bps'] === 'number' ? args['slippage_bps'] : 50;

      try {
        const [fromMint, toMint] = await Promise.all([
          resolveTokenMint(fromSym),
          resolveTokenMint(toSym),
        ]);
        if (!fromMint) return err(`Unknown token: ${fromSym}`);
        if (!toMint) return err(`Unknown token: ${toSym}`);

        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const decimalsMap: Record<string, number> = { [SOL_MINT]: 9, [USDC_MINT]: 6 };
        const fromDecimals = decimalsMap[fromMint] ?? 6;
        const amountRaw = Math.round(amount * Math.pow(10, fromDecimals));

        const JUPITER_QUOTE = 'https://quote-api.jup.ag/v6/quote';
        const quoteUrl = new URL(JUPITER_QUOTE);
        quoteUrl.searchParams.set('inputMint', fromMint);
        quoteUrl.searchParams.set('outputMint', toMint);
        quoteUrl.searchParams.set('amount', String(amountRaw));
        quoteUrl.searchParams.set('slippageBps', String(slippageBps));

        const quoteResp = await fetch(quoteUrl.toString());
        if (!quoteResp.ok) {
          const body = await quoteResp.text();
          return err(`Jupiter quote failed: ${quoteResp.status} — ${body}`);
        }
        const rawQuote = await quoteResp.json() as Record<string, unknown>;

        const toDecimals = decimalsMap[toMint] ?? 6;
        const outAmount = Number(rawQuote.outAmount as string) / Math.pow(10, toDecimals);

        const keypair = getKeypair();
        const swapQuote = {
          inputMint: fromMint,
          outputMint: toMint,
          inputAmount: String(amountRaw),
          outputAmount: rawQuote.outAmount as string,
          priceImpactPct: Number(rawQuote.priceImpactPct ?? 0),
          routePlan: rawQuote.routePlan as unknown[],
          _raw: rawQuote,
        };

        const sig = await executeSwap(keypair, swapQuote);
        return ok(
          [
            `Swapped ${amount} ${fromSym} → ~${outAmount.toFixed(6)} ${toSym}`,
            `Signature: ${sig}`,
            `Explorer: https://solscan.io/tx/${sig}`,
          ].join('\n'),
        );
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  },
];

registerTools(tools);
