import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from filter import free_kill, trade_kill, chain_kill, soft_kill
from collect import clean_handle, age_minutes

OK = {"age_minutes": 60, "liquidity_usd": 50_000, "volume_h24": 100_000, "mcap_usd": 500_000}


def test_free_kill():
    assert free_kill(OK) is None
    assert free_kill({**OK, "age_minutes": 5}) == "age"
    assert free_kill({**OK, "liquidity_usd": 1}) == "liquidity"
    assert free_kill({**OK, "mcap_usd": 9e6}) == "mcap"


def test_trade_kill():
    assert trade_kill({"trades_h24": None}) == "no_pair"
    assert trade_kill({"trades_h24": 10, "sells_h1": 1, "buys_h1": 1}) == "trades"
    assert trade_kill({"trades_h24": 500, "sells_h1": 0, "buys_h1": 50}) == "no_sells"


def test_chain_kill():
    d = {"chain": "solana", "mint_authority": "x", "freeze_authority": None}
    assert chain_kill(d) == "authority_open"
    d = {"chain": "bsc", "is_honeypot": True}
    assert chain_kill(d) == "honeypot"
    assert chain_kill({"chain": "robinhood"}) is None


def test_soft_kill():
    assert soft_kill({"recycled_account": {"noul": 0.9}}) == "recycled_account"
    ans = {"shape": {"choice": "crowd", "probabilities": {"crowd": 0.9}}}
    assert soft_kill(ans) is None
    ans = {"shape": {"choice": "crowd", "probabilities": {"crowd": 0.3}}}
    assert soft_kill(ans) == "shape_weak"


def test_helpers():
    assert clean_handle("LuffyX100X/status/21026") == "LuffyX100X"
    assert clean_handle("not a handle!") is None
    assert age_minutes(0) == 0.0
