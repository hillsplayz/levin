"""Offline tests for the maturing-token watch list and the paper executor.
Run:  python tests/test_paper.py   (uses a throwaway database, no network)"""
import os, sys, tempfile, time
os.environ["DESK_DB"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["DESK_BANK_USD"] = "5000"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from unittest import mock
import book, paper, main as M
from thresholds import HARD

ORDER = {"model": "jev-1.13.0", "confidence": 0.8, "size_factor": 1.0,
         "token": {"ticker": "AAA", "address": "addr1", "network_id": 1399811149,
                   "chain": "solana", "price_usd": 0.001}}


def reset():
    for t in ("watch", "bench", "position", "paper_trades"):
        book.DB.execute(f"DELETE FROM {t}")
    book.DB.commit()


def snap(price=0.001, liq=100_000, h6=50_000, h24=200_000):
    return {"price": price, "liq": liq, "vol_h6": h6, "vol_h24": h24}


def test_watch_flow():
    reset()
    book.watch("x:1", 10)
    assert book.due() == []                                  # not ready yet
    book.watch("x:1", 10)                                    # re-sighting does not count
    assert book.DB.execute("SELECT tries FROM watch WHERE tid='x:1'").fetchone()[0] == 1
    book.DB.execute("UPDATE watch SET ready_at=?", (time.time() - 1,)); book.DB.commit()
    assert book.due() == ["x:1"]
    for _ in range(HARD and 5):                              # exhaust the tries
        book.DB.execute("UPDATE watch SET ready_at=?", (time.time() - 1,)); book.DB.commit()
        book.watch("x:1", 10)
    assert book.benched("x:1") and book.due() == []          # gave up, benched for age


def test_run_once_rechecks_young_tokens():
    reset()
    def tok(age):
        return {"addr": "m", "net": 1399811149, "tid": "m:1399811149", "ticker": "M",
                "mcap_usd": 100_000, "liquidity_usd": 50_000, "volume_h24": 90_000,
                "price_usd": 0.1, "holder_count": 100, "change": {}, "age_minutes": age}
    desk = mock.Mock()
    with mock.patch.object(M, "universe", return_value=["m:1399811149"]), \
         mock.patch.object(M, "shortlist", return_value=[tok(3)]), \
         mock.patch.object(M, "trade_counts", return_value={"trades_h24": 0, "sells_h1": 1,
                                                            "buys_h1": 1}):
        _, st = M.run_once(mock.Mock(), mock.Mock(), desk, 1000, True)
    assert st["free"] == {"age_young": 1}, st
    assert book.DB.execute("SELECT COUNT(*) FROM watch WHERE tid='m:1399811149'").fetchone()[0] == 1
    assert not book.benched("m:1399811149")                  # watched, not benched
    book.DB.execute("UPDATE watch SET ready_at=?", (time.time() - 1,)); book.DB.commit()
    with mock.patch.object(M, "universe", return_value=[]), \
         mock.patch.object(M, "shortlist", return_value=[tok(20)]) as sl, \
         mock.patch.object(M, "trade_counts", return_value={"trades_h24": 0, "sells_h1": 1,
                                                            "buys_h1": 1}):
        _, st = M.run_once(mock.Mock(), mock.Mock(), desk, 1000, True)
    assert "m:1399811149" in sl.call_args[0][1]              # it was added to the FOMO batch
    assert st["rechecked"] == 1 and st["trade"] == {"trades": 1}, st   # now past the age check


def test_size_and_fill():
    reset()
    with mock.patch.object(paper, "snapshot", return_value=snap()):
        r = paper.open_position(ORDER, paper.free_cash())
    # bank 5000 * 6% * conf .8 = 240, liquidity cap 2% of 100k = 2000, fee = max(1.08,.95)
    assert r["status"] == "FILLED" and r["ticket"] == 240.0 and r["fee"] == 1.08, r
    assert abs(r["slippage_bps"] - 48.0) < 0.1 and r["flags"] == []
    assert book.held()["ticker"] == "AAA"
    assert abs(paper.free_cash() - 4760.0) < 0.01            # locked bag is not free cash


def test_risk_hold_then_close():
    reset()
    with mock.patch.object(paper, "snapshot", return_value=snap()):
        paper.open_position(ORDER, paper.free_cash())
    with mock.patch.object(paper, "snapshot", return_value=snap(h6=50_000, h24=200_000)):
        r = paper.risk_tick()                                # ratio 1.0, keep holding
    assert r["status"] == "HOLD" and book.held()
    with mock.patch.object(paper, "snapshot", return_value=snap(price=0.0012, h6=5_000, h24=200_000)):
        r = paper.risk_tick()                                # ratio 0.1 < 0.2, close
    assert r["status"] == "CLOSED" and "VOLUME_DRAIN" in r["reason"], r
    assert book.held() is None                               # RISK released the book
    row = book.DB.execute("SELECT pnl_usd, pnl_pct FROM paper_trades").fetchone()
    # bought ~238.9 of tokens at 0.001*(1.0048), sold at +20% less 2*value/liq impact and fee
    assert 10 < row[0] < 60, row
    assert abs(paper.free_cash() - (5000 + row[0])) < 0.01


def test_no_data_closes_after_retries():
    reset()
    with mock.patch.object(paper, "snapshot", return_value=snap()):
        paper.open_position(ORDER, paper.free_cash())
    calls = []
    with mock.patch.object(paper, "snapshot", side_effect=lambda *a: calls.append(1)):
        r = paper.risk_tick(sleep=lambda s: None)
    assert r["reason"] == "NO_DATA" and len(calls) == 3 and book.held() is None


def test_fee_floor_and_zero():
    reset()
    small = dict(ORDER, confidence=0.5)
    with mock.patch.object(paper, "snapshot", return_value=snap()):
        r = paper.open_position(small, 500)                  # 500*6%*.5 = 15 -> fee 6.3%
    assert r["status"] == "FEE_FLOOR" and r["min_viable_ticket"] == 47.5, r
    assert book.held() is None                               # nothing was taken
    with mock.patch.object(paper, "snapshot", return_value=None):
        assert paper.open_position(ORDER, 5000)["status"] == "NO_QUOTE"
    with mock.patch.object(paper, "snapshot", return_value=snap()):
        assert paper.open_position(ORDER, 0)["status"] == "SIZE_ZERO"


def test_slippage_flag():
    reset()
    with mock.patch.object(paper, "snapshot", return_value=snap(liq=12_000)):
        r = paper.open_position(ORDER, 5000)                 # ticket capped at 2% = 240
    assert r["status"] == "FILLED" and r["flags"] == ["SLIPPAGE"], r   # 400 bps > 300
    with mock.patch.object(paper, "snapshot", return_value=snap(liq=12_000)):
        paper.risk_tick(sleep=lambda s: None)


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
