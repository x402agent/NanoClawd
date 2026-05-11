#!/usr/bin/env python3
"""
Dark Ralph OODA Loop v0 — Paper Trading Agent.

Executes safety-contract OODA cycles (Observe → Orient → Decide → Act)
on simulated Pump.fun bonding curves. Uses ONLY stdlib Python.

Kill-switch stops trading after N consecutive paper losses.
Every decision is journalled.

Usage:
    python3 ralph.py
"""
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Add base dir to path so we can import config
BASE_DIR = Path("/workspace/agent/ralph")
sys.path.insert(0, str(BASE_DIR))

from config import (  # noqa: E402
    KILL_SWITCH_MAX_CONSECUTIVE_LOSSES,
    MIN_PAPER_BALANCE_SOL,
    MAX_OPEN_POSITIONS,
    OODA_INTERVAL_SECONDS,
    SCORE_THRESHOLD,
    FRESH_BLOCK_WINDOW,
    CURVE_COMPLETION_TARGET,
    TAKE_PROFIT_PCT,
    STOP_LOSS_PCT,
    INITIAL_PAPER_SOL,
    INITIAL_PAPER_USDC,
    VIRTUAL_SOL_RESERVES,
    VIRTUAL_TOKEN_RESERVES,
    REAL_TOKEN_RESERVES_START,
    TOTAL_SUPPLY,
    FEE_BPS,
    SOL_PRICE_USDC,
    PORTFOLIO_PATH,
    JOURNAL_DIR,
    STRATEGIES_DIR,
)

# ── State ────────────────────────────────────────────────────────────────────

STATE = {
    "cycle": 0,
    "beached": False,
}


# ── Portfolio ────────────────────────────────────────────────────────────────

def load_portfolio() -> dict:
    """Load paper portfolio from disk, or create default."""
    p = Path(PORTFOLIO_PATH)
    if p.exists():
        with open(p) as f:
            return json.load(f)
    return {
        "paper_balance_sol": INITIAL_PAPER_SOL,
        "paper_usdc_balance": INITIAL_PAPER_USDC,
        "positions": [],
        "consecutive_losses": 0,
        "total_trades": 0,
        "win_rate": 0.0,
    }


