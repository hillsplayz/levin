"""Data cross-check, the 'top ten' errand from the second blueprint:  python selftest.py

Takes the 10 busiest Solana tokens (1h volume) from GeckoTerminal, then confirms each
address against DexScreener, and against FOMO when your Chrome is reachable. A token whose
address one source does not know is flagged. Run it after any change to data sources, and
open two of the printed links yourself and compare the address by eye."""
import requests
from collect import GT

NET, FOMO_ID = "solana", 1399811149


def top_by_hour_volume(n=10):
    r = requests.get(f"{GT}/networks/{NET}/trending_pools",
                     params={"duration": "1h", "include": "base_token"}, timeout=20).json()
    pools = []
    for p in r.get("data", []):
        gid = ((p.get("relationships") or {}).get("base_token") or {}).get("data", {}).get("id")
        vol = float(((p.get("attributes") or {}).get("volume_usd") or {}).get("h1") or 0)
        if gid:
            pools.append((vol, gid.split("_", 1)[1], (p["attributes"].get("name") or "?")))
    return sorted(pools, reverse=True)[:n]


def dexscreener_knows(addr):
    pairs = requests.get(f"https://api.dexscreener.com/latest/dex/tokens/{addr}",
                         timeout=20).json().get("pairs") or []
    return any((p.get("baseToken") or {}).get("address") == addr and p.get("chainId") == NET
               for p in pairs)


def fomo_knows(ids):
    try:
        from fomo_api import Fomo
        got = Fomo().tokens(ids)
        return {i: (i in got) for i in ids}
    except Exception as e:
        print(f"(FOMO check skipped: {type(e).__name__}: {str(e)[:80]})")
        return {}


if __name__ == "__main__":
    top = top_by_hour_volume()
    if not top:
        raise SystemExit("GeckoTerminal returned no pools.")
    fomo = fomo_knows([f"{a}:{FOMO_ID}" for _, a, _ in top])
    bad = 0
    print(f"{'1h volume':>12}  {'pool':24} {'DexScreener':12} {'FOMO':8} address")
    for vol, addr, name in top:
        dx = dexscreener_knows(addr)
        fm = fomo.get(f"{addr}:{FOMO_ID}")
        ok = dx and fm is not False
        bad += not ok
        print(f"{vol:>12,.0f}  {name[:24]:24} {'ok' if dx else 'MISSING':12} "
              f"{'n/a' if fm is None else ('ok' if fm else 'MISSING'):8} {addr}"
              f"{'' if ok else '   <-- CHECK'}")
    print(f"\n{len(top) - bad}/{len(top)} agreed across sources. Now open two links by hand:")
    for _, addr, name in top[:2]:
        print(f"  https://solscan.io/token/{addr}   ({name})")
