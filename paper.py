"""Paper trading: SIZE, FILLS and RISK from the blueprint, as code, with simulated fills.

Prices and liquidity come from DexScreener for BOTH entry and exit, so the PnL does not
mix two data sources. Slippage is modelled as a constant-product pool: buying `T` dollars
into `L` dollars of liquidity moves the price by about 2*T/L. Fees follow the blueprint:
max(0.45% of ticket, $0.95). This is a model, not a promise of what a real fill gives.
"""
import json, logging, os, time, requests
import book
from thresholds import (TICKET_PCT_MAX, TICKET_LIQ_CAP, FEE_RATE, FEE_FLOOR_USD,
                        MAX_EFFECTIVE_FEE, MAX_SLIPPAGE_BPS, RISK_MIN_RATIO, RISK_RETRIES)

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


def start_bank() -> float:
    return float(os.environ.get("DESK_BANK_USD", "0"))


def free_cash() -> float:
    """Start bank + realised PnL - whatever is locked in an open position."""
    q = lambda sql: book.DB.execute(sql).fetchone()[0] or 0.0
    realised = q("SELECT SUM(pnl_usd) FROM paper_trades WHERE closed_at IS NOT NULL")
    locked = q("SELECT SUM(ticket_usd) FROM paper_trades WHERE closed_at IS NULL")
    return start_bank() + realised - locked


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
    """SIZE then FILLS. Returns {'status': 'FILLED' | 'SIZE_ZERO' | 'FEE_FLOOR' | 'NO_QUOTE'}."""
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
        "entry_fee,slippage_bps,flags,confidence,size_factor,model,mark_price,mark_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (t["ticker"], t["address"], t["network_id"], t["chain"], time.time(), fill, qty,
         ticket, f, slip_bps, json.dumps(flags), conf, order.get("size_factor"),
         order.get("model"), snap["price"], time.time()))
    book.DB.commit()
    book.take(order)                 # the desk is now held until RISK closes it
    return {"status": "FILLED", "ticket": ticket, "fill_price": fill,
            "slippage_bps": round(slip_bps, 1), "fee": round(f, 2), "flags": flags}


def _open_row():
    cur = book.DB.execute("SELECT id,ticker,addr,net,entry_price,qty,ticket_usd,mark_price "
                          "FROM paper_trades WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1")
    return cur.fetchone()


def _close(row, snap, reason):
    tid, ticker, addr, net, entry, qty, ticket, last = row
    price = snap["price"] if snap else (last or entry)
    liq = snap["liq"] if snap else None
    value = qty * price
    impact = min(2 * value / liq, 0.99) if liq else 0.0     # selling pushes the price down
    exit_price = price * (1 - impact)
    f = fee(value)
    proceeds = max(qty * exit_price - f, 0.0)
    pnl = proceeds - ticket
    book.DB.execute("UPDATE paper_trades SET closed_at=?,exit_price=?,exit_fee=?,proceeds=?,"
                    "pnl_usd=?,pnl_pct=?,reason=? WHERE id=?",
                    (time.time(), exit_price, f, proceeds, pnl, pnl / ticket * 100, reason, tid))
    book.DB.commit()
    book.release()                   # RISK frees the book, and nothing else does
    log.info("CLOSED %s: %s, PnL $%.2f (%.1f%%)", ticker, reason, pnl, pnl / ticket * 100)
    return {"status": "CLOSED", "ticker": ticker, "reason": reason, "pnl_usd": round(pnl, 2)}


def risk_tick(sleep=time.sleep):
    """The one rule. avg_6h = volume.h24 / 4; ratio = volume.h6 / avg_6h; below 0.20 CLOSE.
    No data: retry twice, then CLOSE anyway. A position you cannot measure is not held."""
    row = _open_row()
    if not row:
        return None
    snap = None
    for attempt in range(RISK_RETRIES + 1):
        s = snapshot(row[2], row[3])
        if s and s["vol_h24"] > 0:
            snap = s
            break
        if attempt < RISK_RETRIES:
            sleep(2)
    if snap is None:
        return _close(row, None, "NO_DATA")
    ratio = snap["vol_h6"] / (snap["vol_h24"] / 4)
    book.DB.execute("UPDATE paper_trades SET mark_price=?,mark_at=?,vol_ratio=? WHERE id=?",
                    (snap["price"], time.time(), ratio, row[0]))
    book.DB.commit()
    if ratio < RISK_MIN_RATIO:
        return _close(row, snap, f"VOLUME_DRAIN ratio {ratio:.2f}")
    return {"status": "HOLD", "ticker": row[1], "ratio": round(ratio, 2)}
