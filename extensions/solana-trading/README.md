# Solana Trading Bot Extension

Trading automation for Clawdbot: sniper bot, volume bot, copy trading, wallet tracking, and token launches.

## Features

### 🎯 Sniper Bot
Automatically buy tokens on launch with configurable filters:
- Set buy amount and slippage tolerance
- Filter by liquidity, market cap, social links
- Max concurrent snipes with safety limits

### 📊 Volume Bot
Generate organic trading volume for tokens:
- Configurable buy/sell ranges
- Multiple wallet support
- Custom interval timing

### 🔄 Copy Trading
Mirror trades from successful wallets:
- Set trade size multiplier
- Max trade amount safety limits
- Filter by minimum trade size

### 👀 Wallet Tracking
Monitor wallet activity with real-time notifications:
- Track up to 50 wallets per user
- Custom aliases for easy identification
- Token-specific tracking

### 🚀 Token Launches
Launch tokens on Bags.fm with fee sharing:
- Automated token creation
- Partner fee configuration
- Initial buy support

## Installation

```bash
cd extensions/solana-trading
pnpm install
pnpm build
```

## Configuration

Add to `~/.clawdbot/clawdbot.json`:

```json
{
  "plugins": {
    "entries": {
      "solana-trading": {
        "enabled": true,
        "config": {
          "database": {
            "url": "postgresql://user:pass@localhost:5432/clawdbot_trading",
            "ssl": true
          },
          "helius": {
            "apiKey": "your-helius-api-key"
          },
          "bags": {
            "apiKey": "your-bags-api-key",
            "partnerConfigKey": "your-partner-key"
          },
          "sniper": {
            "enabled": true,
            "defaultBuyAmount": 0.1,
            "defaultSlippage": 15
          },
          "volumeBot": {
            "enabled": true,
            "defaultInterval": 60
          },
          "copyTrading": {
            "enabled": true,
            "defaultMultiplier": 1,
            "maxTradeAmount": 10
          },
          "walletTracking": {
            "enabled": true,
            "maxTrackedWallets": 50
          }
        }
      }
    }
  }
}
```

## Database Setup

1. Create PostgreSQL database:
```bash
createdb clawdbot_trading
```

2. Set DATABASE_URL environment variable:
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/clawdbot_trading"
```

3. Generate and run migrations:
```bash
pnpm db:generate
pnpm db:migrate
```

## Agent Tools

The extension registers AI tools that can be used conversationally via Telegram:

### Sniper Tools
- `trading_sniper_configure` - Configure sniper settings
- `trading_sniper_status` - View sniper status
- `trading_sniper_enable` - Enable/disable sniper

### Tracking Tools
- `trading_track_wallet` - Add wallet to tracking
- `trading_untrack_wallet` - Remove wallet from tracking
- `trading_list_tracked` - List tracked wallets
- `trading_track_token` - Track specific token for wallet

### Copy Trading Tools
- `trading_copy_configure` - Configure copy trading
- `trading_copy_status` - View copy trading status
- `trading_copy_enable` - Enable/disable copy trading

### Volume Bot Tools
- `trading_volume_configure` - Configure volume bot
- `trading_volume_status` - View volume bot status
- `trading_volume_enable` - Enable/disable volume bot

### Launch Tools
- `trading_launch_token` - Launch token on Bags.fm
- `trading_claim_fees` - Claim accumulated fees

## Example Usage

Via Telegram with Clawdbot:

```
User: Configure my sniper to buy 0.1 SOL with 15% slippage

Bot: Sniper configuration updated:
- Enabled: true
- Buy Amount: 0.1 SOL
- Slippage: 15%
```

```
User: Track wallet ABC123... with alias "Smart Money"

Bot: ✅ Now tracking wallet:
Address: ABC123...XYZ789
Alias: Smart Money

You'll receive notifications for all transactions.
```

```
User: Start copy trading from wallet DEF456... with 0.5x multiplier

Bot: Copy trading configuration updated:
- Enabled: true
- Source Wallet: DEF456...UVW123
- Multiplier: 0.5x
```

## Development

```bash
# Watch mode
pnpm dev

# Type checking
pnpm build

# Database commands
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema changes
```

## Dependencies

- `drizzle-orm` - Database ORM
- `postgres` - PostgreSQL client
- `zod` - Schema validation
- `nanoid` - ID generation

Peer dependencies:
- `clawdbot` - Core framework (>=2026.1.0)
- `@clawdbot/solana-agent` - For Privy wallet integration

## Architecture

```
extensions/solana-trading/
├── src/
│   ├── db/              # Database schema and client
│   ├── services/        # Background workers (planned)
│   ├── tools/           # AI agent tools
│   ├── gateway/         # Gateway RPC methods (planned)
│   ├── config.ts        # Zod config schema
│   ├── plugin.ts        # Plugin registration
│   ├── types.ts         # Shared types
│   └── index.ts         # Main export
├── clawdbot.plugin.json # Plugin metadata
└── package.json
```

## Notes

- Background services (wallet tracker, sniper, volume bot, copy trading) are registered but require implementation
- Bags.fm integration requires `@bagsfm/bags-sdk` package (not yet added)
- Wallet signing uses the existing `@clawdbot/solana-agent` extension via Privy
- All tools are scoped per-user via Telegram chatId extracted from sessionKey

## License

MIT
