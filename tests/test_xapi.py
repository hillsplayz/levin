"""Offline test of the X reader with a fake API. Run: python tests/test_xapi.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from unittest import mock
import xapi, collect

NOW = time.time()
iso = lambda ago: time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(NOW - ago))
USER = {"data": {"id": "42", "username": "CoolToken", "created_at": iso(400 * 86400),
        "description": "official", "url": "https://t.co/x",
        "public_metrics": {"followers_count": 5000, "following_count": 10, "tweet_count": 300},
        "entities": {"url": {"urls": [{"expanded_url": "https://cool.example"}]}}}}
TWEETS = {"data": [{"text": "gm", "created_at": iso(3600), "public_metrics": {"reply_count": 4, "retweet_count": 2}},
                   {"text": "old", "created_at": iso(20 * 86400), "public_metrics": {"reply_count": 0, "retweet_count": 0}}]}


def fake(url, params=None, headers=None, timeout=None):
    r = mock.Mock(); r.status_code = 200
    r.json.return_value = USER if "/by/username/" in url else TWEETS
    return r


def test_read_x():
    os.environ["X_BEARER_TOKEN"] = "t"
    xapi._cache.clear()
    with mock.patch("requests.get", side_effect=fake) as g:
        a = xapi.read_x("CoolToken", now=NOW)
        b = xapi.read_x("cooltoken", now=NOW)                # served from cache, no new calls
    assert g.call_count == 2 and a is b
    assert a["followers"] == 5000 and a["posts_last_7d"] == 1 and len(a["recent"]) == 2
    assert a["recent"][0]["replies"] == 4 and a["linked_site"] == "https://cool.example"
    assert a["handle_history"] is None


def test_missing_is_none():
    os.environ["X_BEARER_TOKEN"] = "t"; xapi._cache.clear()
    bad = mock.Mock(status_code=404, text="nope")
    with mock.patch("requests.get", return_value=bad):
        assert xapi.read_x("ghost") is None
    os.environ.pop("X_BEARER_TOKEN"); xapi._cache.clear()
    assert xapi.read_x("anyone") is None                      # no token, no call


def test_social_state_has_token_age():
    d = {"x_account": {"handle": "a"}, "ticker": "T", "description": "n", "age_minutes": 90, "chain": "solana"}
    assert collect.social_state(d)["token"]["age_minutes"] == 90


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
