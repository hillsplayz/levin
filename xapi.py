"""X (Twitter) reader for the SOCIAL question set, using X's official API (pay per use).

Set X_BEARER_TOKEN (an app-only bearer token from the X developer console). Without it
read_x returns None and the desk treats the token as having no usable X account.

Returns the block the 'social' questions expect, with raw numbers only:
  handle, created_at, followers, following, post_count, posts_last_7d, recent[],
  handle_history (always None, the API cannot tell us), bio, linked_site.
`posts_last_7d` is counted inside the last 10 original posts we fetch, so it tops out at 10.
Missing is missing: any failure returns None. We never search for a similar handle.
"""
import logging, os, time, requests
from datetime import datetime, timezone

log = logging.getLogger("desk")
API = "https://api.x.com/2"
TTL = 6 * 3600
_cache: dict = {}


def _get(path, params, token):
    r = requests.get(f"{API}{path}", params=params, timeout=20,
                     headers={"Authorization": f"Bearer {token}"})
    if r.status_code != 200:
        log.warning("X API %s -> %s %s", path, r.status_code, r.text[:200])
        return None
    return r.json()


def _ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def read_x(handle, now=None):
    token = os.environ.get("X_BEARER_TOKEN")
    if not token or not handle:
        return None
    key = handle.lower()
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]

    u = _get(f"/users/by/username/{handle}", {
        "user.fields": "created_at,description,public_metrics,entities,url"}, token)
    user = (u or {}).get("data")
    if not user:
        _cache[key] = (time.time(), None)                # not found: do not pay to ask again
        return None
    t = _get(f"/users/{user['id']}/tweets", {
        "max_results": 10, "exclude": "retweets,replies",
        "tweet.fields": "created_at,public_metrics"}, token)
    posts = (t or {}).get("data") or []

    now = now or time.time()
    m = user.get("public_metrics") or {}
    urls = ((user.get("entities") or {}).get("url") or {}).get("urls") or []
    out = {"handle": user.get("username"), "created_at": user.get("created_at"),
           "followers": m.get("followers_count"), "following": m.get("following_count"),
           "post_count": m.get("tweet_count"),
           "posts_last_7d": sum(1 for p in posts if now - _ts(p["created_at"]) < 7 * 86400),
           "recent": [{"text": p.get("text"), "posted": p.get("created_at"),
                       "replies": (p.get("public_metrics") or {}).get("reply_count"),
                       "reposts": (p.get("public_metrics") or {}).get("retweet_count")}
                      for p in posts],
           "handle_history": None, "bio": user.get("description"),
           "linked_site": (urls[0].get("expanded_url") if urls else None) or user.get("url")}
    _cache[key] = (time.time(), out)
    return out
