/**
 * Solana Wallet Tools for Coinbase CDP
 */

import type { CdpService, SolanaFaucetToken } from "../services/cdp-service.js";
import type { ClawdbotTool } from "../types/index.js";

export function createSolanaTools(cdpService: CdpService): Record<string, ClawdbotTool> {
  return {
    cdp_create_solana_wallet: {
      name: "cdp_create_solana_wallet",
      description: "Create a new Solana wallet using Coinbase CDP. Optionally provide a name for easy retrieval later. The wallet can be used on Solana mainnet and devnet.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Optional human-readable name for the wallet (2-36 alphanumeric characters and hyphens)",
          },
        },
        required: [],
      },
      execute: async (params) => {
        const name = params.name as string | undefined;
        const wallet = await cdpService.createSolanaAccount(name);
        return {
          success: true,
          wallet: {
            type: wallet.type,
            address: wallet.address,
            name: wallet.name,
          },
          message: `Created Solana wallet: ${wallet.address}${name ? ` (${name})` : ""}`,
        };
      },
    },

    cdp_get_solana_wallet: {
      name: "cdp_get_solana_wallet",
      description: "Get or create a Solana wallet by name. If the wallet already exists, it returns the existing one. If not, it creates a new one with the given name.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the wallet to get or create",
          },
        },
        required: ["name"],
      },
      execute: async (params) => {
        const name = params.name as string;
        const wallet = await cdpService.getOrCreateSolanaAccount(name);
        return {
          success: true,
          wallet: {
            type: wallet.type,
            address: wallet.address,
            name: wallet.name,
          },
          message: `Solana wallet "${name}": ${wallet.address}`,
        };
      },
    },

    cdp_list_solana_wallets: {
      name: "cdp_list_solana_wallets",
      description: "List all Solana wallets managed by Coinbase CDP for this project.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async () => {
        const wallets = await cdpService.listSolanaAccounts();
        return {
          success: true,
          count: wallets.length,
          wallets: wallets.map((w) => ({
            type: w.type,
            address: w.address,
            name: w.name,
          })),
        };
      },
    },

    cdp_solana_faucet: {
      name: "cdp_solana_faucet",
      description: "Request devnet SOL for a Solana wallet. Only works on Solana devnet.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The Solana wallet address to fund",
          },
          token: {
            type: "string",
            description: "The token to request (default: sol)",
            enum: ["sol"],
          },
        },
        required: ["address"],
      },
      execute: async (params) => {
        const address = params.address as string;
        const token = (params.token as SolanaFaucetToken) || "sol";

        const signature = await cdpService.requestSolanaFaucet(address, token);

        return {
          success: true,
          signature,
          network: "solana-devnet",
          token,
          explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
          message: `Requested ${token} on Solana devnet for ${address}`,
        };
      },
    },

    cdp_sign_solana_message: {
      name: "cdp_sign_solana_message",
      description: "Sign an arbitrary message with a Solana wallet. Useful for authentication or off-chain verification.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The Solana wallet address to sign with",
          },
          message: {
            type: "string",
            description: "The message to sign",
          },
        },
        required: ["address", "message"],
      },
      execute: async (params) => {
        const address = params.address as string;
        const message = params.message as string;

        const signature = await cdpService.signSolanaMessage(address, message);

        return {
          success: true,
          signature,
          address,
          message: `Signed message with ${address}`,
        };
      },
    },

    cdp_sign_solana_transaction: {
      name: "cdp_sign_solana_transaction",
      description: "Sign a Solana transaction. The transaction should be serialized as base64. This only signs - you need to submit separately.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The Solana wallet address to sign with",
          },
          transaction: {
            type: "string",
            description: "The base64-encoded serialized transaction to sign",
          },
        },
        required: ["address", "transaction"],
      },
      execute: async (params) => {
        const address = params.address as string;
        const transaction = params.transaction as string;

        const signedTx = await cdpService.signSolanaTransaction(address, transaction);

        return {
          success: true,
          signedTransaction: signedTx,
          address,
          message: `Signed transaction with ${address}`,
        };
      },
    },
  };
}
