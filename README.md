# Levin desk

Memecoin desk where **Jev (TypeSafe) judges, code does arithmetic, Grok Bot seats act.**

Funnel: GeckoTerminal new pools → FOMO batch → free cut → DexScreener trade cut →
GeckoTerminal dossier → Jev judge (market + chain + social) → one `pick` → seats.

## Setup
```
pip install -r requirements.txt            # python 3.10+
export TYPESAFE_API_KEY="ts-..."           # judge machine only
export DESK_SECRET="$(openssl rand -hex 24)"
uvicorn judge:app --host 0.0.0.0 --port 8080
cloudflared tunnel --url http://localhost:8080

# on the desk machine / bots
export JUDGE_URL="https://<tunnel>/judge" DESK_SECRET=...
# Chrome logged into fomo.family with --remote-debugging-port=9222 (or set FOMO_BEARER)
export DESK_BANK_USD=1000
start_desk.bat         # one click: judge + desk (paper) + dashboard + FOMO Chrome
python run.py            # shadow: logs would-be orders to shadow.jsonl, buys nothing
python run.py --paper    # paper trading: simulated fills, RISK exit, paper PnL
python -m uvicorn dashboard:app --port 8090   # http://127.0.0.1:8090
# --live is NOT implemented: no code here places real orders
```

| File | Role |
|---|---|
| `judge.py` | only holder of the Jev key; returns raw answers |
| `judge_client.py` | how every seat reaches the judge |
| `questions.py` | every question the desk can ask |
| `thresholds.py` / `filter.py` | every number / the order they fire in |
| `collect.py`, `fomo_api.py` | data fetching |
| `pick.py`, `book.py`, `main.py` | choice, state (position + bench), the cycle |
| `paper.py` | SIZE / FILLS / RISK as code with simulated fills (DexScreener prices) |
| `dashboard.py`, `dashboard.html` | local dashboard: funnel, shadow picks, paper trades and PnL |
| `xapi.py` | reads an X account via the official X API (set X_BEARER_TOKEN) |
| `tgbot.py` | Telegram commands (/status /pnl /trades), read-only, answers only your chat |
| `tokenlog.py`, `whatif.py` | log every judged token; `python whatif.py` shows what looser filters would let through |
| `report.py` | morning status, evening report, Sunday weekly review to Telegram |
| `selftest.py` | cross-checks the 10 busiest Solana tokens across GeckoTerminal, DexScreener and FOMO |
| `desk.py` | Grok Bot side: bank, X read, shadow log, Telegram, seat handoff (stubs to wire up) |
| `prompts/` | handoff, SOCIAL, SIZE/FILLS/RISK seat prompts |

Notes: `fomo_api.py` response mapping and the Chrome CDP token read are best-effort
(FOMO has no public API); `desk.read_x` returns `None` until wired to the X plugin.
Run tests: `python -c "import sys;sys.path.insert(0,'tests');import test_filter as t;[getattr(t,n)() for n in dir(t) if n.startswith('test_')]"` (or pytest).
