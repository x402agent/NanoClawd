"""
Ralph OODA Loop — Configuration & Kill-Switch Settings.

All tunable parameters live here. Modify these values to adjust
Ralph's risk appetite, speed, and strategy thresholds.
"""

# ── Kill-Switch ──────────────────────────────────────────────────────────────
KILL_SWITCH_MAX_CONSECUTIVE_LOSSES = 5
MIN_PAPER_BALANCE_SOL = 1.0
MAX_OPEN_POSITIONS = 10

# ── Timing ───────────────────────────────────────────────────────────────────
OODA_INTERVAL_SECONDS = 60      # seconds between OODA cycles

# ── Scoring ──────────────────────────────────────────────────────────────────
SCORE_THRESHOLD = 0.7           # minimum score to trigger a buy
FRESH_BLOCK_WINDOW = 10         # tokens launched < N blocks ago are "fresh"
CURVE_COMPLETION_TARGET = 0.5   # target > 50% curve completion

# ── P&L Thresholds ───────────────────────────────────────────────────────────
TAKE_PROFIT_PCT = 50.0          # sell when position profit exceeds this %
STOP_LOSS_PCT = -30.0           # sell when position loss exceeds this %

# ── Paper Wallet ─────────────────────────────────────────────────────────────
DEVNET_PAPER_WALLET = "paper_wallet_devnet_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
INITIAL_PAPER_SOL = 100.0       # starting paper SOL balance
INITIAL_PAPER_USDC = 1000.0     # starting paper USDC balance

# ── Bonding Curve (Pump.fun Simulated) ───────────────────────────────────────
VIRTUAL_SOL_RESERVES = 30.0             # 30 SOL
VIRTUAL_TOKEN_RESERVES = 1_073_000_000_000_000.0
REAL_TOKEN_RESERVES_START = 793_100_000_000_000.0
TOTAL_SUPPLY = 1_000_000_000_000_000.0
FEE_BPS = 100                           # 1%
SOL_PRICE_USDC = 180.0                  # simulated SOL/USDC price

# ── Directory Paths ──────────────────────────────────────────────────────────
BASE_DIR = "/workspace/agent/ralph"
PORTFOLIO_PATH = f"{BASE_DIR}/portfolio.json"
JOURNAL_DIR = f"{BASE_DIR}/journal"
STRATEGIES_DIR = f"{BASE_DIR}/strategies"
