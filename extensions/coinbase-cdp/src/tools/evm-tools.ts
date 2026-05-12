/**
 * EVM Wallet Tools for Coinbase CDP
 */

import type { CdpService, EvmFaucetNetwork, EvmTransactionNetwork } from "../services/cdp-service.js";
import type { ClawdbotTool } from "../types/index.js";

export function createEvmTools(cdpService: CdpService): Record<string, ClawdbotTool> {
  return {
    cdp_create_evm_wallet: {
      name: "cdp_create_evm_wallet",
      description: "Create a new EVM (Ethereum-compatible) wallet using Coinbase CDP. Optionally provide a name for easy retrieval later. The wallet can be used on Base, Ethereum, Arbitrum, Optimism, and other EVM chains.",
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
        const wallet = await cdpService.createEvmAccount(name);
        return {
          success: true,
          wallet: {
            type: wallet.type,
            address: wallet.address,
            name: wallet.name,
          },
          message: `Created EVM wallet: ${wallet.address}${name ? ` (${name})` : ""}`,
        };
      },
    },

    cdp_get_evm_wallet: {
      name: "cdp_get_evm_wallet",
      description: "Get or create an EVM wallet by name. If the wallet already exists, it returns the existing one. If not, it creates a new one with the given name.",
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
        const wallet = await cdpService.getOrCreateEvmAccount(name);
        return {
          success: true,
          wallet: {
            type: wallet.type,
            address: wallet.address,
            name: wallet.name,
          },
          message: `EVM wallet "${name}": ${wallet.address}`,
        };
      },
    },

    cdp_list_evm_wallets: {
      name: "cdp_list_evm_wallets",
      description: "List all EVM wallets managed by Coinbase CDP for this project.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async () => {
        const wallets = await cdpService.listEvmAccounts();
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

    cdp_evm_faucet: {
      name: "cdp_evm_faucet",
      description: "Request testnet funds for an EVM wallet. Supports Base Sepolia (default) and Ethereum Sepolia testnets.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The EVM wallet address to fund",
          },
          network: {
            type: "string",
            description: "The testnet network (default: base-sepolia). Options: base-sepolia, ethereum-sepolia",
          },
          token: {
            type: "string",
            description: "The token to request (default: eth). Options: eth, usdc, eurc, cbbtc",
          },
        },
        required: ["address"],
      },
      execute: async (params) => {
        const address = params.address as string;
        const network = (params.network as EvmFaucetNetwork) || "base-sepolia";
        const token = (params.token as string) || "eth";

        const txHash = await cdpService.requestEvmFaucet(address, network);

        const explorerUrl =
          network === "base-sepolia"
            ? `https://sepolia.basescan.org/tx/${txHash}`
            : `https://sepolia.etherscan.io/tx/${txHash}`;

        return {
          success: true,
          transactionHash: txHash,
          network,
          token,
          explorerUrl,
          message: `Requested ${token} on ${network} for ${address}`,
        };
      },
    },

    cdp_send_evm_transaction: {
      name: "cdp_send_evm_transaction",
      description: "Send an EVM transaction from a CDP-managed wallet. Can send ETH or interact with contracts.",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "The sender wallet address",
          },
          to: {
            type: "string",
            description: "The recipient address",
          },
          value: {
            type: "string",
            description: "The amount to send in wei (e.g., '1000000000000000' for 0.001 ETH)",
          },
          network: {
            type: "string",
            description: "The network to use (default: base-sepolia). Options: base-sepolia, base, ethereum-sepolia, ethereum",
          },
        },
        required: ["from", "to", "value"],
      },
      execute: async (params) => {
        const from = params.from as string;
        const to = params.to as string;
        const value = params.value as string;
        const network = (params.network as EvmTransactionNetwork) || "base-sepolia";

        const txHash = await cdpService.sendEvmTransaction(from, to, value, network);

        const explorerBase =
          network === "base-sepolia"
            ? "https://sepolia.basescan.org"
            : network === "base"
              ? "https://basescan.org"
              : network === "ethereum-sepolia"
                ? "https://sepolia.etherscan.io"
                : "https://etherscan.io";

        return {
          success: true,
          transactionHash: txHash,
          explorerUrl: `${explorerBase}/tx/${txHash}`,
          message: `Sent ${value} wei from ${from} to ${to} on ${network}`,
        };
      },
    },

    cdp_create_smart_account: {
      name: "cdp_create_smart_account",
      description: "Create an ERC-4337 Smart Account owned by an existing EVM wallet. Smart accounts support gas sponsorship and batch transactions.",
      parameters: {
        type: "object",
        properties: {
          owner_address: {
            type: "string",
            description: "The EVM wallet address that will own this smart account",
          },
          name: {
            type: "string",
            description: "Optional human-readable name for the smart account",
          },
        },
        required: ["owner_address"],
      },
      execute: async (params) => {
        const ownerAddress = params.owner_address as string;
        const name = params.name as string | undefined;

        const wallet = await cdpService.createSmartAccount(ownerAddress, name);

        return {
          success: true,
          smartAccount: {
            type: wallet.type,
            address: wallet.address,
            name: wallet.name,
            ownerAddress,
          },
          message: `Created Smart Account: ${wallet.address}${name ? ` (${name})` : ""} owned by ${ownerAddress}`,
        };
      },
    },
  };
}
