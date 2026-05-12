# Vibe Bot by Clawd

<p align="center">
  <img src="https://raw.githubusercontent.com/clawdbot/clawdbot/main/docs/vibe-bot-banner.png" alt="Vibe Bot" width="600">
</p>

<p align="center">
  <strong>The chillest Solana agent on the blockchain</strong><br>
  <em>Inspired by the penguin. Powered by the lobster.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@clawdbot/solana-agent"><img src="https://img.shields.io/npm/v/@clawdbot/solana-agent?style=for-the-badge" alt="npm version"></a>
  <a href="https://github.com/clawdbot/clawdbot"><img src="https://img.shields.io/badge/Clawdbot-Extension-FF4500?style=for-the-badge" alt="Clawdbot Extension"></a>
  <a href="https://solana.com"><img src="https://img.shields.io/badge/Solana-Mainnet-9945FF?style=for-the-badge" alt="Solana"></a>
</p>

---

**Vibe Bot** is a Solana-native AI agent extension for [Clawdbot](https://github.com/clawdbot/clawdbot). It wraps the powerful [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) with 137+ blockchain actions, making it dead simple to trade, launch tokens, manage NFTs, and vibe on Solana—all from your personal AI assistant.

> *"Why walk when you can waddle? Why hodl when you can vibe?"* — Clawd the Space Lobster

## Features

- **137+ Solana Actions** — Token transfers, DeFi swaps, NFT minting, airdrops, and more.
- **Mobile-First Trading** — Trade from your phone via the iOS/Android Solana tab.
- **Remote Signing** — Approve transactions securely from your mobile wallet.
- **Plugin Architecture** — Enable only the plugins you need (Token, DeFi, NFT, Misc, Blinks).
- **Gateway Integration** — Full WebSocket RPC support for real-time blockchain interaction.
- **CLI Tools** — Execute Solana operations directly from the command line.
- **Real-Time Market Data** — Birdeye OHLCV charts, prices, and trending tokens.
- **Token Intelligence** — Helius DAS API for metadata, holders, and transaction history.
- **Chart Vision** — Point your phone camera at any chart for AI-powered analysis.

## Quick Start

### 1. Install Clawdbot

```bash
npm install -g clawdbot@latest
clawdbot onboard --install-daemon
```

### 2. Enable Vibe Bot

Add to `~/.clawdbot/clawdbot.json`:

```json5
{
  plugins: {
    "solana-agent": {
      enabled: true,
      network: "devnet",  // Start with devnet for testing
      enableRemoteSigning: true,
      plugins: ["token", "defi", "nft", "misc"]
    }
  }
}
```

### 3. Initialize

```bash
# Set up your wallet (or use remote signing)
export SOLANA_PRIVATE_KEY="your-base58-private-key"

# Initialize the agent
clawdbot solana init --network devnet

# Check your address
clawdbot solana address
```

### 4. Start Vibing

```bash
# Check your balance
clawdbot solana balance

# Swap some tokens
clawdbot solana swap --input-mint SOL --output-mint USDC --amount 0.1

# Launch a memecoin (on PumpFun)
clawdbot solana launch --name "VibeToken" --symbol "VIBE" --description "Good vibes only"
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SOLANA_PRIVATE_KEY` | Base58 encoded private key | No (use remote signing or Privy) |
| `SOLANA_RPC_URL` | Custom RPC endpoint | No (defaults to public) |
| `PRIVY_AUTHORIZATION_KEY` | Privy authorization key for server-side auth | No (only if using Privy) |
| `HELIUS_API_KEY` | Helius API key for DAS API and enhanced RPC | No (enables token metadata) |
| `HELIUS_RPC_URL` | Helius RPC endpoint | No (auto-generated from API key) |
| `BIRDEYE_API_KEY` | Birdeye API key for market data | No (enables OHLCV, prices, trends) |

### Plugin Config

```json5
{
  plugins: {
    "solana-agent": {
      // Enable/disable the extension
      enabled: true,

      // Network: "mainnet-beta", "devnet", or "testnet"
      network: "mainnet-beta",

      // Custom RPC endpoint (recommended for production)
      rpcUrl: "https://your-rpc-provider.com",

      // Wallet configuration - choose one:
      // Option 1: Privy agentic wallet (recommended for autonomous agents)
      privy: {
        walletId: "your-privy-wallet-id",
        appId: "your-privy-app-id",
        authorizationKey: "your-authorization-key",  // Optional, or use PRIVY_AUTHORIZATION_KEY env var
      },
      
      // Option 2: Local private key (not recommended for production)
      // privateKey: "your-base58-private-key",
      
      // Option 3: Remote signing via mobile app
      enableRemoteSigning: true,

      // Active plugins
      plugins: ["token", "defi", "nft", "misc", "blinks"]
    }
  }
}
```

### Privy Agentic Wallets

For autonomous agents, use Privy's agentic wallets with policy-based controls:

1. **Create authorization keys** in Privy Dashboard
2. **Define policies** to constrain agent behavior
3. **Create wallet** owned by authorization key with policies attached
4. **Configure** in plugin config (see example above)

See [PRIVY_SETUP.md](./PRIVY_SETUP.md) for detailed setup instructions.

## CLI Commands

```bash
# Wallet Operations
clawdbot solana address              # Get wallet address
clawdbot solana balance [address]    # Check SOL/token balance

# Token Operations
clawdbot solana transfer --to <addr> --amount <n> [--mint <token>]
clawdbot solana swap --input-mint <in> --output-mint <out> --amount <n>
clawdbot solana launch --name <name> --symbol <sym> [options]

# Market Data
clawdbot solana price <mint> [--source jupiter|pyth|coingecko]
clawdbot solana security <mint>      # Run security analysis

# Discovery
clawdbot solana actions [--category <cat>] [--search <query>]
clawdbot solana execute <action> [params-json]

# Status
clawdbot solana status               # Extension info
clawdbot solana network              # Network health
```

## Gateway Methods

For programmatic access via the Clawdbot Gateway WebSocket:

| Method | Description |
|--------|-------------|
| `solana.getAddress` | Get agent wallet address |
| `solana.getBalance` | Get SOL or token balance |
| `solana.transfer` | Transfer SOL or SPL tokens |
| `solana.swap` | Execute token swap via Jupiter |
| `solana.launchToken` | Launch token on PumpFun |
| `solana.getPrice` | Get token price |
| `solana.listActions` | List all available actions |
| `solana.executeAction` | Execute any action by name |
| `solana.getNetworkStatus` | Get Solana network health |
| `solana.securityCheck` | Analyze token security |
| `solana.requestSignature` | Request mobile signature |
| `solana.getExtensionInfo` | Get extension metadata |

### Birdeye Market Data

| Method | Description |
|--------|-------------|
| `birdeye.getOHLCV` | Get OHLCV candlestick data with analysis |
| `birdeye.getTokenPrice` | Get current token price |
| `birdeye.getTokenOverview` | Get detailed token metrics |
| `birdeye.getTokenTrades` | Get recent trades for a token |
| `birdeye.getMultiPrice` | Get prices for multiple tokens |
| `birdeye.searchTokens` | Search tokens by name/symbol |
| `birdeye.getTrendingTokens` | Get trending tokens |
| `birdeye.getNewListings` | Get newly listed tokens |

### Helius DAS API

| Method | Description |
|--------|-------------|
| `helius.getAsset` | Get asset details by ID |
| `helius.getAssetsByOwner` | Get all assets owned by address |
| `helius.getAssetsByGroup` | Get assets by collection |
| `helius.getAssetsByCreator` | Get assets by creator |
| `helius.searchAssets` | Search assets with filters |
| `helius.getTokenAccounts` | Get fungible token accounts |
| `helius.parseTransactions` | Parse transactions with enriched data |
| `helius.getEnrichedTransactions` | Get transaction history for account |
| `helius.getTokenMetadata` | Get metadata for token mints |

### Chart Vision (Camera Analysis)

| Method | Description |
|--------|-------------|
| `chart.analyzeImage` | Analyze a chart image with AI |
| `chart.getMarketContext` | Get real-time market context for a token |
| `chart.compareToData` | Compare visual chart to actual data |
| `chart.parseAnalysis` | Parse text analysis into structured data |
| `chart.generateReport` | Generate combined analysis report |

## Available Plugins

### Token Plugin (25+ actions)
- Transfer SOL and SPL tokens
- Get balances and token metadata
- Launch tokens on PumpFun
- Burn and close token accounts

### DeFi Plugin (40+ actions)
- Swap via Jupiter aggregator
- Stake SOL (Marinade, Jito, etc.)
- Lend/borrow (Solend, Marginfi)
- Provide liquidity (Raydium, Orca)

### NFT Plugin (30+ actions)
- Mint NFTs and collections
- List on marketplaces
- Transfer and burn NFTs
- Fetch metadata

### Misc Plugin (20+ actions)
- Request airdrops (devnet)
- Compressed NFTs
- Name services (SNS, Bonfida)
- Memo and data accounts

### Blinks Plugin (20+ actions)
- Solana Actions support
- Blockchain links
- Action URLs

## iOS Solana Tab

The Clawdbot iOS app includes a dedicated Solana tab:

- **Wallet Overview** — Address, SOL balance, token holdings
- **Quick Actions** — Send, Swap, Receive buttons
- **Transaction History** — Recent txs with status
- **Remote Signing** — Approve transactions from your phone

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Clawdbot Gateway                      │
│                  ws://127.0.0.1:18789                    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Vibe Bot Extension                      │
│                 @clawdbot/solana-agent                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │  Token  │ │  DeFi   │ │   NFT   │ │  Misc   │ ...   │
│  │ Plugin  │ │ Plugin  │ │ Plugin  │ │ Plugin  │       │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │
│       └───────────┴───────────┴───────────┘             │
│                         │                               │
│                         ▼                               │
│              ┌─────────────────────┐                    │
│              │   Solana Agent Kit  │                    │
│              │    (Core Engine)    │                    │
│              └──────────┬──────────┘                    │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Solana Network                        │
│           mainnet-beta / devnet / testnet               │
└─────────────────────────────────────────────────────────┘
```

## Security

- **Never commit private keys** — Use environment variables, Privy agentic wallets, or remote signing.
- **Use Privy for autonomous agents** — Policy-based controls prevent unintended actions.
- **Test on devnet first** — Always validate transactions before mainnet.
- **Use reliable RPCs** — Public endpoints have rate limits; use Helius, QuickNode, or Triton for production.
- **Review transactions** — Remote signing shows transaction details before approval.
- **Monitor agent activity** — Set up Privy webhooks to track all transactions.

## Development

```bash
# Clone the repo
git clone https://github.com/clawdbot/clawdbot.git
cd clawdbot/extensions/solana-agent

# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev
```

## Credits

- **[Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit)** — The powerful engine behind Vibe Bot
- **[Clawdbot](https://github.com/clawdbot/clawdbot)** — The personal AI assistant platform
- **Pudgy Penguins** — Inspiration for the vibe

## License

MIT — Vibe freely.

---

<p align="center">
  <strong>Stay chill. Stay vibing. Stay on Solana.</strong><br>
  <em>Built with love by Clawd the Space Lobster</em>
</p>
