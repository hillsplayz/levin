"""Paper trading: SIZE, FILLS and RISK from the blueprint, as code, with simulated fills.

Prices and liquidity come from DexScreener for BOTH entry and exit, so the PnL does not
mix two data sources. Slippage is modelled as a constant-product pool: buying `T` dollars
into `L` dollars of liquidity moves the price by about 2*T/L. Fees follow the blueprint:
max(0.45% of ticket, $0.95). This is a model, not a promise of what a real fill gives.
"""
import json, logging, os, time, requests
import book
from thresholds import (TICKET_PCT_MAX, TICKET_LIQ_CAP, FEE_RATE, FEE_FLOOR_USD,
                        MAX_EFFECTIVE_FEE, MAX_SLIPPAGE_BPS, RISK_MIN_RATIO, RISK_RETRIES,
                        STOP_LOSS_PCT, LIQ_PULL_PCT, TRAIL_ARM_PCT, TRAIL_GAP_PCT,
                        MAX_HOLD_HOURS, MAX_DAILY_LOSS_PCT)

log = logging.getLogger("desk")
DEX = "https://api.dexscreener.com/latest/dex/tokens"
DEX_CHAIN = {1399811149: "solana", 56: "bsc", 8453: "base"}

book.DB.executescript("""
CREATE TABLE IF NOT EXISTS paper_trades(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT, addr TEXT, net INT, chain TEXT,
  opened_at REAL, entry_price REAL, qty REAL, ticket_usd REAL, entry_fee REAL,
  slippage_bps REAL, flags TEXT, confidence REAL, size_factor REAL, model TEXT,
  mark_price REAL, mark_at REAL, vol_ratio REAL,
  closed_at REAL, exit_price REAL, exit_fee REAL, proceeds REAL,
  pnl_usd REAL, pnl_pct REAL, reason TEXT);
""")
for _col, _type in (("liq_entry", "REAL"), ("peak_price", "REAL"), ("lead_id", "TEXT")):
    try:                                          # older desk.db files get the new columns
        book.DB.execute(f"ALTER TABLE paper_trades ADD COLUMN {_col} {_type}")
    except Exception:
        pass
book.DB.commit()


def start_bank() -> float:
    return float(os.environ.get("DESK_BANK_USD", "0"))


def free_cash() -> float:
    """Start bank + realised PnL - whatever is locked in an open position."""
    q = lambda sql: book.DB.execute(sql).fetchone()[0] or 0.0
    realised = q("SELECT SUM(pnl_usd) FROM paper_trades WHERE closed_at IS NOT NULL")
    locked = q("SELECT SUM(ticket_usd) FROM paper_trades WHERE closed_at IS NULL")
    return start_bank() + realised - locked


def today_start() -> float:
    lt = time.localtime()
    return time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, -1))


def realised_today() -> float:
    r = book.DB.execute("SELECT SUM(pnl_usd) FROM paper_trades WHERE closed_at >= ?",
                        (today_start(),)).fetchone()[0]
    return r or 0.0


def halted():
    """Why the desk is halted, or None. Only a human clears it (/resume on Telegram)."""
    return book.get_flag("halt")


def snapshot(addr: str, net: int):
    """price, liquidity and volumes off DexScreener's deepest pool for this token."""
    try:
        pairs = requests.get(f"{DEX}/{addr}", timeout=20).json().get("pairs") or []
    except Exception:
        return None
    chain = DEX_CHAIN.get(net)
    pairs = [p for p in pairs if p.get("chainId") == chain] or pairs
    pairs = [p for p in pairs if (p.get("liquidity") or {}).get("usd")]
    if not pairs:
        return None
    p = max(pairs, key=lambda x: x["liquidity"]["usd"])
    v = p.get("volume") or {}
    try:
        return {"price": float(p["priceUsd"]), "liq": float(p["liquidity"]["usd"]),
                "vol_h6": float(v.get("h6") or 0), "vol_h24": float(v.get("h24") or 0)}
    except (KeyError, TypeError, ValueError):
        return None


def fee(usd: float) -> float:
    return max(FEE_RATE * usd, FEE_FLOOR_USD)


def open_position(order: dict, bank: float) -> dict:
    """SIZE then FILLS. Returns {'status': 'FILLED' | 'HALTED' | 'SIZE_ZERO' | 'FEE_FLOOR' | 'NO_QUOTE'}."""
    if halted():
        return {"status": "HALTED", "why": halted()}
    t = order["token"]
    snap = snapshot(t["address"], t["network_id"])
    if not snap or snap["price"] <= 0:
        return {"status": "NO_QUOTE"}

    # SIZE. kelly(edge) is not defined in the blueprint, so confidence stands in for it:
    # a pick at confidence 1.0 gets the full 6%, at 0.5 or below it gets 3%.
    conf = order.get("confidence")
    edge = 0.5 if conf is None else max(0.5, min(1.0, conf))
    ticket = bank * TICKET_PCT_MAX * edge
    ticket *= order.get("size_factor") or 1.0
    ticket = round(min(ticket, snap["liq"] * TICKET_LIQ_CAP), 2)
    if ticket <= 0:
        return {"status": "SIZE_ZERO"}

    # FILLS: fee floor first, then the simulated market order
    f = fee(ticket)
    if f / ticket > MAX_EFFECTIVE_FEE:
        min_ticket = round(FEE_FLOOR_USD / MAX_EFFECTIVE_FEE, 2)
        return {"status": "FEE_FLOOR", "ticket": ticket, "min_viable_ticket": min_ticket}
    impact = 2 * ticket / snap["liq"]
    slip_bps = impact * 1e4
    fill = snap["price"] * (1 + impact)
    flags = ["SLIPPAGE"] if slip_bps > MAX_SLIPPAGE_BPS else []
    qty = (ticket - f) / fill

    book.DB.execute(
        "INSERT INTO paper_trades(ticker,addr,net,chain,opened_at,entry_price,qty,ticket_usd,"
        "entry_fee,slippage_bps,flags,confidence,size_factor,model,mark_price,mark_at,"
        "liq_entry,peak_price,lead_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (t["ticker"], t["address"], t["network_id"], t["chain"], time.time(), fill, qty,
         ticket, f, slip_bps, json.dumps(flags), conf, order.get("size_factor"),
         order.get("model"), snap["price"], time.time(), snap["liq"], snap["price"],
         t.get("lead_id")))
    book.DB.commit()
    book.take(order)                 # the desk is now held until RISK closes it
    return {"status": "FILLED", "ticket": ticket, "fill_price": fill,
            "slippage_bps": round(slip_bps, 1), "fee": round(f, 2), "flags": flags}


