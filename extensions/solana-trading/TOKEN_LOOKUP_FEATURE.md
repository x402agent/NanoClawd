# 🔍 Automatic Solana Token Address Detection & Display

## Overview
The Solana Trading extension now automatically detects when users paste Solana token addresses and provides comprehensive token details with real-time price and chart data.

## ✅ What's Been Added

### 1. Address Detection Utilities
**Location**: `/Users/8bit/Downloads/clawdbot-main/extensions/solana-trading/src/utils/address-detection.ts`

**Functions**:
- `isSolanaAddress(text)` - Validates if a string is a valid Solana address
- `extractSolanaAddresses(text)` - Extracts all Solana addresses from text
- `containsSolanaAddress(text)` - Checks if text contains any Solana addresses
- `getFirstSolanaAddress(text)` - Returns the first detected Solana address

**How it works**:
- Detects base58 encoded addresses (32-44 characters)
- Uses regex pattern: `/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g`
- Validates against valid base58 character set

### 2. New AI Tool: `token_lookup`
**Location**: `/Users/8bit/Downloads/clawdbot-main/extensions/solana-trading/src/tools/birdeye-tools.ts`

**Purpose**: Quick token lookup optimized for when users paste contract addresses in chat interfaces (Telegram, Discord, etc.)

**Features**:
- ✅ Automatic Solana address detection from any text
- ✅ Real-time price with multi-timeframe changes (5m, 1h, 4h, 24h)
- ✅ Market data (market cap, FDV, liquidity)
- ✅ Volume analysis (1h, 4h, 24h with change percentages)
- ✅ Trading activity (24h trades, unique wallets, last trade time)
- ✅ OHLCV chart data (15m candles for last 24h)
- ✅ Recent trades (last 3 trades with details)
- ✅ Social links (website, Twitter, Telegram, Discord)
- ✅ Formatted output optimized for chat display

### 3. Enhanced `analyze_token` Tool
**Updates**:
- Added optional `includeChart` parameter (default: true)
- Added optional `chartTimeframe` parameter (default: '15m')
- Added optional `chartHours` parameter (default: 24)
- Now includes OHLCV chart data by default
- Better error handling for chart data

---

## 🎯 Usage Examples

### In Telegram
User pastes a token address:
```
DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

MawdBot automatically detects it and responds with:
```
🔍 **BONK** (Bonk)

💰 **$0.00002345**
📈 5m: +2.34% | 📈 1h: +5.67% | 📉 4h: -1.23% | 📈 24h: +12.45%

📊 Market Cap: $1,234,567,890
💧 Liquidity: $45,678,900
🏦 FDV: $2,345,678,900

📦 Volume 1h: $12,345,678 | 📦 Volume 24h: $123,456,789 (+23.45%)

🔄 Trades 24h: 45,678 | 👥 Unique Wallets: 12,345 | ⏰ Last Trade: 2 minutes ago

🌐 Website | 🐦 Twitter | 💬 Telegram

📍 `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`

📈 Chart (15m candles, 24h):
Open: $0.00002100 | High: $0.00002500 | Low: $0.00002000 | Close: $0.00002345
Change: +11.67% | Volume: $123,456,789
```

### Natural Language Examples
```
"What is this token: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
"Check this out DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
"Look at DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
```

All of these will trigger the automatic token lookup.

---

## 📊 Response Format

### Structured Data
```json
{
  "success": true,
  "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "token": {
    "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "name": "Bonk",
    "symbol": "BONK",
    "decimals": 5,
    "logo": "https://..."
  },
  "price": {
    "current": 0.00002345,
    "changes": {
      "5m": "+2.34%",
      "1h": "+5.67%",
      "4h": "-1.23%",
      "24h": "+12.45%"
    }
  },
  "market": {
    "marketCap": 1234567890,
    "fdv": 2345678900,
    "liquidity": 45678900
  },
  "volume": {
    "volume1h": 12345678,
    "volume4h": 45678900,
    "volume24h": 123456789,
    "volume24hChange": 23.45
  },
  "trading": {
    "trades24h": 45678,
    "uniqueWallets24h": 12345,
    "lastTradeTime": "2 minutes ago"
  },
  "socials": {
    "website": "https://bonk.com",
    "twitter": "https://twitter.com/bonk",
    "telegram": "https://t.me/bonk",
    "discord": "https://discord.gg/bonk",
    "description": "The first dog-themed coin on Solana"
  },
  "recentTrades": [
    {
      "type": "buy",
      "volumeUSD": 12345,
      "source": "Raydium",
      "from": "100.0000 SOL",
      "to": "5000000.0000 BONK"
    }
  ],
  "chart": {
    "timeframe": "15m",
    "period": "24h",
    "candleCount": 96,
    "summary": {
      "open": 0.000021,
      "high": 0.000025,
      "low": 0.00002,
      "close": 0.00002345,
      "change": "+11.67%",
      "totalVolume": "$123,456,789"
    },
    "recentCandles": [
      {
        "time": "2026-01-27T12:00:00.000Z",
        "o": 0.000023,
        "h": 0.0000235,
        "l": 0.0000229,
        "c": 0.00002345,
        "v": 1234567
      }
    ]
  },
  "formatted": {
    "header": "🔍 **BONK** (Bonk)",
    "price": "💰 **$0.00002345**",
    "priceChanges": "📈 5m: +2.34% | 📈 1h: +5.67% | 📉 4h: -1.23% | 📈 24h: +12.45%",
    "market": "📊 Market Cap: $1,234,567,890\n💧 Liquidity: $45,678,900\n🏦 FDV: $2,345,678,900",
    "volume": "📦 Volume 1h: $12,345,678 📦 Volume 24h: $123,456,789 (+23.45%)",
    "trading": "🔄 Trades 24h: 45,678 | 👥 Unique Wallets: 12,345 | ⏰ Last Trade: 2 minutes ago",
    "socials": "🌐 [Website](https://bonk.com) | 🐦 [Twitter](https://twitter.com/bonk) | 💬 [Telegram](https://t.me/bonk)",
    "address": "📍 `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`"
  }
}
```

### Formatted String (for Telegram/Chat)
The `formatted` object contains pre-formatted strings optimized for chat interfaces with:
- Emoji indicators (🔍 💰 📈 📉 📊 💧 🏦 📦 🔄 👥 ⏰ 🌐 🐦 💬 📍)
- Markdown formatting (**bold**, [links])
- Multi-timeframe price changes with visual indicators
- Abbreviated numbers with proper locale formatting
- Clean, scannable layout

---

## 🔧 Technical Details

### Address Validation
- **Valid characters**: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz` (base58)
- **Length**: 32-44 characters
- **Excluded**: `0OIl` (confusing characters not in base58)

