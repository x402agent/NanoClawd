# 🎯 Dark Ralph OODA Loop v0

Paper-trading agent that executes OODA cycles on simulated Pump.fun bonding curves.

## Quick Start

```bash
cd /workspace/agent/ralph
python3 ralph.py
```

## Files

| File | Purpose |
|------|---------|
| `ralph.py` | Main OODA loop — stdlib Python, zero deps |
| `config.py` | Kill-switch, scoring, and P&L thresholds |
| `portfolio.json` | Paper portfolio state (auto-created) |
| `strategies/sniper.py` | New token sniper scoring |
| `strategies/scout.py` | Curve completion scout scoring |
| `journal/` | One JSON file per OODA cycle |

## Safety Contract

1. Paper mode only — no real SOL
2. Devnet only — no mainnet RPC
3. No real private keys
4. Max 10 open paper positions
5. Kill-switch at 5 consecutive losses
6. Every decision journalled

## Architecture

Ralph is the **paper-trading simulation layer**. For live execution, use the `pump-trader` skill.
