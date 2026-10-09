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
python run.py            # shadow mode: logs would-be orders to shadow.jsonl
python run.py --live     # only after a week of shadow
```

| File | Role |
|---|---|
| `judge.py` | only holder of the Jev key; returns raw answers |
| `judge_client.py` | how every seat reaches the judge |
| `questions.py` | every question the desk can ask |
| `thresholds.py` / `filter.py` | every number / the order they fire in |
| `collect.py`, `fomo_api.py` | data fetching |
| `pick.py`, `book.py`, `main.py` | choice, state (position + bench), the cycle |
| `desk.py` | Grok Bot side: bank, X read, shadow log, Telegram, seat handoff (stubs to wire up) |
| `prompts/` | handoff, SOCIAL, SIZE/FILLS/RISK seat prompts |

Notes: `fomo_api.py` response mapping and the Chrome CDP token read are best-effort
(FOMO has no public API); `desk.read_x` returns `None` until wired to the X plugin.
Run tests: `python -c "import sys;sys.path.insert(0,'tests');import test_filter as t;[getattr(t,n)() for n in dir(t) if n.startswith('test_')]"` (or pytest).
