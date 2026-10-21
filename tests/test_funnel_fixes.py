"""Offline tests: robust dossier, real-wallet holder share, near-miss watch, scam flag.
Run: python tests/test_funnel_fixes.py"""
import os, sys, tempfile
d = tempfile.mkdtemp()
os.environ["DESK_DB"] = os.path.join(d, "t.db"); os.environ["DESK_TOKENS"] = os.path.join(d, "tok.jsonl")
os.chdir(d)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from unittest import mock
import book, collect, filter as F, fomo_api, main as M
from thresholds import HARD

SOL = 1399811149
T = {"addr": "Mint1", "net": SOL, "tid": f"Mint1:{SOL}", "ticker": "KIM", "mcap_usd": 80_000,
     "liquidity_usd": 20_000, "volume_h24": 50_000, "price_usd": 0.01, "holder_count": 120,
     "change": {}, "age_minutes": 60, "mintable": False, "freezable": False, "is_scam": False}


def test_defaults_are_the_explore_profile():
    assert HARD["min_liquidity_usd"] == 5_000 and HARD["min_age_minutes"] == 10


def test_dossier_survives_unindexed_token_and_rpc_failure():
    r404 = mock.Mock(status_code=404); r404.json.side_effect = ValueError("not json")
    with mock.patch("requests.get", return_value=r404), \
         mock.patch.object(collect, "sol_top_wallet", side_effect=RuntimeError("429 rate limited")):
        out = collect.dossier(T)                                    # used to raise and bench the token
    assert out["gt_indexed"] is False and out["top_wallet_percent"] is None
    assert out["authority_known"] is True and out["mint_authority"] is None   # FOMO says not mintable/freezable
    assert F.chain_kill(out) is None                                # nothing known to be wrong


def test_unknown_authority_is_not_renounced():
    r404 = mock.Mock(status_code=404)
    t = {**T, "mintable": None, "freezable": None}
    with mock.patch("requests.get", return_value=r404), mock.patch.object(collect, "sol_top_wallet", return_value=None):
        out = collect.dossier(t)
    assert out["authority_known"] is False and F.chain_kill(out) == "authority_unknown"
    t = {**T, "mintable": True}
    with mock.patch("requests.get", return_value=r404), mock.patch.object(collect, "sol_top_wallet", return_value=None):
        assert F.chain_kill(collect.dossier(t)) == "authority_open"


def test_scam_flag_kills():
    out = {"chain": "solana", "mint_authority": None, "freeze_authority": None, "is_scam": True}
    assert F.chain_kill(out) == "scam_flag"


def test_top_wallet_skips_pool_vaults():
    supply = 1_000_000_000
    amounts = {"vault": 600_000_000, "whale": 50_000_000, "small": 30_000_000}
    owner_of = {"vault": "PoolPDA", "whale": "WalletW", "small": "WalletS"}

    def rpc(method, params):
        if method == "getTokenSupply":
            return {"value": {"amount": str(supply)}}
        if method == "getTokenLargestAccounts":
            return {"value": [{"address": k, "amount": str(v)} for k, v in amounts.items()]}
        if method == "getMultipleAccounts" and params[1]["encoding"] == "jsonParsed":
            return {"value": [{"data": {"parsed": {"info": {"owner": owner_of[a]}}}} for a in params[0]]}
        if method == "getMultipleAccounts":                          # the owner accounts
            sysacc = {"owner": collect.SYSTEM_PROGRAM}
            return {"value": [None if o == "PoolPDA" else sysacc for o in params[0]]}
    with mock.patch.object(collect, "_rpc", side_effect=rpc):
        hs = collect.sol_holders("m")
        top = collect.sol_top_wallet("m")
    assert hs[0]["pct"] == 0.6 and hs[0]["is_wallet"] is False
    assert abs(top - 0.05) < 1e-9, top          # the guide's way would say 60% and kill every token


def test_near_miss_is_watched_not_benched():
    young = {**T, "liquidity_usd": 3_000, "age_minutes": 30}
    assert M.near_miss(young, "liquidity")                          # 3k is 60% of 5k
    assert not M.near_miss({**young, "liquidity_usd": 1_000}, "liquidity")   # too far off
    assert not M.near_miss({**young, "age_minutes": 600}, "liquidity")       # too old
    tok = {**young, "volume_h24": 90_000}
    with mock.patch.object(M, "universe", return_value=[tok["tid"]]), \
         mock.patch.object(M, "shortlist", return_value=[tok]):
        _, st = M.run_once(mock.Mock(), mock.Mock(), mock.Mock(), 1000, True)
    assert st["free"] == {"liquidity": 1}
    assert book.DB.execute("SELECT COUNT(*) FROM watch").fetchone()[0] == 1 and not book.benched(tok["tid"])


def test_fomo_row_carries_contract_flags():
    row = fomo_api._row({"token": {"symbol": "K", "mintable": 0, "freezable": 1, "isScam": False}})
    assert row["mintable"] is False and row["freezable"] is True and row["is_scam"] is False
    assert fomo_api._row({"token": {"symbol": "K"}})["mintable"] is None


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
