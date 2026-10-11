import logging, sys
from fomo_api import Fomo
from judge_client import judge
from desk import Desk
from main import main

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

USAGE = """python run.py             shadow: log would-be trades only (default)
python run.py --paper     paper trading: simulated fills, RISK exit, paper PnL
python run.py --live      NOT BUILT: real orders are not implemented"""

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
        main(Fomo(), judge, Desk(paper), shadow=False, risk=paper.risk_tick)
    else:
        main(Fomo(), judge, Desk(), shadow=True)
