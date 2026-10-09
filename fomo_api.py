"""FOMO client. FOMO has no public API, so this rides your own logged-in session.

Bearer source, in order:
  1. FOMO_BEARER env var (manual override / testing)
  2. the Privy token in Chrome's localStorage, read over CDP
     (start Chrome with --remote-debugging-port=9222, logged into fomo.family)

The response shape of filterTokens is mapped defensively in `_row`; if FOMO renames a
field, this is the only place to fix.
"""
import json, os, time, requests

BASE = "https://prod-api.fomo.family/proxy/filterTokens"
CDP = os.environ.get("CHROME_CDP", "http://localhost:9222")
TTL = 50 * 60            # bearer lives ~60 min, refresh a little early
BATCH = 20
# FOMO rejects requests that do not look like they come from its own site
BROWSER = {"Origin": "https://fomo.family", "Referer": "https://fomo.family/",
           "Content-Type": "application/json",
           "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                         "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"}


def _cdp(ws, msg_id, method, params=None):
    """Send one CDP command and wait for its reply (events in between are skipped)."""
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == msg_id:
            return m


def _bearer_from_chrome(reload: bool = False) -> str:
    """Read the Privy token out of the fomo.family tab. reload=True reloads the tab
    first, which makes the site mint a fresh token (an idle tab lets it expire)."""
    import websocket                                    # websocket-client
    tabs = requests.get(f"{CDP}/json", timeout=10).json()
    tab = next(t for t in tabs if "fomo.family" in t.get("url", ""))
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=15)
    try:
        if reload:
            _cdp(ws, 1, "Page.reload")
            time.sleep(8)
        m = _cdp(ws, 2, "Runtime.evaluate", {
            "expression": "localStorage.getItem('privy:token')", "returnByValue": True})
        val = m["result"]["result"].get("value")
    finally:
        ws.close()
    if not val:
        raise RuntimeError("no privy:token in the fomo.family tab, log in first")
    return val.strip('"')


def _num(v):
        """FOMO sends many numbers as strings. None stays None."""
        try:
            return None if v in (None, "") else float(v)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _row(cls, r: dict) -> dict:
        tok, n = r.get("token") or {}, cls._num
        holders = n(r.get("holders"))
        return {"symbol": tok.get("symbol") or "?",
                "mcap": n(r.get("marketCap")) or 0, "liq": n(r.get("liquidity")) or 0,
                "vol24": n(r.get("volume24")) or 0, "price": n(r.get("priceUSD")) or 0,
                "holders": int(holders) if holders else None,
                "created": r.get("createdAt") or tok.get("createdAt"),
                "change": {300: n(r.get("change5m")), 3600: n(r.get("change1")),
                           14400: n(r.get("change4")), 86400: n(r.get("change24"))}}

    def tokens(self, ids: list[str]) -> dict[str, dict]:
        """20 per call -> {'<addr>:<netId>': row}. Rows are matched to the requested
        ids by token address + networkId, not by position: FOMO may drop or reorder."""
        out = {}
        for i in range(0, len(ids), BATCH):
            chunk = ids[i:i + BATCH]
            r = requests.post(BASE, json=chunk, timeout=30, headers=self._headers())
            if r.status_code in (401, 430):             # expired: reload the tab, retry once
                r = requests.post(BASE, json=chunk, timeout=30,
                                  headers=self._headers(fresh=True))
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict):
                if data.get("success") is False:
                    raise RuntimeError(f"FOMO filterTokens: {data.get('message')}")
                data = data.get("responseObject") or []
            wanted = {tid.lower(): tid for tid in chunk}
            for row in data:
                tok = (row or {}).get("token") or {}
                key = f"{tok.get('address', '')}:{tok.get('networkId', '')}".lower()
                if key in wanted:
                    out[wanted[key]] = self._row(row)
        return out
