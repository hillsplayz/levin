import logging, sys
from fomo_api import Fomo
from judge_client import judge
from desk import Desk
from main import main

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

USAGE = """python run.py             shadow: log would-be trades only (default)
python run.py --paper     paper trading: simulated fills, RISK exit, paper PnL
python run.py --live      NOT BUILT: real orders are not implemented"""

def _banner(mode: str):
    """One line at startup (log + Telegram) saying what is actually switched on."""
    import os
    on = lambda k: "on" if os.environ.get(k) else "OFF"
    tg = "on" if os.environ.get("TELEGRAM_TOKEN") and os.environ.get("TELEGRAM_CHAT") else "OFF"
    msg = (f"Desk started: {mode} | X reader {on('X_BEARER_TOKEN')} | Telegram {tg} | "
           f"bank ${os.environ.get('DESK_BANK_USD', '0')}")
    logging.getLogger("desk").info(msg)
    Desk().notify(msg)


def _telegram_commands():
    import os, threading
    if os.environ.get("TELEGRAM_TOKEN") and os.environ.get("TELEGRAM_CHAT"):
        import tgbot
        threading.Thread(target=tgbot.run_forever, daemon=True).start()


if __name__ == "__main__":
    _telegram_commands()
    if "--live" in sys.argv:
        sys.exit("--live is not implemented. No code here places real orders.\n" + USAGE)
    if "--paper" in sys.argv:
        import paper
        _banner("PAPER trading")
        main(Fomo(), judge, Desk(paper), shadow=False, risk=paper.risk_tick)
    else:
        _banner("SHADOW (log only)")
        main(Fomo(), judge, Desk(), shadow=True)
