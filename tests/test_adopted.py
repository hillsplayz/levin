"""Offline tests for the exits, daily-loss halt, lead ids, trending universe, duplicate-ticker
pick, and reports. Run: python tests/test_adopted.py"""
import json, os, sys, tempfile, time
d = tempfile.mkdtemp()
os.environ["DESK_DB"] = os.path.join(d, "t.db"); os.environ["DESK_BANK_USD"] = "5000"
os.chdir(d)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from unittest import mock
import book, paper, tgbot, report, collect, pick, tokenlog

O = {"model": "j", "confidence": 0.8, "size_factor": 1.0,
     "token": {"ticker": "AAA", "address": "AddrAAAA1111", "network_id": 1399811149,
               "chain": "solana", "price_usd": 0.001, "lead_id": "abc12345"}}
sn = lambda **k: {"price": k.get("price", 0.001), "liq": k.get("liq", 100000),
                  "vol_h6": k.get("h6", 50000), "vol_h24": 200000}


def reset():
    for t in ("watch", "bench", "position", "paper_trades", "flags"):
        book.DB.execute(f"DELETE FROM {t}")
    book.DB.commit()
    for f in ("tokens.jsonl", "cycles.jsonl"):
        if os.path.exists(f):
            os.remove(f)


def open_pos(**k):
    with mock.patch.object(paper, "snapshot", return_value=sn(**k)):
        r = paper.open_position(O, paper.free_cash())
    assert r["status"] == "FILLED", r


def tick(**k):
    with mock.patch.object(paper, "snapshot", return_value=sn(**k)):
        return paper.risk_tick(sleep=lambda s: None)


def test_stop_loss():
    reset(); open_pos()
    assert tick(price=0.0009)["status"] == "HOLD"                    # -10%, fine
    r = tick(price=0.0006)                                           # -40%
    assert r["status"] == "CLOSED" and r["reason"].startswith("STOP_LOSS"), r
    assert book.held() is None


def test_liquidity_pull_is_a_rug_exit():
    reset(); open_pos()
    r = tick(price=0.0002, liq=10000, h6=90000)                     # volume UP, liquidity gone, price crashed
    assert r["reason"].startswith("LIQUIDITY_PULLED"), r             # the guide's volume rule alone would miss this
    assert r["pnl_usd"] < -100, r                                    # selling into a drained pool is costly


def test_trailing_stop_locks_in_a_run():
    reset(); open_pos()
    assert tick(price=0.0015)["status"] == "HOLD"                    # +50% arms the trail, peak stored
    assert tick(price=0.0013)["status"] == "HOLD"                    # 13% off peak, not yet
    r = tick(price=0.0010)                                           # 33% off peak
    assert r["reason"].startswith("TRAILING_STOP"), r
    assert r["pnl_usd"] > -15 and r["pnl_usd"] < 15, r               # about flat, not a -30% stop-out


def test_max_hold():
    reset(); open_pos()
    book.DB.execute("UPDATE paper_trades SET opened_at=?", (time.time() - 13 * 3600,)); book.DB.commit()
    assert tick()["reason"].startswith("MAX_HOLD")


def test_daily_loss_halts_until_resume():
    reset()
    for i in range(2):                                               # two rugs: ~ -$190 each, together past 5% of 5000
        open_pos(); r = tick(price=0.0002, liq=10000)
        assert r["status"] == "CLOSED", r
    assert r.get("halted") and paper.halted(), r
    with mock.patch.object(paper, "snapshot", return_value=sn()):
        assert paper.open_position(O, 5000)["status"] == "HALTED"
    assert "HALTED" in tgbot.status()
    assert "cleared" in tgbot.resume() and not paper.halted()
    assert "not halted" in tgbot.resume()


def test_lead_id_and_universe_sources():
    assert tokenlog.lead_id("AbC:1") == tokenlog.lead_id("abc:1") and len(tokenlog.lead_id("x:1")) == 8
    seen = []

    def fake_get(url, params=None, timeout=None):
        seen.append((url.rsplit("/", 1)[1], (params or {}).get("duration")))
        pool = lambda a: {"relationships": {"base_token": {"data": {"id": f"solana_{a}"}}}}
        m = mock.Mock(); m.json.return_value = {"data": [pool("same"), pool("new" if "new" in url else "trend")]}
        return m
    with mock.patch("requests.get", fake_get):
        ids = collect.universe(nets=("solana",))
    assert ("new_pools", None) in seen and ("trending_pools", "1h") in seen and len(seen) == 2
    assert sorted(i.split(":")[0] for i in ids) == ["new", "same", "trend"]          # deduplicated


def test_pick_survives_duplicate_tickers():
    mk = lambda addr: ({"ticker": "DOGE", "addr": addr, "net": 1399811149, "chain": "solana", "age_minutes": 60,
                        "mcap_usd": 1e5, "liquidity_usd": 5e4, "holder_count": 200, "price_usd": 1.0,
                        "lead_id": addr[:8]},
                       {"shape": {"probabilities": {"crowd": .9}}, "concentration_is_exit_risk": {"noul": .1}})
    a, b = mk("AAAAxxxxxxxxxxxxxxxxxx1111"), mk("BBBBxxxxxxxxxxxxxxxxxx2222")
    seen = {}

    def judge(qs, state):
        seen["labels"] = [c["ticker"] for c in state["candidates"]]
        choice = seen["labels"][1]                                   # the SECOND token
        return {"model": "jev-1", "answers": {"best": {"choice": choice, "confidence": .9,
                                                         "probabilities": {choice: .9, seen["labels"][0]: .1}},
                                              "worth_trading_at_all": {"noul": .9}}}
    o = pick.pick(judge, [a, b])
    assert len(set(seen["labels"])) == 2, seen                      # two distinct options despite one ticker
    assert o["token"]["address"] == b[0]["addr"] and o["token"]["lead_id"] == b[0]["lead_id"], o


def test_report_and_links():
    reset()
    now = time.time()
    rows = [{"ts": now, "tid": f"t{i}:1", "kill": k} for i, k in enumerate(["liquidity"] * 5 + ["volume"] * 2 + ["survivor"])]
    open("tokens.jsonl", "w").write("\n".join(json.dumps(r) for r in rows) + "\n")
    open("cycles.jsonl", "w").write(json.dumps({"ts": now, "stats": {"seen": 40}, "order": {"token": {}}}) + "\n")
    open_pos(); tick(price=0.0006)                                   # a stop-out
    s = report.summary(1)
    assert "8 unique tokens" in s and "Cleared every filter: 1" in s and "Picked: 1" in s, s
    assert "'liquidity' rejected 5" in s and "Days without a rug-type exit" in s, s
    assert "STOP" not in s and "win rate 0%" in s, s
    assert "solscan.io/token/AddrAAAA1111" in report.links("solana", "AddrAAAA1111")
    w = report.summary(7)
    assert "verify these addresses BY HAND" in w and "#abc12345" in w, w


def test_reports_send_once_per_day():
    reset()
    desk = mock.Mock()
    evening = time.mktime((2026, 10, 14, 21, 30, 0, 0, 0, -1))
    report.tick(desk, evening); report.tick(desk, evening + 600)
    assert sum(1 for c in desk.notify.call_args_list if "Evening report" in c[0][0]) == 1
    morning = time.mktime((2026, 10, 15, 8, 30, 0, 0, 0, -1))
    report.tick(desk, morning); report.tick(desk, morning + 60)
    assert sum(1 for c in desk.notify.call_args_list if "Morning status" in c[0][0]) == 1


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
