# Solana Trading Bot Extension

Advanced Solana trading extension for Clawdbot with Bags.fm integration.

## Features

- **Token Trading**: Buy/sell tokens via Bags.fm SDK
- **Token Launching**: Launch new tokens on pump.fun
- **Wallet Management**: Privy-powered non-custodial wallets
- **Wallet Tracking**: Real-time notifications for tracked wallets
- **Sniper Bot**: Detect and buy new token launches (requires Yellowstone gRPC)
- **Copy Trading**: Automatically copy trades from tracked wallets
- **Volume Bot**: Generate trading volume for tokens

## Installation

```bash
# From the clawdbot root directory
pnpm install

# Or install dependencies in this extension
cd extensions/solana-trading-bot
pnpm install
```

## Configuration

### Required Environment Variables

Add these to your `.env` file:

```bash
# Upstash Redis (for user data persistence)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# Solana RPC
RPC_ENDPOINT=https://your-rpc-endpoint.com
RPC_WEBSOCKET_ENDPOINT=wss://your-ws-endpoint.com

# Bags.fm API (for trading)
BAGS_API_KEY=your_bags_api_key
BAGS_PARTNER_CONFIG_KEY=optional_partner_key
```

### Optional Environment Variables

```bash
# Privy (for managed wallets)
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_secret

# Yellowstone gRPC (for sniper bot)
GRPC_ENDPOINT=https://grpc.endpoint.com
GRPC_TOKEN=your_grpc_token
```

## Agent Tools

The extension provides these tools for AI agents:

### Trading Tools
- `solana_buy_token` - Buy a token with SOL
- `solana_sell_token` - Sell tokens for SOL
- `solana_get_trade_quote` - Get price quote before trading
- `solana_launch_token` - Launch a new token on pump.fun
- `solana_claim_fees` - Claim trading fees from Bags.fm

### Wallet Tools
- `solana_get_wallet` - Get or create user's wallet
- `solana_get_balance` - Check SOL and token balances
- `solana_track_wallet` - Track a wallet for notifications
- `solana_untrack_wallet` - Stop tracking a wallet
- `solana_list_tracked` - List all tracked wallets

### Bot Tools
- `solana_sniper_start` - Start the sniper bot
- `solana_sniper_stop` - Stop the sniper bot
- `solana_sniper_status` - Get sniper bot status
- `solana_copy_start` - Start copy trading
- `solana_copy_stop` - Stop copy trading
- `solana_copy_status` - Get copy trading status
- `solana_volume_start` - Start volume bot
- `solana_volume_stop` - Stop volume bot
- `solana_volume_status` - Get volume bot status

## Data Storage (Redis)

User data is stored in Upstash Redis with these key patterns:

- `user:{chatId}` - User profile and settings
- `tracked:wallets:{chatId}` - Tracked wallet addresses
- `tracked:tokens:{chatId}` - Tracked token addresses
- `sniper:config:{chatId}` - Sniper bot configuration
- `volume:config:{chatId}` - Volume bot configuration
- `copy:config:{chatId}` - Copy trading configuration
- `global:tracked:wallets` - All tracked wallets (for efficient lookup)

## Architecture

```
src/
├── index.ts              # Plugin entry point
├── db/
│   └── redis.ts          # Upstash Redis operations
├── services/
│   ├── bags-integration.ts   # Bags.fm SDK
│   ├── privy-wallet.ts       # Privy wallet management
│   ├── wallet-tracking.ts    # Real-time wallet monitoring
│   ├── sniper-bot.ts         # New token sniper
│   ├── copy-trading.ts       # Copy trading engine
│   └── volume-bot.ts         # Volume generation
└── tools/
    ├── trading-tools.ts      # Buy/sell/quote tools
    ├── wallet-tools.ts       # Wallet management tools
    └── bot-tools.ts          # Bot control tools
```

## Usage Examples

### Buy a Token
```
User: "Buy 0.5 SOL of token ABC123..."
Agent: Uses solana_get_trade_quote then solana_buy_token
```

### Track a Wallet
```
User: "Track this whale wallet: 7xKX..."
Agent: Uses solana_track_wallet to start monitoring
```

### Start Copy Trading
```
User: "Copy trades from wallet 7xKX... with 0.1 SOL per trade"
Agent: Uses solana_copy_start with wallet address and amount
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm tsc --noEmit

# Run with clawdbot
cd ../.. && pnpm dev
```

## License

MIT
