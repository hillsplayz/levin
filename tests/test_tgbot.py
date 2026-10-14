"""Offline test of the Telegram command answers. Run: python tests/test_tgbot.py"""
import os, sys, tempfile, time, json
d = tempfile.mkdtemp()
os.environ["DESK_DB"] = os.path.join(d, "t.db"); os.environ["DESK_BANK_USD"] = "5000"
os.chdir(d)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from unittest import mock
import book, paper, tgbot

O = {"model": "j", "confidence": 0.8, "size_factor": 1.0,
     "token": {"ticker": "AAA", "address": "a", "network_id": 1, "chain": "solana", "price_usd": 0.001}}
sn = lambda **k: {"price": k.get("price", 0.001), "liq": 100000, "vol_h6": k.get("h6", 50000), "vol_h24": 200000}


def test_commands():
    assert "No paper trades" in tgbot.handle("/pnl") and "No cycle" in tgbot.handle("/status")
    open("cycles.jsonl", "w").write(json.dumps({"ts": time.time() - 120, "stats": {}}) + "\n")
    with mock.patch.object(paper, "snapshot", return_value=sn()):
        paper.open_position(O, 5000)
    s = tgbot.handle("/status")
    assert "2 min ago" in s and "Open: AAA" in s, s
    with mock.patch.object(paper, "snapshot", return_value=sn(price=0.0012, h6=5000)):
        paper.risk_tick()
    p = tgbot.handle("/pnl@mybot")
    assert "Realised: +$42" in p and "1 closed" in p and "win rate 100%" in p, p
    assert "AAA" in tgbot.handle("/trades") and "VOLUME_DRAIN" in tgbot.handle("/trades")
    assert "/resume" in tgbot.handle("hello") and "/resume" in tgbot.handle("")


def test_ignores_other_chats():
    os.environ["TELEGRAM_TOKEN"] = "T"; os.environ["TELEGRAM_CHAT"] = "111"
    calls = {"n": 0, "sent": []}
    upd = {"result": [{"update_id": 1, "message": {"chat": {"id": 999}, "text": "/pnl"}},
                      {"update_id": 2, "message": {"chat": {"id": 111}, "text": "/help"}}]}

    def fake_get(*a, **k):
        calls["n"] += 1
        if calls["n"] > 1:
            raise KeyboardInterrupt
        m = mock.Mock(); m.json.return_value = upd; return m
    with mock.patch("requests.get", fake_get), \
         mock.patch("requests.post", lambda *a, **k: calls["sent"].append(k["json"])):
        try:
            tgbot.run_forever()
        except KeyboardInterrupt:
            pass
    assert len(calls["sent"]) == 1 and calls["sent"][0]["chat_id"] == "111"   # stranger ignored


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
