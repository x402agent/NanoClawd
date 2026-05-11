"""
Ralph Sniper Strategy — Paper Trading.

Identifies new Pump.fun token launches and scores them for
immediate entry. Designed for the OODA cycle's Orient phase.
"""
import random


def score(token: dict, config: dict) -> float:
    """
    Score a token for sniper entry (higher = better).
    
    Factors:
    - Recency: launched within fresh block window
    - Curve entry: still early on the curve (< 20% completion)
    - Volume: some activity but not exhausted
    """
    score = 0.0
    
    # Freshness bonus
    if token.get("blocks_since_launch", 99) < config.get("FRESH_BLOCK_WINDOW", 10):
        score += 0.4
    
    # Early curve bonus
    completion = 1.0 - (token.get("real_token_remaining", 1) / config.get("REAL_TOKEN_RESERVES_START", 1))
    if completion < 0.2:
        score += 0.3
    
    # Volume velocity (not too hot, not cold)
    vol = token.get("volume_velocity", 0)
    if 0.5 < vol < 3.0:
        score += 0.3
    
    return min(score, 1.0)
