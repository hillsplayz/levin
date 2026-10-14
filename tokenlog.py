"""Every token the funnel judges leaves one line in tokens.jsonl: its numbers and why it
died (or 'survivor'). That is the data whatif.py needs to answer 'what would loosening
this filter have let through?' without guessing."""
import hashlib, json, os, time

KEYS = ("tid", "ticker", "age_minutes", "mcap_usd", "liquidity_usd", "volume_h24",
        "holder_count", "trades_h24", "buys_h1", "sells_h1", "top_10_percent",
        "top_wallet_percent")


def lead_id(tid: str) -> str:
    """One short id per token, the same at every stage (log, pick, order, paper trade,
    Telegram). If an address ever differs between two stages, the ids will not match."""
    return hashlib.sha1(tid.lower().encode()).hexdigest()[:8]


def log(t: dict, kill: str):
    row = {"ts": round(time.time()), "kill": kill}
    if t.get("tid"):
        row["lead_id"] = lead_id(t["tid"])
    row.update({k: t[k] for k in KEYS if t.get(k) is not None})
    try:
        with open(os.environ.get("DESK_TOKENS", "tokens.jsonl"), "a") as f:
            f.write(json.dumps(row) + "\n")
    except OSError:
        pass                                     # logging must never stop the desk