def _open_row():
    cur = book.DB.execute("SELECT * FROM paper_trades WHERE closed_at IS NULL "
                          "ORDER BY id DESC LIMIT 1")
    r = cur.fetchone()
    return dict(zip([c[0] for c in cur.description], r)) if r else None


def _close(row, snap, reason):
    price = snap["price"] if snap else (row["mark_price"] or row["entry_price"])
    liq = snap["liq"] if snap else None
    value = row["qty"] * price
    impact = min(2 * value / liq, 0.99) if liq else 0.0     # selling pushes the price down
    exit_price = price * (1 - impact)
    f = fee(value)
    proceeds = max(row["qty"] * exit_price - f, 0.0)
    pnl = proceeds - row["ticket_usd"]
    book.DB.execute("UPDATE paper_trades SET closed_at=?,exit_price=?,exit_fee=?,proceeds=?,"
                    "pnl_usd=?,pnl_pct=?,reason=? WHERE id=?",
                    (time.time(), exit_price, f, proceeds, pnl,
                     pnl / row["ticket_usd"] * 100, reason, row["id"]))
    book.DB.commit()
    book.release()                   # RISK frees the book, and nothing else does
    log.info("CLOSED %s: %s, PnL $%.2f (%.1f%%)", row["ticker"], reason, pnl,
             pnl / row["ticket_usd"] * 100)
    out = {"status": "CLOSED", "ticker": row["ticker"], "reason": reason,
           "pnl_usd": round(pnl, 2)}
    limit = start_bank() * MAX_DAILY_LOSS_PCT
    if limit > 0 and realised_today() <= -limit and not halted():
        why = f"daily loss ${-realised_today():.2f} reached the {MAX_DAILY_LOSS_PCT:.0%} limit"
        book.set_flag("halt", why)
        out["halted"] = why                          # main tells you; only you can resume
    return out


def risk_tick(sleep=time.sleep):
    """Exit rules, checked in this order. First match closes the whole position.
       NO_DATA        no quote after retries (the guide: a position you cannot measure is not held)
       LIQUIDITY_PULLED  pool liquidity under LIQ_PULL_PCT of its level at entry (rug signal)
       STOP_LOSS      price STOP_LOSS_PCT under the entry fill
       TRAILING_STOP  once +TRAIL_ARM_PCT, price TRAIL_GAP_PCT under its peak
       VOLUME_DRAIN   the guide's rule: volume.h6 / (volume.h24 / 4) under 0.20
       MAX_HOLD       held longer than MAX_HOLD_HOURS"""
    row = _open_row()
    if not row:
        return None
    snap = None
    for attempt in range(RISK_RETRIES + 1):
        s = snapshot(row["addr"], row["net"])
        if s and s["vol_h24"] > 0:
            snap = s
            break
        if attempt < RISK_RETRIES:
            sleep(2)
    if snap is None:
        return _close(row, None, "NO_DATA")

    price, entry = snap["price"], row["entry_price"]
    peak = max(row["peak_price"] or entry, price)
    ratio = snap["vol_h6"] / (snap["vol_h24"] / 4)
    book.DB.execute("UPDATE paper_trades SET mark_price=?,mark_at=?,vol_ratio=?,peak_price=? "
                    "WHERE id=?", (price, time.time(), ratio, peak, row["id"]))
    book.DB.commit()

    liq0 = row["liq_entry"]
    if liq0 and snap["liq"] < liq0 * LIQ_PULL_PCT:
        return _close(row, snap, f"LIQUIDITY_PULLED {snap['liq'] / liq0:.0%} of entry")
    if price <= entry * (1 - STOP_LOSS_PCT):
        return _close(row, snap, f"STOP_LOSS {price / entry - 1:+.0%}")
    if peak >= entry * (1 + TRAIL_ARM_PCT) and price <= peak * (1 - TRAIL_GAP_PCT):
        return _close(row, snap, f"TRAILING_STOP {price / peak - 1:+.0%} from peak")
    if ratio < RISK_MIN_RATIO:
        return _close(row, snap, f"VOLUME_DRAIN ratio {ratio:.2f}")
    if time.time() - row["opened_at"] > MAX_HOLD_HOURS * 3600:
        return _close(row, snap, f"MAX_HOLD {MAX_HOLD_HOURS}h")
    return {"status": "HOLD", "ticker": row["ticker"], "ratio": round(ratio, 2),
            "pnl_pct": round((price / entry - 1) * 100, 1)}
