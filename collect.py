import logging, time, requests
from fomo_api import Fomo
from tokenlog import lead_id                      # Privy bearer out of Chrome over CDP

log = logging.getLogger("desk")
GT  = "https://api.geckoterminal.com/api/v2"
DEX = "https://api.dexscreener.com/latest/dex/tokens"

# the three chains the desk trades, plus Base which shares the BSC question set
GT_NET   = {1399811149: "solana", 4663: "robinhood", 56: "bsc", 8453: "base"}
FOMO_NET = {v: k for k, v in GT_NET.items()}


def age_minutes(created) -> float:
    """createdAt comes back as epoch seconds or milliseconds depending on the row."""
    if not created:
        return 0.0
    c = float(created)
    if c > 1e11:                                # milliseconds
        c /= 1000
    return max(0.0, (time.time() - c) / 60)


# Newest pools are mostly seconds-old junk that can never pass the guide's checks. Trending
# pools (by 1h activity) hold the tokens that already have liquidity and volume. Same number
# of GeckoTerminal calls as before: one new_pools page plus one trending page per chain.
UNIVERSE_SOURCES = (("new_pools", {}), ("trending_pools", {"duration": "1h"}))


def universe(nets=("solana", "bsc", "robinhood"), pages=1) -> list[str]:
    """Where the whole thing starts. Pools per chain -> ['<addr>:<netId>', ...].
       Costs one GeckoTerminal slot per source per chain per page, so keep pages small."""
    ids, seen = [], set()
    for net in nets:
        for path, extra in UNIVERSE_SOURCES:
            for page in range(1, pages + 1):
                try:
                    r = requests.get(f"{GT}/networks/{net}/{path}",
                                     params={"page": page, **extra}, timeout=20).json()
                except Exception:
                    break
                for pool in r.get("data", []):
                    base = ((pool.get("relationships") or {}).get("base_token") or {})
                    gid  = (base.get("data") or {}).get("id")      # 'solana_<addr>'
                    if not gid:
                        continue
                    addr = gid.split("_", 1)[1]
                    tid  = f"{addr}:{FOMO_NET[net]}"
                    if tid not in seen:
                        seen.add(tid)
                        ids.append(tid)
    return ids


def normalise(tid: str, m: dict) -> dict:
    """FOMO's field names become the desk's field names, once, here.
       Every file downstream reads these names and only these."""
    addr, net = tid.split(":")
    return {"addr": addr, "net": int(net), "tid": tid, "ticker": m["symbol"],
            "mcap_usd": m["mcap"], "liquidity_usd": m["liq"],
            "volume_h24": m["vol24"], "price_usd": m["price"],
            "holder_count": m["holders"] or None,
            "mintable": m.get("mintable"), "freezable": m.get("freezable"),
            "is_scam": m.get("is_scam"),
            "change": {"5m": m["change"].get(300), "1h": m["change"].get(3600),
                       "4h": m["change"].get(14400), "24h": m["change"].get(86400)},
            "age_minutes": age_minutes(m["created"])}


def shortlist(fomo: Fomo, ids: list[str]) -> list[dict]:
    """Pass one over everything FOMO knows. No network beyond FOMO itself:
       one call per twenty tokens, and not a single request per token."""
    out = []
    for tid, m in fomo.tokens(ids).items():             # 20 per call
        t = normalise(tid, m)
        if t["net"] in GT_NET:
            out.append(t)
    # turnover ranks the queue. It orders work, it does not decide anything
    out.sort(key=lambda t: t["volume_h24"] / max(t["mcap_usd"], 1), reverse=True)
    return out


def trade_counts(t: dict) -> dict:
    """buys and sells per window. FOMO does not return them, DexScreener does.
       Called ONLY for tokens that already cleared the free checks. One per token,
       so this runs on tens, never on the whole universe."""
    none = {"buys_h1": None, "sells_h1": None, "trades_h24": None}
    try:
        pairs = requests.get(f"{DEX}/{t['addr']}", timeout=20).json().get("pairs") or []
    except Exception:
        return none
    if not pairs:
        return none
    x = max(pairs, key=lambda p: (p.get("liquidity") or {}).get("usd") or 0)["txns"]
    return {"buys_h1": x["h1"]["buys"], "sells_h1": x["h1"]["sells"],
            "buys_h6": x["h6"]["buys"], "sells_h6": x["h6"]["sells"],
            "trades_h24": x["h24"]["buys"] + x["h24"]["sells"]}


def _gt_info(net: str, addr: str) -> dict:
    """GeckoTerminal's token info, or {} if it does not have the token (yet). A brand-new
    token often is not indexed. That must not crash the dossier: missing is missing."""
    try:
        r = requests.get(f"{GT}/networks/{net}/tokens/{addr}/info", timeout=20)
        return (r.json().get("data") or {}).get("attributes") or {} if r.status_code == 200 else {}
    except Exception as e:
        log.warning("GT info failed for %s: %s", addr, e)
        return {}


