import time, logging
from fomo_api import Fomo
from collect import universe, shortlist, trade_counts, dossier, social_state
from filter import free_kill, trade_kill, chain_kill, soft_kill
from thresholds import (HARD, RISK_POLL_SECONDS, NEAR_MISS_FRACTION, NEAR_MISS_MAX_AGE_H,
                        NEAR_MISS_RECHECK_MIN)
from pick import pick
import book, tokenlog

CHAIN_SET     = {1399811149: "solana", 56: "bsc", 8453: "bsc", 4663: "robinhood"}
CYCLE_SECONDS = 900
GT_PER_MINUTE = 10          # free tier
GT_UNIVERSE   = 6           # 3 chains x 2 pages, spent before the funnel starts
GT_DOSSIER    = 3           # what is left for dossiers in the same minute
DEX_BUDGET    = 25          # DexScreener calls per cycle, pass two only
log = logging.getLogger("desk")


def near_miss(t, kill) -> bool:
    """Missed liquidity, volume or mcap by a modest margin, and still young."""
    if t["age_minutes"] > NEAR_MISS_MAX_AGE_H * 60:
        return False
    have, need = {"liquidity": (t["liquidity_usd"], HARD["min_liquidity_usd"]),
                  "volume": (t["volume_h24"], HARD["min_volume_h24"]),
                  "mcap": (t["mcap_usd"], HARD["min_mcap_usd"])}.get(kill, (0, 1))
    return t["mcap_usd"] <= HARD["max_mcap_usd"] and NEAR_MISS_FRACTION * need <= have < need


def run_once(fomo, judge, desk, bank, shadow=True):
    if (why := book.get_flag("halt")):           # daily loss limit hit: only a human resumes
        log.info("HALTED (%s), no scan this cycle", why)
        return None, {"halted": why}
    if (h := book.held()):                       # RISK owns the desk right now
        log.info("holding %s for %.0f min, no scan this cycle",
                 h["ticker"], h["minutes"])
        return None, {"held": h["ticker"], "minutes": round(h["minutes"])}

    stats = {"seen": 0, "benched": 0, "free": {}, "trade": {},
             "chain": {}, "soft": {}}
    survivors = []
    gt_slots, dex_slots = GT_DOSSIER, DEX_BUDGET

    ids = universe()                             # fresh pools, 3 chains, GT_UNIVERSE slots
    due = book.due()                             # young tokens whose time has come
    ids += [i for i in due if i not in ids]      # same FOMO batch, no extra requests
    listed = shortlist(fomo, ids)
    got = {t["tid"] for t in listed}
    for tid in due:
        if tid not in got:
            book.unwatch(tid)                    # FOMO does not know it, stop asking
    stats["rechecked"] = len(got & set(due))
    for t in listed:                             # pass one: free, no per-token requests
        stats["seen"] += 1
        if book.benched(t["tid"]):               # already judged, still serving its time
            stats["benched"] += 1
            continue
        if (k := free_kill(t)):
            if k == "age" and t["age_minutes"] < HARD["min_age_minutes"]:
                k = "age_young"                  # not bad, just early: look again later
                book.watch(t["tid"], HARD["min_age_minutes"] - t["age_minutes"] + 1)
            elif near_miss(t, k):
                book.watch(t["tid"], NEAR_MISS_RECHECK_MIN, reason=k)   # may be climbing
            else:
                book.unwatch(t["tid"])
                book.sit(t["tid"], k)
            stats["free"][k] = stats["free"].get(k, 0) + 1
            tokenlog.log(t, k)
            continue
        book.unwatch(t["tid"])

        if dex_slots <= 0 or gt_slots <= 0:
            break                                # out of budget, not out of ideas

        t |= trade_counts(t)                     # pass two: one DexScreener call
        dex_slots -= 1
        if (k := trade_kill(t)):
            book.sit(t["tid"], k)
            stats["trade"][k] = stats["trade"].get(k, 0) + 1
            tokenlog.log(t, k)
            continue

        try:
            d = dossier(t)                       # pass three: one GeckoTerminal slot
            gt_slots -= 1
        except Exception as e:
            log.warning("dossier failed %s: %s", t["ticker"], e)
            gt_slots -= 1                        # a failed call still cost you the slot
            book.sit(t["tid"], "dossier_failed")
            stats["chain"]["dossier_failed"] = stats["chain"].get("dossier_failed", 0) + 1
            tokenlog.log(t, "dossier_failed")
            continue                             # missing is missing, not a pass

        if (k := chain_kill(d)):
            book.sit(t["tid"], k)                # facts bench longest
            stats["chain"][k] = stats["chain"].get(k, 0) + 1
            tokenlog.log(d, k)
            continue

        d["intended_ticket_usd"] = bank * 0.06   # the most SIZE could ever allow
        d["x_account"] = desk.read_x(d["x_handle"]) if d["x_handle"] else None

        ans = {}
        try:
            ans |= judge("market", d)["answers"]                  # pass four
            ans |= judge(CHAIN_SET[d["net"]], d)["answers"]
            if d["x_account"]:
                ans |= judge("social", social_state(d))["answers"]
        except Exception as e:
            log.warning("judge failed %s: %s", d["ticker"], e)
            continue                             # no bench: the token is not at fault

        if (k := soft_kill(ans)):
            book.sit(t["tid"], k)
            stats["soft"][k] = stats["soft"].get(k, 0) + 1
            tokenlog.log(d, k)
            continue

        tokenlog.log(d, "survivor")
        survivors.append((d, ans))

    log.info("cycle: %(seen)s seen, %(benched)s benched, free %(free)s, "
             "trade %(trade)s, chain %(chain)s, soft %(soft)s", stats)

    if not survivors:
        return None, stats
    if len(survivors) == 1:                      # a choice over one option proves nothing
        d, ans = survivors[0]
        order = {"model": "single-survivor", "size_factor": 1.0, "confidence": None,
                 "token": {"ticker": d["ticker"], "address": d["addr"],
                           "network_id": d["net"], "chain": d["chain"],
                           "price_usd": d.get("price_usd"), "lead_id": d.get("lead_id")},
                 "why": ans}
    else:
        order = pick(judge, survivors)           # pass five

    if order is None:
        return None, stats
    if shadow:
        desk.log_shadow(order, stats)            # written, never sent
        return None, stats

    return order, stats       # the executor takes the book once SIZE and FILLS say yes


