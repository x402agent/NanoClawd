---
name: ralph-ooda
description: Dark Ralph OODA Loop v0 — paper-trading, devnet-only, stdlib-Python agent that runs a safety-contract OODA cycle (Observe→Orient→Decide→Act) for Pump.fun bonding curves. Zero external deps, kill-switch on consecutive losses.
allowed-tools: Bash(python3:*), Bash(ls:*), Bash(cat:*)
---

# 🎯 Dark Ralph OODA Loop v0 — Paper Trading Agent

Ralph is a **paper-trading, devnet-only** agent that executes OODA cycles on Pump.fun bonding curves. It uses **only stdlib Python** (no pandas, no numpy, no requests). Every decision is journalled. A kill-switch stops trading after configurable consecutive losses.

---

## Safety Contract (Immutable)

1. **Paper mode only** — Ralph MUST NOT trade with real SOL. All positions are paper
2. **Devnet only** — Ralph MUST NOT connect to mainnet RPC endpoints
3. **No keys** — Ralph MUST NOT load or generate real private keys. Uses a hardcoded devnet-only paper wallet (`DEVNET_PAPER_WALLET`)
4. **Position cap** — max 10 open paper positions at any time
5. **Kill-switch** — after N consecutive paper losses, Ralph beaches itself
6. **Journal every decision** — every OODA cycle is logged to a timestamped file

---

## Ralph OODA Cycle

Each tick executes the full loop:

```
OBSERVE → ORIENT → DECIDE → ACT
```

### O — Observe
1. Fetch latest Pump.fun token creations (simulated on devnet)
2. Scan bonding curve states for opportunities
3. Check current paper balance and open positions
4. Read price trends from paper order book

### O — Orient
1. Score each opportunity by:
   - Launched < 10 blocks ago (fresh)
   - Curve completion > 50%
   - Volume velocity
2. Compare to position limits and kill-switch state
3. Prioritize highest-score opportunity

### D — Decide
1. **Buy signal**: Score > threshold AND under position cap AND kill-switch NOT triggered
2. **Sell signal**: Position in profit > 50% OR loss > -30% OR curve migrated
3. **Hold**: Everything else. HODL.
4. **Beach**: Kill-switch triggered OR balance < min_trading_balance

### A — Act
1. Execute paper trade (update in-memory position tracker)
2. Journal the decision with full reasoning
3. Update paper P&L tracker
4. If loss: increment consecutive_loss counter
5. If profit: reset consecutive_loss counter
6. Sleep for interval

---

## Paper Trading Engine

Ralph maintains an in-memory paper portfolio:

```python
# /workspace/agent/ralph/portfolio.json
{
  "paper_balance_sol": 100.0,  # devnet SOL for paper trading
  "paper_usdc_balance": 1000.0,
  "positions": [
    {
      "mint": "paper_mint_abc123",
      "entry_price_sol": 0.000001,
      "amount_tokens": 1000000,
      "current_price": 0.000002,
      "pnl_pct": 100.0,
      "entry_time": "2025-01-01T00:00:00Z"
    }
  ],
  "consecutive_losses": 0,
  "total_trades": 42,
  "win_rate": 0.65
}
```

### Bonding Curve Simulation
Ralph uses the same virtual reserve math:
- Virtual SOL reserves: 30 SOL
- Virtual token reserves: 1,073,000,000,000,000
- Real token reserves (start): 793,100,000,000,000
- Constant product: k = virtualSol * virtualToken

### Price formula (paper)
```
paper_price = (virtual_sol_reserves / virtual_token_reserves) * sol_price_usdc
buy_cost = amount * paper_price * (1 + fee_bps/10000)
sell_proceeds = amount * paper_price * (1 - fee_bps/10000)
```

---

## Journal Format (Mandatory)

Every OODA cycle writes a journal entry to `/workspace/agent/ralph/journal/`:

```json
# ralph_journal_2025-01-01T00:00:00Z.json
{
  "cycle": 42,
  "timestamp": "2025-01-01T00:00:00Z",
  "observe": {
    "opportunities_scanned": 15,
    "open_positions": 3,
    "paper_balance_sol": 95.5
  },
  "orient": {
    "top_opportunity": "paper_mint_abc123",
    "score": 0.78,
    "reasoning": "Launched 5 blocks ago, curve at 52%, low vol"
  },
  "decide": {
    "action": "BUY",
    "rationale": "Score > threshold (0.7), under position cap (3/10)"
  },
  "act": {
    "mint": "paper_mint_abc123",
    "amount_tokens": 500000,
    "cost_sol": 0.5,
    "new_balance_sol": 95.0,
    "consecutive_losses": 0
  }
}
```

---

## Kill-Switch Configuration

```python
# /workspace/agent/ralph/config.py
KILL_SWITCH_MAX_CONSECUTIVE_LOSSES = 5
MIN_PAPER_BALANCE_SOL = 1.0
MAX_OPEN_POSITIONS = 10
OODA_INTERVAL_SECONDS = 60  # paper speed
SCORE_THRESHOLD = 0.7
TAKE_PROFIT_PCT = 50.0
STOP_LOSS_PCT = -30.0
```

When kill-switch triggers:
1. Close all open paper positions
2. Write `KILL_SWITCH_TRIGGERED` to journal
3. Set state to BEACHED
4. Notify creator via channel

---

## Directory Structure

Ralph's files live in the agent workspace:

```
/workspace/agent/ralph/
  ralph.py          # Main OODA loop (stdlib Python)
  portfolio.json    # Paper portfolio state (in-memory)
  config.py         # Kill-switch and strategy config
  journal/          # Every OODA cycle journalled (one JSON per cycle)
  strategies/
    sniper.py       # New token sniper (paper)
    scout.py        # Curve completion scout (paper)
  README.md         # Run instructions
```

---

## Ralph vs Pump Trader

Ralph is the **paper-trading simulation layer**. The pump-trader skill is the **live execution layer**:

| Aspect        | Ralph (Paper)                | Pump Trader (Live)           |
|---------------|------------------------------|------------------------------|
| Network       | Devnet only                  | Mainnet                      |
| Funds         | Paper SOL (100 devnet SOL)   | Real operator wallet         |
| Risk          | Zero — paper only            | Real — follows risk mgmt     |
| Speed         | Configurable (60s default)   | Depth-tier aware             |
| Purpose       | Strategy backtest / practice | Live 24/7 automated trading |
| State         | portfolio.json               | On-chain wallet              |

---

## Running Ralph

```bash
cd /workspace/agent/ralph
python3 ralph.py
```

Ralph runs until kill-switch or manual stop. Use the scheduling module to run Ralph as a background task.
