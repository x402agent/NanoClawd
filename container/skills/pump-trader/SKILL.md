---
name: pump-trader
description: 24/7 automated trading on Pump.fun bonding curves and PumpSwap AMM. Creates tokens, buys/sells on bonding curves, migrates to AMM, and provides liquidity. Fully automated with customizable strategies.
allowed-tools: Bash(pump:create), Bash(pump:buy), Bash(pump:sell), Bash(pump:migrate), Bash(pump:estimate)
---

# 🪙 Pump Trader — Automated 24/7 Solana Trading

You have access to Pump.fun bonding curves and PumpSwap AMM for fully automated token trading on Solana. All operations use the operator wallet configured by your host — **never expose your secret key**.

---

## Core Operations

### Create a Token
Creates a new SPL token on Pump.fun's bonding curve in one transaction:

```bash
pump create --name "My Token" --symbol "MYT" --uri "https://example.com/metadata.json"
```

### Buy Tokens
Buy tokens on any Pump.fun bonding curve:

```bash
pump buy --mint <MINT_ADDRESS> --amount <TOKEN_AMOUNT> --max-sol <MAX_SOL_LAMPORTS>
```

### Sell Tokens
Sell tokens back to the bonding curve:

```bash
pump sell --mint <MINT_ADDRESS> --amount <TOKEN_AMOUNT> --min-sol <MIN_SOL_LAMPORTS>
```

### Migrate to AMM
When a bonding curve completes (real_token_reserves == 0), migrate liquidity to PumpSwap:

```bash
pump migrate --mint <MINT_ADDRESS>
```

### PumpSwap Operations
```bash
pump swap buy --pool <POOL> --base-amount <AMOUNT> --max-quote <MAX>
pump swap sell --pool <POOL> --base-amount <AMOUNT> --min-quote <MIN>
pump swap deposit --pool <POOL> --lp <AMOUNT> --max-base <MAX> --max-quote <MAX>
pump swap withdraw --pool <POOL> --lp <AMOUNT> --min-base <MIN> --min-quote <MIN>
```

---

## Bonding Curve Economics

Pump.fun uses a Uniswap V2-style bonding curve with **virtual reserves**:

| Parameter | Value |
|-----------|-------|
| Virtual Token Reserves | 1,073,000,000,000,000 |
| Virtual SOL Reserves | 30 SOL (30,000,000,000 lamports) |
| Real Token Reserves (start) | 793,100,000,000,000 |
| Total Supply | 1,000,000,000,000,000 |
| Fee | 100 bps (1%) |

### Formula
```
cost_in_sol = (token_amount * virtual_sol_reserves) / (virtual_token_reserves - token_amount)
fee = cost * 1%
total_cost = cost + fee
```

### Key Behaviors
- Early buyers get better prices (curve is shallow at the start)
- Curve "completes" when real_token_reserves == 0 = all tokens sold
- Graduation = liquidity migrated to PumpSwap AMM (25 bps total fees)

---

## Automated Trading Strategies

### Strategy 1: New Token Sniper
1. Watch Pump.fun for new token creations via RPC polling
2. Calculate if the initial buy is economically viable
3. Buy fixed percentage of supply immediately
4. Set take-profit (3x) and stop-loss (-50%)
5. Execute at target

### Strategy 2: Curve Completion Scout
1. Monitor curves where real_token_reserves approaches 0
2. Buy before migration — price spike on PumpSwap migration
3. Sell on PumpSwap after migration

### Strategy 3: AMM Arbitrage
1. Compare PumpSwap vs external market prices (Raydium, Orca)
2. Execute when profitable after fees (25 bps PumpSwap)
3. Requires SOL for gas + token balances on both sides

### Strategy 4: Dollar-Cost Averaging
1. Set total position size (e.g. 5 SOL)
2. Split into N equal buys (e.g. 10 x 0.5 SOL)
3. Execute at regular intervals (e.g. every 30 min)
4. Sell all at target price

---

## Leviathan Integration

Trading generates SOL/USDC to fund operations:

- **Deep** — full strategies, check every 60s
- **Shallow** — conservative only (DCA, small positions), check every 5min
- **Shoreline** — close positions only, check every 15min
- **Beached** — stopped, beach all positions

---

## Risk Management (Mandatory)

- Never bet >10% of wallet per trade without explicit approval
- Always set slippage limits (maxSolCost / minSolOutput)
- Verify token mint exists before buying
- Simulate a sell before first buy (honeypot check)
- Respect depth tiers — don't trade your rent
- Log every trade to `/workspace/agent/trades/`

---

## Configuration

```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_OPERATOR_KEYPAIR=/path/to/keypair.json
PUMP_DEFAULT_SLIPPAGE_BPS=500
PUMP_MAX_POSITION_SIZE_SOL=0.1
PUMP_MAX_CONCURRENT_POSITIONS=5
PUMP_DEFAULT_STRATEGY=sniper
```
