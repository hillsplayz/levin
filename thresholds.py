HARD = {                        # stage 2, arithmetic, runs before anything costs money
    "min_age_minutes":   15,    # younger than this and the data is noise
    "max_age_hours":     72,    # older than this and it is not a launch any more
    "min_liquidity_usd": 12_000,
    "min_volume_h24":    40_000,
    "min_mcap_usd":      60_000,
    "max_mcap_usd":      8_000_000,
    "min_trades_h24":    150,
    "max_top_wallet":    0.05,  # solana only, exact, from RPC
    "max_top_10":        0.60,  # where distribution exists
    "min_holders":       80,
}

HARD_BLUEPRINT = dict(HARD)     # the guide's exact numbers, kept for comparison

# Free-cut thresholds. The guide's exact numbers are HARD_BLUEPRINT above. The default is the
# looser EXPLORE set below because the guide's set passed 0 of ~2,000 sightings in 38 cycles.
# Everything after the free cut is unchanged except max_top_wallet / max_top_10 here.
# Switch back with DESK_PROFILE=blueprint (desk.env). Paper trading only, please.
EXPLORE = {"min_age_minutes": 10, "min_liquidity_usd": 5_000, "min_volume_h24": 10_000,
           "min_mcap_usd": 25_000, "min_trades_h24": 50, "min_holders": 30,
           "max_top_wallet": 0.08, "max_top_10": 0.70}
import os as _os
if _os.environ.get("DESK_PROFILE", "explore") != "blueprint":
    HARD.update(EXPLORE)

# A token that misses liquidity / volume / mcap by a modest margin while still young may be
# on its way up. Re-check it instead of benching it. Re-checks ride in the FOMO batch.
NEAR_MISS_FRACTION    = 0.4    # within reach: at least 40% of the threshold
NEAR_MISS_MAX_AGE_H   = 6      # only while the token is still young
NEAR_MISS_RECHECK_MIN = 20     # look again in 20 minutes (4 tries, then benched)

SOFT = {                        # applied to Jev's answers, per token
    "concentration_is_exit_risk": ("max", 0.55),
    "momentum_already_spent":     ("max", 0.60),
    "liquidity_fits_ticket":      ("min", 0.60),
    "account_is_the_project":     ("min", 0.70),
    "recycled_account":           ("max", 0.50),
    "audience_is_real":           ("min", 0.45),
    "effort":                     ("min", 1.0),
    "dev_still_loaded":           ("max", 0.55),
    "sellable_by_evidence":       ("min", 0.60),   # robinhood
}

SHAPE_MIN_CROWD = 0.55          # probabilities["crowd"], not the winning label
PICK_MIN_WORTH  = 0.60
PICK_MIN_CONF   = 0.55
DARK_TICKET_CUT = 0.40          # robinhood, data_coverage == dark
NO_SOCIAL_CUT   = 0.60          # no usable X handle: trade smaller, do not skip

# ---- paper executor (SIZE / FILLS / RISK as code) ----------------------------------
TICKET_PCT_MAX    = 0.06    # SIZE step 1: never more than 6% of free cash
TICKET_LIQ_CAP    = 0.02    # SIZE step 3: never more than 2% of the pool's liquidity
FEE_RATE          = 0.0045  # FILLS step 1: fee = max(0.45% of ticket, floor)
FEE_FLOOR_USD     = 0.95
MAX_EFFECTIVE_FEE = 0.02    # FILLS step 2: fee/ticket above this -> FEE_FLOOR, no fill
MAX_SLIPPAGE_BPS  = 300     # FILLS step 4: above this the fill is flagged loudly
RISK_MIN_RATIO    = 0.20    # RISK: volume.h6 / (volume.h24 / 4) below this -> CLOSE
RISK_RETRIES      = 2       # no data: retry twice, then CLOSE anyway
MAX_WATCH_TRIES   = 4       # too-young tokens are re-checked this many times

# ---- exits and limits adopted from the second blueprint (EXIT / RUG / Head of Desk) ----
# The guide's RISK has ONE rule (volume drain). A rug pulls liquidity while people dump,
# so volume spikes and that rule stays quiet. These add the missing price and liquidity
# exits. All of them are starting guesses to be tuned from paper data, not proven numbers.
STOP_LOSS_PCT      = 0.30   # close if price is 30% under the entry fill
LIQ_PULL_PCT       = 0.50   # close if pool liquidity is under 50% of its level at entry
TRAIL_ARM_PCT      = 0.40   # once price is +40% over entry, start trailing the peak
TRAIL_GAP_PCT      = 0.25   # then close if price falls 25% below its peak
MAX_HOLD_HOURS     = 12     # nothing is held longer than this
MAX_DAILY_LOSS_PCT = 0.05   # realised loss today >= 5% of the start bank halts new entries
RISK_POLL_SECONDS  = 60     # was 300; one free DexScreener call a minute while a position is open
