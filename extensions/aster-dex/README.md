# Aster DEX Extension for Clawdbot

AI-powered trading integration for Aster DEX with natural language processing support for perpetuals, spot trading, price analysis, and alerts.

## Features

### 🚀 Perpetual Trading
- Open long positions with leverage
- Open short positions with leverage
- Close positions (partial or full)
- Position monitoring and PnL tracking

### 💱 Spot Trading
- Buy and sell spot assets
- Market and limit orders
- Order management and cancellation

### 📊 Market Analysis
- Real-time price queries
- 24-hour statistics and performance
- Candlestick/chart data (multiple timeframes)
- Technical analysis with trend detection
- Support/resistance level identification

### 🔔 Price Alerts
- Create alerts for price targets
- Monitor above/below conditions
- Automatic alert triggering
- Alert management (list, remove)

## Configuration

Add the following environment variables to your `.env` file:

```bash
ASTER_API_KEY=your_api_key
ASTER_API_SECRET=your_api_secret
ASTER_API_WALLET_ADDRESS=your_wallet_address
ASTER_API_WALLET_PRIVATE_KEY=your_private_key
```

## Available Tools

### Trading Tools
- `aster_open_long` - Open a long perpetual position
- `aster_open_short` - Open a short perpetual position
- `aster_close_position` - Close an existing position
- `aster_spot_buy` - Buy spot assets
- `aster_spot_sell` - Sell spot assets
- `aster_cancel_order` - Cancel a specific order
- `aster_cancel_all_orders` - Cancel all orders for a symbol
- `aster_get_positions` - View current positions
- `aster_get_open_orders` - View open orders

### Market Data Tools
- `aster_get_price` - Get current price
- `aster_get_24hr_stats` - Get 24-hour statistics
- `aster_get_chart` - Get candlestick chart data
- `aster_get_balance` - View account balance
- `aster_analyze_market` - Perform market analysis

### Alert Tools
- `aster_create_alert` - Create a price alert
- `aster_remove_alert` - Remove an alert
- `aster_list_alerts` - List all active alerts

## Example Usage

### Natural Language Commands

**Opening Positions:**
- "Open a 10x long on BTCUSDT with 0.1 BTC"
- "Short ETHUSDT with 5x leverage, 1 ETH"
- "Buy 100 SOL perpetual at market price"

**Closing Positions:**
- "Close my BTCUSDT long position"
- "Exit my short on ETHUSDT"
- "Close half of my SOL position"

**Spot Trading:**
- "Buy 1 BTC at market price"
- "Sell 10 ETH at $2000"
- "Place a limit buy for SOL at $20"

**Market Analysis:**
- "What's the current price of BTC?"
- "Show me 24-hour stats for ETHUSDT"
- "Give me a 1-hour chart for SOLUSDT"
- "Analyze the market for BTCUSDT"

**Alerts:**
- "Alert me when BTC goes above $50000"
- "Create an alert for ETH below $1500"
- "Show me my active alerts"

## Installation

```bash
cd extensions/aster-dex
pnpm install
pnpm build
```

## Integration

The extension automatically registers with Clawdbot when the gateway starts. Ensure your `.env` file contains valid Aster DEX credentials.

## Security Notes

- Private keys are stored in environment variables only
- All API requests are authenticated using Web3 ECDSA signatures
- Never commit your `.env` file or expose your private keys
- The extension uses the official Aster Finance API authentication flow

## API Documentation

For more details on the Aster DEX API, refer to:
- Base URL: `https://fapi.asterdex.com`
- Official documentation: `https://www.asterdex.com/`

## License

MIT
