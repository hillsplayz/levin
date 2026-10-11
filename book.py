import os, sqlite3, time
from thresholds import MAX_WATCH_TRIES

DB = sqlite3.connect(os.environ.get("DESK_DB", "desk.db"), check_same_thread=False)
DB.executescript("""
CREATE TABLE IF NOT EXISTS position(
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ticker TEXT, addr TEXT, net INT, opened_at REAL);
CREATE TABLE IF NOT EXISTS bench(
  tid TEXT PRIMARY KEY, reason TEXT, until REAL);
CREATE TABLE IF NOT EXISTS watch(
  tid TEXT PRIMARY KEY, ready_at REAL, tries INT);
""")

# how long a rejection stands, by what fired it
BENCH_MINUTES = {
    # facts that will not change while this token exists
    "honeypot": 100_000, "authority_open": 100_000,
    "top_wallet": 100_000, "sell_side": 100_000,
    # slow to change
    "recycled_account": 360, "account_is_the_project": 360,
    # can change as the float moves
    "top_10": 90, "holders": 90, "dev_still_loaded": 90,
    "concentration_is_exit_risk": 90,
    # can change inside the hour, keep it short or you miss the token maturing
    "shape": 25, "shape_weak": 25, "momentum_already_spent": 25,
    "liquidity_fits_ticket": 25, "liquidity": 25, "volume": 25,
    "trades": 25, "mcap": 25, "age": 20,
}
DEFAULT_BENCH = 45


def held():
    r = DB.execute("SELECT ticker, opened_at FROM position WHERE id=1").fetchone()
    return {"ticker": r[0], "minutes": (time.time() - r[1]) / 60} if r else None


def take(order):
    t = order["token"]
    DB.execute("INSERT OR REPLACE INTO position VALUES (1,?,?,?,?)",
               (t["ticker"], t["address"], t["network_id"], time.time()))
    DB.commit()


def release():
    """RISK calls this the moment a close is filled. Nothing else calls it."""
    DB.execute("DELETE FROM position")
    DB.commit()


def benched(tid: str) -> bool:
    r = DB.execute("SELECT until FROM bench WHERE tid=?", (tid,)).fetchone()
    return bool(r and r[0] > time.time())


def sit(tid: str, reason: str):
    mins = BENCH_MINUTES.get(reason, DEFAULT_BENCH)
    DB.execute("INSERT OR REPLACE INTO bench VALUES (?,?,?)",
               (tid, reason, time.time() + mins * 60))
    DB.commit()


def watch(tid: str, minutes: float):
    """A token rejected for being too YOUNG is not a bad token, it is an early one.
    Re-check it when it should be old enough. Re-sightings while it is still waiting
    do not count as tries; after MAX_WATCH_TRIES real re-checks it goes on the bench."""
    r = DB.execute("SELECT ready_at, tries FROM watch WHERE tid=?", (tid,)).fetchone()
    if r and r[0] > time.time():
        return
    tries = (r[1] if r else 0) + 1
    if tries > MAX_WATCH_TRIES:
        DB.execute("DELETE FROM watch WHERE tid=?", (tid,))
        DB.commit()
        sit(tid, "age")
        return
    DB.execute("INSERT OR REPLACE INTO watch VALUES (?,?,?)",
               (tid, time.time() + max(minutes, 1) * 60, tries))
    DB.commit()


def due(limit: int = 100) -> list[str]:
    """Watched tokens whose time has come. They go into this cycle's FOMO batch."""
    rows = DB.execute("SELECT tid FROM watch WHERE ready_at <= ? ORDER BY ready_at LIMIT ?",
                      (time.time(), limit)).fetchall()
    return [r[0] for r in rows]


def unwatch(tid: str):
    DB.execute("DELETE FROM watch WHERE tid=?", (tid,))
    DB.commit()
