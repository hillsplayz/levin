"""Local dashboard: python -m uvicorn dashboard:app --port 8090  ->  http://127.0.0.1:8090

Read-only. Reads cycles.jsonl, shadow.jsonl and desk.db written by the desk.
PAPER PnL = current FOMO price vs the price when the desk would have entered. It ignores
fees and slippage and the RISK exit rule, so treat it as a rough direction, not money.
"""
import json, os, sqlite3, time
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()
HERE = Path(__file__).parent
_fomo, _price_cache = None, {}


def _lines(path, limit=500):
    try:
        with open(path) as f:
            rows = [json.loads(x) for x in f if x.strip()]
        return rows[-limit:]
    except FileNotFoundError:
        return []


def _db(sql):
    try:
        c = sqlite3.connect(f"file:{HERE / 'desk.db'}?mode=ro", uri=True)
        try:
            return c.execute(sql).fetchall()
        finally:
            c.close()
    except Exception:
        return []


def _price(tid):
    """Current price from FOMO, cached 60s. None if FOMO/Chrome is not reachable."""
    global _fomo
    hit = _price_cache.get(tid)
    if hit and time.time() - hit[0] < 60:
        return hit[1]
    try:
        if _fomo is None:
            from fomo_api import Fomo
            _fomo = Fomo()
        row = _fomo.tokens([tid]).get(tid)
        p = row["price"] if row else None
    except Exception:
        p = None
    _price_cache[tid] = (time.time(), p)
    return p


@app.get("/api/state")
def state():
    cycles = _lines(HERE / "cycles.jsonl")
    shadow = _lines(HERE / "shadow.jsonl", 100)

    funnel = {"free": {}, "trade": {}, "chain": {}, "soft": {}}
    seen = benched = held = 0
    for c in cycles:
        st = c.get("stats") or {}
        if "held" in st:
            held += 1
            continue
        seen += st.get("seen", 0)
        benched += st.get("benched", 0)
        for stage in funnel:
            for k, v in (st.get(stage) or {}).items():
                funnel[stage][k] = funnel[stage].get(k, 0) + v

    orders = []
    for r in shadow:
        o = r.get("order") or {}
        t = o.get("token") or {}
        entry = t.get("price_usd")
        tid = f"{t.get('address')}:{t.get('network_id')}"
        now = _price(tid) if entry else None
        pnl = (now / entry - 1) * 100 if entry and now else None
        orders.append({"ts": r["ts"], "ticker": t.get("ticker"), "chain": t.get("chain"),
                       "entry": entry, "now": now, "pnl_pct": pnl,
                       "confidence": o.get("confidence"), "size_factor": o.get("size_factor"),
                       "model": o.get("model")})
    pnls = [o["pnl_pct"] for o in orders if o["pnl_pct"] is not None]

    pos = _db("SELECT ticker, opened_at FROM position WHERE id=1")
    bench = _db("SELECT reason, COUNT(*) FROM bench WHERE until > strftime('%s','now') GROUP BY reason")
    return {
        "now": time.time(), "mode": "see run.py (shadow unless --live)",
        "cycle_count": len(cycles), "last_cycle": cycles[-1]["ts"] if cycles else None,
        "seen": seen, "benched": benched, "held_cycles": held, "funnel": funnel,
        "position": {"ticker": pos[0][0], "since": pos[0][1]} if pos else None,
        "bench": {r[0]: r[1] for r in bench},
        "orders": orders[::-1],
        "paper": {"n": len(orders), "priced": len(pnls),
                  "avg_pct": sum(pnls) / len(pnls) if pnls else None,
                  "wins": sum(1 for p in pnls if p > 0)},
        "recent": [{"ts": c["ts"], "stats": c.get("stats"),
                    "order": ((c.get("order") or {}).get("token") or {}).get("ticker")}
                   for c in cycles[-15:]][::-1],
    }


@app.get("/", response_class=HTMLResponse)
def index():
    return (HERE / "dashboard.html").read_text(encoding="utf-8")