def save_portfolio(pf: dict) -> None:
    """Persist portfolio to disk."""
    Path(PORTFOLIO_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(PORTFOLIO_PATH, "w") as f:
        json.dump(pf, f, indent=2)


# ── Journal ──────────────────────────────────────────────────────────────────

def journal_entry(cycle: int, observe: dict, orient: dict, decide: dict, act: dict) -> None:
    """Write one OODA cycle to a timestamped journal file."""
    Path(JOURNAL_DIR).mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    entry = {
        "cycle": cycle,
        "timestamp": ts,
        "observe": observe,
        "orient": orient,
        "decide": decide,
        "act": act,
    }
    filename = f"ralph_journal_{ts.replace(':', '-')}.json"
    with open(Path(JOURNAL_DIR) / filename, "w") as f:
        json.dump(entry, f, indent=2)


# ── Simulated Bonds ─────────────────────────────────────────────────────────
# In production, these would come from RPC. For paper simulation, we
# generate synthetic token states.

def simulate_new_tokens(count: int = 5) -> list[dict]:
    """Generate synthetic Pump.fun tokens for paper simulation."""
    tokens = []
    for i in range(count):
        tokens.append({
            "mint": f"paper_mint_{os.urandom(8).hex()}",
            "blocks_since_launch": random.randint(1, 20),
            "curve_completion_pct": random.uniform(0.05, 0.95),
            "volume_velocity": random.uniform(0.1, 5.0),
            "virtual_sol": VIRTUAL_SOL_RESERVES,
            "virtual_token": VIRTUAL_TOKEN_RESERVES,
            "real_token_remaining": REAL_TOKEN_RESERVES_START * (1 - random.uniform(0.01, 0.5)),
        })
    return tokens


def paper_price(token: dict) -> float:
    """Simulated price = virtual_sol / virtual_token * sol_price_usdc."""
    return (token["virtual_sol"] / token["virtual_token"]) * SOL_PRICE_USDC


def buy_cost(amount_tokens: float, token: dict) -> dict:
    """Simulated cost in SOL using bonding curve formula."""
    cost = (amount_tokens * token["virtual_sol"]) / (token["virtual_token"] - amount_tokens)
    fee = cost * (FEE_BPS / 10000.0)
    return {"cost_sol": cost + fee, "fee_sol": fee}


def sell_proceeds(amount_tokens: float, token: dict) -> dict:
    """Simulated proceeds in SOL."""
    proceeds = (amount_tokens * token["virtual_sol"]) / (token["virtual_token"] + amount_tokens)
    fee = proceeds * (FEE_BPS / 10000.0)
    return {"proceeds_sol": proceeds - fee, "fee_sol": fee}


# ── OODA Cycle ──────────────────────────────────────────────────────────────

def observe(pf: dict) -> dict:
    """O — Gather data from the simulated market."""
    tokens = simulate_new_tokens(random.randint(3, 8))
    # Filter out fully completed curves (migrated)
    active = [t for t in tokens if t["real_token_remaining"] > 0]
    return {
        "opportunities_scanned": len(active),
        "open_positions": len(pf["positions"]),
        "paper_balance_sol": pf["paper_balance_sol"],
        "tokens": active,
    }


def orient(data: dict) -> dict:
    """O — Score each opportunity and pick the best."""
    best = None
    best_score = 0.0

    for t in data["tokens"]:
        score = 0.0
        # Freshness: launched < FRESH_BLOCK_WINDOW blocks ago
        if t["blocks_since_launch"] < FRESH_BLOCK_WINDOW:
            score += 0.3
        # Curve completion > 50%
        completion = 1.0 - (t["real_token_remaining"] / REAL_TOKEN_RESERVES_START)
        if completion > CURVE_COMPLETION_TARGET:
            score += 0.3
        # Volume velocity
        score += min(t["volume_velocity"] / 5.0, 0.4)

        if score > best_score:
            best_score = score
            best = t

    return {
        "top_opportunity": best["mint"] if best else None,
        "score": best_score,
        "reasoning": (
            f"Launched {best['blocks_since_launch']} blocks ago, "
            f"curve at {1 - best['real_token_remaining'] / REAL_TOKEN_RESERVES_START:.0%}, "
            f"vol {best['volume_velocity']:.2f}"
            if best else "No opportunities found"
        ),
    }


def decide(orient_data: dict, pf: dict) -> dict:
    """D — Based on orientation, decide what to do."""
    # Check kill-switch
    if pf["consecutive_losses"] >= KILL_SWITCH_MAX_CONSECUTIVE_LOSSES:
        return {"action": "BEACH", "rationale": f"Kill-switch triggered ({pf['consecutive_losses']} consecutive losses)"}

    # Check minimum balance
    if pf["paper_balance_sol"] < MIN_PAPER_BALANCE_SOL:
        return {"action": "BEACH", "rationale": f"Balance ({pf['paper_balance_sol']:.2f} SOL) below minimum"}

    # Check existing positions for take-profit / stop-loss
    for pos in pf["positions"]:
        pnl = pos["pnl_pct"]
        if pnl >= TAKE_PROFIT_PCT:
            return {"action": "SELL", "rationale": f"Take-profit at {pnl:.1f}%", "position": pos}
        if pnl <= STOP_LOSS_PCT:
            return {"action": "SELL", "rationale": f"Stop-loss at {pnl:.1f}%", "position": pos}

    # Buy signal
    if (
        orient_data["score"] >= SCORE_THRESHOLD
        and len(pf["positions"]) < MAX_OPEN_POSITIONS
    ):
        return {
            "action": "BUY",
            "rationale": f"Score {orient_data['score']:.2f} >= threshold {SCORE_THRESHOLD}, "
                         f"positions {len(pf['positions'])}/{MAX_OPEN_POSITIONS}",
        }

    return {"action": "HOLD", "rationale": "No strong signal"}


def act(decision: dict, orient_data: dict, pf: dict) -> dict:
    """A — Execute the decision."""
    act_result = {"action": decision["action"], "details": {}}

    if decision["action"] == "BEACH":
        # Close all positions
        for pos in pf["positions"]:
            pf["paper_balance_sol"] += pos["entry_price_sol"] * pos["amount_tokens"]
        pf["positions"] = []
        STATE["beached"] = True
        act_result["details"] = {"closed_positions": len(pf["positions"])}

    elif decision["action"] == "SELL":
        pos = decision["position"]
        mint = pos["mint"]
        amount = pos["amount_tokens"]
        price = pos["current_price"]
        proceeds_sol = amount * price * (1 - FEE_BPS / 10000)
        pf["paper_balance_sol"] += proceeds_sol
        pnl = pos["pnl_pct"]
        pf["positions"] = [p for p in pf["positions"] if p["mint"] != mint]
        pf["total_trades"] += 1
        if pnl < 0:
            pf["consecutive_losses"] += 1
        else:
            pf["consecutive_losses"] = 0
        # Recalc win rate
        pf["win_rate"] = pf.get("winning_trades", 0) / max(pf["total_trades"], 1)
        act_result["details"] = {
            "mint": mint,
            "proceeds_sol": proceeds_sol,
            "pnl_pct": pnl,
        }

    elif decision["action"] == "BUY":
        # Find the token from orientation data
        target_mint = orient_data.get("top_opportunity")
        if not target_mint:
            return {"action": "HOLD", "details": {"reason": "No target mint available"}}

        # Find matching token from observation
        mint_entry = orient_data.get("top_opportunity", "")
        if not mint_entry:
            return {"action": "HOLD", "details": {"reason": "Cannot find opportunity"}}

        # Simulate buy: spend ~0.5 SOL
        spend_sol = min(0.5, pf["paper_balance_sol"] * 0.1)
        price_sol = 0.000001  # simulated price
        amount_tokens = spend_sol / price_sol

        pf["paper_balance_sol"] -= spend_sol
        pf["positions"].append({
            "mint": target_mint,
            "entry_price_sol": price_sol,
            "amount_tokens": amount_tokens,
            "current_price": price_sol,
            "pnl_pct": 0.0,
            "entry_time": datetime.now(timezone.utc).isoformat(),
        })
        pf["total_trades"] += 1
        pf["winning_trades"] = pf.get("winning_trades", 0)
        act_result["details"] = {
            "mint": target_mint,
            "amount_tokens": amount_tokens,
            "cost_sol": spend_sol,
        }

    else:  # HOLD
        # Update position prices (simulate drift)
        for pos in pf["positions"]:
            drift = random.uniform(-0.15, 0.20)
            pos["current_price"] = pos["entry_price_sol"] * (1 + drift)
            pos["pnl_pct"] = ((pos["current_price"] - pos["entry_price_sol"]) / pos["entry_price_sol"]) * 100

    act_result["details"]["consecutive_losses"] = pf["consecutive_losses"]
    return act_result


# ── Main Loop ────────────────────────────────────────────────────────────────

def main():
    print("🐍 Dark Ralph OODA Loop v0 — Starting paper trading")
    print(f"   Interval: {OODA_INTERVAL_SECONDS}s")
    print(f"   Kill-switch: {KILL_SWITCH_MAX_CONSECUTIVE_LOSSES} consecutive losses")
    print(f"   Max positions: {MAX_OPEN_POSITIONS}")
    print()

    pf = load_portfolio()
    STATE["beached"] = pf["consecutive_losses"] >= KILL_SWITCH_MAX_CONSECUTIVE_LOSSES

    while not STATE["beached"]:
        STATE["cycle"] += 1
        cycle = STATE["cycle"]
        print(f"[Cycle {cycle}] Starting OODA loop...")

        # O — Observe
        obs = observe(pf)

        # O — Orient
        ori = orient(obs)

        # D — Decide
        dec = decide(ori, pf)

        # A — Act
        act_res = act(dec, ori, pf)

        # Journal
        journal_entry(cycle, {
            "opportunities_scanned": obs["opportunities_scanned"],
            "open_positions": obs["open_positions"],
            "paper_balance_sol": obs["paper_balance_sol"],
        }, {
            "top_opportunity": ori["top_opportunity"],
            "score": ori["score"],
            "reasoning": ori["reasoning"],
        }, {
            "action": dec["action"],
            "rationale": dec["rationale"],
        }, act_res)

        # Save state
        save_portfolio(pf)

        # Print status
        pnl_line = " | ".join(
            f"{p['mint'][:12]}... {p['pnl_pct']:+.1f}%"
            for p in pf["positions"]
        )
        print(f"   Action: {act_res['action']:6s} | "
              f"Balance: {pf['paper_balance_sol']:.2f} SOL | "
              f"Positions: {len(pf['positions'])} | "
              f"Loss streak: {pf['consecutive_losses']}")
        if pnl_line:
            print(f"   P&L: {pnl_line}")

        if act_res["action"] == "BEACH":
            print("\n🔴 Ralph beached! Kill-switch triggered.")
            print("   Close all positions, notify creator.")
            break

        print(f"   Sleeping {OODA_INTERVAL_SECONDS}s...\n")
        time.sleep(OODA_INTERVAL_SECONDS)

    # Final report
    print("\n=== Ralph Final Report ===")
    print(f"Total cycles: {STATE['cycle']}")
    print(f"Total trades: {pf['total_trades']}")
    print(f"Win rate: {pf['win_rate']:.1%}")
    print(f"Final balance: {pf['paper_balance_sol']:.2f} SOL")
    print(f"Consecutive losses: {pf['consecutive_losses']}")
    print(f"Beached: {STATE['beached']}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nRalph stopped by user.")
        sys.exit(0)
