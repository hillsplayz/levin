"""What would different filters have let through?   python whatif.py

Reads tokens.jsonl (written by the desk), keeps the best numbers each unique token ever
showed, and counts how many unique tokens would clear the free checks and the trade check
under the guide's thresholds versus the 'explore' set, plus a few in-between steps."""
import json, os, sys, collections
os.environ.pop("DESK_PROFILE", None)
from thresholds import HARD_BLUEPRINT as BP, EXPLORE

path = os.environ.get("DESK_TOKENS", "tokens.jsonl")
try:
    rows = [json.loads(x) for x in open(path) if x.strip()]
except FileNotFoundError:
    sys.exit(f"{path} not found. Run the updated desk for a while first.")

best = {}
for r in rows:                                   # keep each token's best-seen numbers
    b = best.setdefault(r["tid"], {"ticker": r.get("ticker"), "kills": collections.Counter()})
    b["kills"][r["kill"]] += 1
    for k in ("age_minutes", "mcap_usd", "liquidity_usd", "volume_h24", "holder_count", "trades_h24"):
        if r.get(k) is not None:
            b[k] = max(b.get(k, 0), r[k])
toks = list(best.values())
print(f"{len(rows)} rows, {len(toks)} unique tokens\n")


def passes(t, h):
    """The free cut, then the trade cut when we have trade data for the token."""
    free = (h["min_age_minutes"] <= t.get("age_minutes", 0) <= h["max_age_hours"] * 60
            and t.get("liquidity_usd", 0) >= h["min_liquidity_usd"]
            and t.get("volume_h24", 0) >= h["min_volume_h24"]
            and h["min_mcap_usd"] <= t.get("mcap_usd", 0) <= h["max_mcap_usd"])
    trade = t.get("trades_h24") is None or t["trades_h24"] >= h["min_trades_h24"]
    return free, free and trade


def row(name, h):
    steps = [("age", lambda t: h["min_age_minutes"] <= t.get("age_minutes", 0) <= h["max_age_hours"] * 60),
             ("+ liquidity", lambda t: t.get("liquidity_usd", 0) >= h["min_liquidity_usd"]),
             ("+ volume", lambda t: t.get("volume_h24", 0) >= h["min_volume_h24"]),
             ("+ mcap", lambda t: h["min_mcap_usd"] <= t.get("mcap_usd", 0) <= h["max_mcap_usd"])]
    left, out = toks, []
    for label, f in steps:
        left = [t for t in left if f(t)]
        out.append(f"{label} {len(left)}")
    n_trade = sum(1 for t in left if t.get("trades_h24") is None or t["trades_h24"] >= h["min_trades_h24"])
    print(f"{name:10} " + " | ".join(out) + f" | + trades {n_trade}")


row("guide", BP)
row("explore", {**BP, **EXPLORE})
mid = {**BP, "min_liquidity_usd": 8_000, "min_volume_h24": 20_000, "min_mcap_usd": 40_000, "min_trades_h24": 100}
row("in-between", mid)

print("\nBest numbers seen across all unique tokens (percentiles):")
for k, label in (("mcap_usd", "market cap"), ("liquidity_usd", "liquidity"), ("volume_h24", "24h volume")):
    v = sorted(t.get(k, 0) for t in toks)
    if v:
        q = lambda p: int(v[min(len(v) - 1, int(len(v) * p))])
        print(f"  {label:11} median ${q(.5):,}  p90 ${q(.9):,}  p99 ${q(.99):,}  max ${int(v[-1]):,}")
surv = sum(1 for t in toks if t["kills"].get("survivor"))
print(f"\nSurvivors (reached the end): {surv}")