def main(fomo, judge, desk, shadow=True, risk=None):
    """desk is your Grok Bot side. It has to provide five things:
         bank()                 -> float, free cash right now
         read_x(handle)         -> the X block SOCIAL collects with its plugin, or None
         log_shadow(order, st)  -> append a row for the shadow week
         report(order, stats)   -> one line to Telegram, trade or no trade
         send_to_seats(order)   -> hand it to SIZE, then FILLS, then RISK, in that order
       risk is optional: a function called every RISK_POLL_SECONDS while a position is open.
    """
    next_cycle, empty = 0.0, 0
    while True:
        now = time.time()
        if now >= next_cycle:
            next_cycle = now + CYCLE_SECONDS
            try:
                fomo.token()                     # Privy bearer lives ~60 min, refresh it
                order, stats = run_once(fomo, judge, desk, desk.bank(), shadow)
                desk.report(order, stats)        # every cycle, trade or not
                if order:
                    desk.send_to_seats(order)
                # silent-failure watchdog: a scan that finds nothing, repeatedly, is a fault
                if "seen" in stats:
                    empty = empty + 1 if stats["seen"] == 0 else 0
                    if empty == 3:
                        desk.notify("WARNING: 3 scans in a row saw 0 tokens. GeckoTerminal "
                                    "or FOMO may be down, or the FOMO login expired.")
                    elif empty == 0 and stats["seen"] and getattr(desk, "_was_empty", False):
                        desk.notify("Scans are seeing tokens again.")
                    desk._was_empty = empty >= 3
            except Exception as e:
                log.exception("cycle blew up: %s", e)
                desk.notify(f"Desk cycle error: {type(e).__name__}: {str(e)[:200]}")
        if risk:
            try:
                res = risk()
                if res:
                    log.info("risk: %s", res)
                    if res.get("status") == "CLOSED":
                        desk.notify(f"CLOSED {res['ticker']}: {res['reason']}, "
                                    f"paper PnL ${res['pnl_usd']}")
                        if res.get("halted"):
                            desk.notify(f"HALTED: {res['halted']}. No new entries until you "
                                        "send /resume.")
            except Exception as e:
                log.exception("risk tick blew up: %s", e)
        try:
            import report
            report.tick(desk)                    # morning status, evening and weekly reports
        except Exception as e:
            log.exception("report failed: %s", e)
        time.sleep(max(1, min(RISK_POLL_SECONDS, next_cycle - time.time())))
