import logging, sys
from fomo_api import Fomo
from judge_client import judge
from desk import Desk
from main import main

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

if __name__ == "__main__":
    live = "--live" in sys.argv          # shadow unless you say otherwise. Leave it a week.
    main(Fomo(), judge, Desk(), shadow=not live)
