"""
Ralph Curve Scout Strategy — Paper Trading.

Identifies bonding curves approaching completion for
pre-migration entry. Designed for the OODA cycle's Orient phase.
"""
import random


def score(token: dict, config: dict) -> float:
    """
    Score a token for curve completion entry (higher = better).
    
    Factors:
    - Completion: curve is > 50% complete
    - Velocity: steady volume indicates organic growth
    - Not yet migrated: real_token_remaining > 0
    """
    score = 0.0
    completion = 1.0 - (token.get("real_token_remaining", 1) / config.get("REAL_TOKEN_RESERVES_START", 1))
    
    # Completion bonus — sweet spot is 50-85%
    if 0.5 < completion < 0.85:
        score += 0.5
    
    # Steady volume
    vol = token.get("volume_velocity", 0)
    if 1.0 < vol < 4.0:
        score += 0.3
    
    # Remaining runway
    remaining = token.get("real_token_remaining", 0)
    if remaining > 0:
        score += 0.2
    
    return min(score, 1.0)