def _authority(a: dict, key: str, fomo_flag):
    """(value, known). GeckoTerminal first; if it does not carry the field, FOMO's own
    mintable/freezable flag; otherwise unknown. Unknown is not 'renounced'."""
    if key in a:
        return (a[key] or None), True
    if fomo_flag is True:
        return "set (per FOMO)", True
    if fomo_flag is False:
        return None, True
    return None, False


def dossier(t: dict) -> dict:
    """One GT call per token. Fills what the chain actually has, null where it does not."""
    net = GT_NET[t["net"]]
    a = _gt_info(net, t["addr"])

    mint, mint_known = _authority(a, "mint_authority", t.get("mintable"))
    frz, frz_known = _authority(a, "freeze_authority", t.get("freezable"))
    d = {**t, "chain": net, "lead_id": lead_id(t["tid"]), "gt_indexed": bool(a),
         # GT first, FOMO as the fallback. On Robinhood GT is null and FOMO is all you get.
         "holder_count": (a.get("holders") or {}).get("count") or t["holder_count"],
         "top_10_percent": ((a.get("holders") or {}).get("distribution_percentage")
                            or {}).get("top_10"),
         "developer_holding_percentage": a.get("developer_holding_percentage"),
         "gt_score_details": a.get("gt_score_details"),
         "is_honeypot": a.get("is_honeypot"),
         "mint_authority": mint, "freeze_authority": frz,
         "authority_known": mint_known and frz_known,
         "description": a.get("description"),
         "x_handle": clean_handle(a.get("twitter_handle"))}

    # Solana only: share held by the biggest real wallet, free, off the public RPC
    if t["net"] == 1399811149:
        try:
            d["top_wallet_percent"] = sol_top_wallet(t["addr"])
        except Exception as e:
            log.warning("Solana RPC failed for %s: %s", t["addr"], e)
            d["top_wallet_percent"] = None          # missing, and the question sees it

    return d


def clean_handle(h):
    """GT returned 'LuffyX100X/status/2102659581109272876' on a Robinhood token.
       Take the first path segment, or treat the account as missing."""
    if not h:
        return None
    h = h.strip().lstrip("@").split("?")[0].split("/")[0]
    return h if h and h.replace("_", "").isalnum() and len(h) <= 15 else None


SOL_RPC = "https://api.mainnet-beta.solana.com"
SYSTEM_PROGRAM = "11111111111111111111111111111111"


def _rpc(method: str, params: list):
    r = requests.post(SOL_RPC, json={"jsonrpc": "2.0", "id": 1, "method": method,
                                     "params": params}, timeout=20).json()
    if "error" in r:
        raise RuntimeError(f"{method}: {r['error'].get('message')}")
    return r["result"]


def sol_holders(mint: str, n: int = 8) -> list[dict]:
    """The n largest token accounts, each with its share of supply and whether its OWNER is
    a normal wallet. The biggest account is usually the pool's own vault or the pump.fun
    bonding curve, which hold a large part of the supply and are not people who can dump.
    A wallet is an account owned by the System Program; pool vaults are owned by PDAs."""
    supply = float(_rpc("getTokenSupply", [mint])["value"]["amount"])
    top = _rpc("getTokenLargestAccounts", [mint])["value"][:n]
    if not supply or not top:
        return []
    accts = _rpc("getMultipleAccounts", [[x["address"] for x in top],
                                         {"encoding": "jsonParsed"}])["value"]
    owners = [(((a or {}).get("data") or {}).get("parsed") or {}).get("info", {}).get("owner")
              for a in accts]
    real = [o for o in dict.fromkeys(owners) if o]
    info = {}
    if real:
        vals = _rpc("getMultipleAccounts", [real, {"encoding": "base64",
                                                   "dataSlice": {"offset": 0, "length": 0}}])["value"]
        info = dict(zip(real, vals))
    out = []
    for x, o in zip(top, owners):
        acc = info.get(o)
        out.append({"account": x["address"], "owner": o,
                    "pct": float(x["amount"]) / supply,
                    "is_wallet": bool(acc and acc.get("owner") == SYSTEM_PROGRAM)})
    return out


def sol_top_wallet(mint: str):
    """Share of supply held by the biggest REAL wallet (pool vaults and bonding curves are
    skipped). If none of the top accounts is a wallet, the 8th account's share is the most
    any single wallet could hold."""
    hs = sol_holders(mint)
    if not hs:
        return None
    return next((h["pct"] for h in hs if h["is_wallet"]), hs[-1]["pct"])


def social_state(d: dict) -> dict:
    """What SOCIAL hands the judge. The X block is filled by the bot's X plugin."""
    return {"x_account": d["x_account"],                 # collected by SOCIAL, not here
            "token": {"ticker": d["ticker"], "narrative": d.get("description"),
                      # recycled_account compares the account's timeline with the token's
                      "age_minutes": d.get("age_minutes"), "chain": d.get("chain")}}