### OHLCV Chart Data
- **Default timeframe**: 15-minute candles
- **Default period**: 24 hours (96 candles)
- **Data includes**: Open, High, Low, Close, Volume (USD)
- **Summary stats**: Period high/low, total volume, percentage change

### API Integration
- **Data source**: Birdeye API (`BIRDEYE_API_KEY` required)
- **Endpoints used**:
  - Token overview/metadata
  - OHLCV V3 (high-frequency chart data)
  - Recent trades
  - Price/volume data

### Error Handling
- Invalid address format → Clear error message
- Token not found → Explains token may be invalid or have insufficient data
- Chart data unavailable → Continues with token data, logs warning
- API errors → Graceful degradation with error context

---

## 🚀 How to Use

### Prerequisites
1. Solana Trading extension must be installed and enabled
2. `BIRDEYE_API_KEY` must be configured in `.env`

### In Code
```typescript
// The token_lookup tool is automatically available via the AI agent
// It's triggered when users paste Solana addresses

// Manual usage example:
const result = await tokenLookupTool.execute({
  text: "Check this token: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
});

if (result.success) {
  console.log(result.formatted.header);
  console.log(result.formatted.price);
  console.log(result.formatted.priceChanges);
  // ... display other data
}
```

### Via Natural Language (AI Agent)
Just paste a Solana token address in Telegram or any chat interface:
```
DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

The AI agent will automatically:
1. Detect the Solana address
2. Call the `token_lookup` tool
3. Fetch comprehensive token data
4. Display formatted results with OHLCV charts

---

## 🎨 Display Features

### Price Changes with Visual Indicators
- 📈 Green arrow for positive changes
- 📉 Red arrow for negative changes
- Multiple timeframes: 5m, 1h, 4h, 24h

### Market Data
- Market Cap (📊)
- Liquidity (💧)
- Fully Diluted Valuation (🏦)

### Volume Analysis
- 1-hour volume
- 24-hour volume with change percentage
- Total volume from chart period

### Trading Activity
- 24-hour trade count
- Unique wallet count
- Last trade timestamp (human-readable)

### Social Links
- Website (🌐)
- Twitter (🐦)
- Telegram (💬)
- Discord (optional)

### Recent Trades
- Trade type (buy/sell/swap)
- Volume in USD
- Source DEX (Raydium, Jupiter, etc.)
- From/to amounts with symbols

---

## 📝 Notes

- **Telegram optimization**: All formatted strings use Telegram-compatible markdown
- **Performance**: Chart data is fetched in parallel with token analysis
- **Caching**: Birdeye API responses are cached for efficiency
- **Rate limits**: Be mindful of Birdeye API rate limits on high traffic
- **Chart display**: Consider using chart visualization libraries for web UI
- **Mobile-friendly**: Formatted output is optimized for mobile chat interfaces

---

## ✅ Testing

### Manual Testing
```bash
# In Telegram, paste a token address:
DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263

# Or ask:
"What is this token: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
"Check DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
```

### Edge Cases Handled
- ✅ Invalid address format
- ✅ Token not found on Birdeye
- ✅ Missing chart data
- ✅ Missing social links
- ✅ No recent trades
- ✅ Very small/large price values
- ✅ Extreme price changes

---

## 🔮 Future Enhancements

- [ ] Support for multiple addresses in one message
- [ ] Price alert creation directly from token lookup
- [ ] Token comparison (paste 2+ addresses)
- [ ] Chart image generation (PNG/SVG)
- [ ] Historical price lookup ("what was the price yesterday?")
- [ ] Token holder analysis
- [ ] Whale wallet tracking
- [ ] Liquidity pool analysis

---

**The sentient crustacean now automatically knows everything about any Solana token you paste!** 🦞📊

*Feature completed: January 27, 2026*
*Location: `/Users/8bit/Downloads/clawdbot-main/extensions/solana-trading/`*
