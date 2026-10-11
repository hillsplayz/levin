"""Telegram commands: message your bot from your phone, it answers from the desk's files.

  /status   is a position open, when the last cycle ran, how many tokens are benched
  /pnl      paper PnL: realised, open, win rate, fees
  /trades   the last 5 paper trades
  /help

Read-only. It cannot trade, stop the desk or change anything. It only answers the chat
whose id is in TELEGRAM_CHAT; everyone else is ignored.
"""
import json, logging, os, sqlite3, time, requests

log = logging.getLogger("desk")
DB = os.environ.get("DESK_DB", "desk.db")


def _q(sql, args=()):
    try:
        c = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        try:
            return c.execute(sql, args).fetchall()
        finally:
            c.close()
    except Exception:
        return []


def _last_cycle():
    try:
        with open("cycles.jsonl") as f:
            lines = [x for x in f if x.strip()]
        return json.loads(lines[-1]) if lines else None
    except Exception:
        return None


def _usd(v):
    return f"{'+' if v >= 0 else '-'}${abs(v):.2f}"


def status() -> str:
    out = []
    c = _last_cycle()
    out.append(f"Last cycle: {round((time.time() - c['ts']) / 60)} min ago" if c
               else "No cycle recorded yet")
    p = _q("SELECT ticker, ticket_usd, qty, mark_price, vol_ratio, opened_at FROM paper_trades "
           "WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1")
    if p:
        t, ticket, qty, mark, ratio, opened = p[0]
        pnl = (qty * mark - ticket) if mark else 0
        out.append(f"Open: {t}, ${ticket:.2f} in, {_usd(pnl)} marked, "
                   f"volume ratio {ratio if ratio is None else round(ratio, 2)}, "
                   f"{round((time.time() - opened) / 60)} min")
    else:
        out.append("No open position")
    b = _q("SELECT COUNT(*) FROM bench WHERE until > ?", (time.time(),))
    w = _q("SELECT COUNT(*) FROM watch")
    out.append(f"Benched: {b[0][0] if b else 0}, watching young tokens: {w[0][0] if w else 0}")
    return "\n".join(out)


def pnl() -> str:
    rows = _q("SELECT pnl_usd, entry_fee, exit_fee, closed_at FROM paper_trades")
    if not rows:
        return "No paper trades yet."
    closed = [r for r in rows if r[3]]
    realised = sum(r[0] for r in closed)
    wins = sum(1 for r in closed if r[0] > 0)
    fees = sum((r[1] or 0) + (r[2] or 0) for r in rows)
    o = _q("SELECT qty, mark_price, ticket_usd FROM paper_trades WHERE closed_at IS NULL")
    open_pnl = sum(q * m - t for q, m, t in o if m)
    wr = f"{round(wins / len(closed) * 100)}%" if closed else "n/a"
    return (f"Paper PnL\nRealised: {_usd(realised)} ({len(closed)} closed, win rate {wr})\n"
            f"Open: {_usd(open_pnl)}\nFees paid: ${fees:.2f}\n"
            "(simulated fills, not real money)")


def trades() -> str:
    rows = _q("SELECT ticker, ticket_usd, pnl_usd, pnl_pct, reason, closed_at FROM paper_trades "
              "ORDER BY id DESC LIMIT 5")
    if not rows:
        return "No paper trades yet."
    return "\n".join(
        f"{t}: ${tk:.0f} -> {_usd(p)} ({pc:.1f}%) {r}" if ca else f"{t}: ${tk:.0f}, open"
        for t, tk, p, pc, r, ca in rows)


COMMANDS = {"/status": status, "/pnl": pnl, "/trades": trades}
HELP = "Commands: /status /pnl /trades /help\nRead-only: I cannot trade or stop the desk."


def handle(text: str) -> str:
    cmd = (text or "").strip().split()[0].split("@")[0].lower() if (text or "").strip() else ""
    fn = COMMANDS.get(cmd)
    return fn() if fn else HELP


def run_forever():
    tok, chat = os.environ["TELEGRAM_TOKEN"], str(os.environ["TELEGRAM_CHAT"])
    base, offset = f"https://api.telegram.org/bot{tok}", 0
    log.info("telegram commands on: /status /pnl /trades")
    while True:
        try:
            r = requests.get(f"{base}/getUpdates", params={"timeout": 30, "offset": offset},
                             timeout=45).json()
            for u in r.get("result", []):
                offset = u["update_id"] + 1
                m = u.get("message") or {}
                if str((m.get("chat") or {}).get("id")) != chat:
                    continue                                   # not you: ignore silently
                requests.post(f"{base}/sendMessage", timeout=15,
                              json={"chat_id": chat, "text": handle(m.get("text"))})
        except Exception as e:
            log.warning("telegram poll failed: %s", e)
            time.sleep(10)
