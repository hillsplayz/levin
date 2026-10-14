"""Scheduled reports to Telegram: morning status, evening report, Sunday weekly review.

Adopted from the second blueprint (HEAD OF DESK): scanned -> cleared -> picked -> executed
-> closed, pnl, win rate, best and worst ticker, one thing that worked and one to look at,
and days without a rug. Times are local: REPORT_MORNING_HOUR (8) and REPORT_EVENING_HOUR (21).
Each report is sent at most once a day, even across restarts (a flag remembers it)."""
import collections, json, os, sqlite3, time

DB = os.environ.get("DESK_DB", "desk.db")
EXPLORERS = {"solana": "https://solscan.io/token/", "bsc": "https://bscscan.com/token/",
             "base": "https://basescan.org/token/"}


def _q(sql, args=()):
    try:
        c = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        try:
            return c.execute(sql, args).fetchall()
        finally:
            c.close()
    except Exception:
        return []


def _lines(path, since):
    try:
        with open(path) as f:
            rows = [json.loads(x) for x in f if x.strip()]
    except FileNotFoundError:
        return []
    return [r for r in rows if r.get("ts", 0) >= since]


def links(chain: str, addr: str) -> str:
    """So you can check an address by hand, character by character, before trusting it."""
    out = f"DexScreener: https://dexscreener.com/{chain}/{addr}"
    if chain in EXPLORERS:
        out += f"\nExplorer: {EXPLORERS[chain]}{addr}"
    return out


def _midnight(now):
    lt = time.localtime(now)
    return time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, -1))


def days_without_rug(now=None):
    now = now or time.time()
    r = _q("SELECT MAX(closed_at) FROM paper_trades WHERE closed_at IS NOT NULL AND "
           "(reason LIKE 'LIQUIDITY_PULLED%' OR pnl_pct <= -50)")
    if not r or r[0][0] is None:
        first = _q("SELECT MIN(opened_at) FROM paper_trades")
        if not first or first[0][0] is None:
            return "no trades yet"
        return f"{int((now - first[0][0]) // 86400)} (none since the first trade)"
    return str(int((now - r[0][0]) // 86400))


def summary(days: int = 1, now=None) -> str:
    now = now or time.time()
    since = _midnight(now) - (days - 1) * 86400
    toks = _lines("tokens.jsonl", since)
    cyc = _lines("cycles.jsonl", since)
    uniq = {r["tid"] for r in toks if "tid" in r}
    cleared = {r["tid"] for r in toks if r.get("kill") == "survivor"}
    sightings = sum((c.get("stats") or {}).get("seen", 0) for c in cyc)
    picks = [c for c in cyc if c.get("order")]
    opened = _q("SELECT ticker FROM paper_trades WHERE opened_at >= ?", (since,))
    closed = _q("SELECT ticker, pnl_usd, pnl_pct, reason FROM paper_trades WHERE closed_at >= ?",
                (since,))
    pnl = sum(r[1] for r in closed)
    wins = sum(1 for r in closed if r[1] > 0)
    kills = collections.Counter(r["kill"] for r in toks if r.get("kill") not in ("survivor",))
    start = float(os.environ.get("DESK_BANK_USD", "0"))
    total = (_q("SELECT SUM(pnl_usd) FROM paper_trades WHERE closed_at IS NOT NULL")[0][0] or 0)
    open_rows = _q("SELECT ticker, qty, mark_price, ticket_usd FROM paper_trades "
                   "WHERE closed_at IS NULL")

    name = "Evening report" if days == 1 else f"Weekly review ({days} days)"
    out = [f"{name} {time.strftime('%Y-%m-%d', time.localtime(now))}",
           f"Scanned: {len(uniq)} unique tokens judged ({sightings} sightings, {len(cyc)} cycles)",
           f"Cleared every filter: {len(cleared)} | Picked: {len(picks)} | "
           f"Executed (paper): {len(opened)} | Closed: {len(closed)}"]
    if open_rows:
        out.append("Open: " + ", ".join(
            f"{t} {'%+.2f' % (q * m - tk)}$" if m else f"{t}" for t, q, m, tk in open_rows))
    else:
        out.append("Open positions: none")
    if closed:
        best, worst = max(closed, key=lambda r: r[1]), min(closed, key=lambda r: r[1])
        out.append(f"PnL: {pnl:+.2f}$ | win rate {round(wins / len(closed) * 100)}% | "
                   f"best {best[0]} {best[1]:+.2f}$ | worst {worst[0]} {worst[1]:+.2f}$")
    else:
        out.append("PnL: no closed trades in this window")
    if start:
        out.append(f"Paper equity: ${start + total:,.2f} (start ${start:,.2f})")
    if kills:
        (stage, n), = kills.most_common(1)
        out.append(f"Worked: {len(cleared)} tokens cleared every check."
                   if cleared else "Worked: nothing cleared every check today.")
        out.append(f"Look at: '{stage}' rejected {n} tokens, the biggest killer. "
                   "Run whatif.py before loosening it.")
    out.append(f"Days without a rug-type exit: {days_without_rug(now)}")
    h = _q("SELECT value FROM flags WHERE name='halt'")     # read-only: safe from any thread
    if h:
        out.append(f"HALTED: {h[0][0]}. Send /resume to restart entries.")
    if os.environ.get("X_BEARER_TOKEN") is None:
        out.append("Note: X reader is OFF, social checks are not running.")
    if days > 1:
        last = _q("SELECT ticker, chain, addr, lead_id FROM paper_trades ORDER BY id DESC LIMIT 2")
        if last:
            out.append("\nYour weekly check: verify these addresses BY HAND, character by "
                       "character. No bot can catch a digit that is off.")
            out += [f"#{lid} {t} ({ch})\n{links(ch, a)}" for t, ch, a, lid in last]
    return "\n".join(out)


def tick(desk, now=None):
    """Called every loop. Sends each scheduled report once per local day."""
    import book                                  # main thread only
    now = now or time.time()
    lt = time.localtime(now)
    date = time.strftime("%Y-%m-%d", lt)
    morning = int(os.environ.get("REPORT_MORNING_HOUR", "8"))
    evening = int(os.environ.get("REPORT_EVENING_HOUR", "21"))
    if morning <= lt.tm_hour < evening - 1 and book.get_flag("last_morning") != date:
        book.set_flag("last_morning", date)
        import tgbot
        desk.notify("Morning status\n" + tgbot.status())
    if lt.tm_hour >= evening and book.get_flag("last_evening") != date:
        book.set_flag("last_evening", date)
        desk.notify(summary(1, now))
        if lt.tm_wday == 6:                                   # Sunday
            desk.notify(summary(7, now))
