"""The Grok Bot side of the desk. Env-driven defaults; swap the bodies for your seats.

  DESK_BANK_USD      free cash (replace bank() with a real FOMO balance read)
  TELEGRAM_TOKEN / TELEGRAM_CHAT   optional, report() goes there
  SEATS_WEBHOOK      optional URL that receives the order for SIZE -> FILLS -> RISK
"""
import json, os, time, logging, requests

log = logging.getLogger("desk")


class Desk:
    def bank(self) -> float:
        return float(os.environ.get("DESK_BANK_USD", "0"))

    def read_x(self, handle):
        """SOCIAL collects this with Grok's X plugin. None = no social read (a gap,
        not a pass): the pick shrinks the ticket by NO_SOCIAL_CUT."""
        return None

    def log_shadow(self, order, stats):
        with open("shadow.jsonl", "a") as f:
            f.write(json.dumps({"ts": time.time(), "order": order, "stats": stats}) + "\n")

    def report(self, order, stats):
        if order:
            line = (f"ORDER {order['token']['ticker']} ({order['token']['chain']}) "
                    f"size x{order['size_factor']} conf {order['confidence']} "
                    f"model {order['model']}")
        else:
            line = f"NO TRADE {json.dumps(stats)}"
        log.info(line)
        tok, chat = os.environ.get("TELEGRAM_TOKEN"), os.environ.get("TELEGRAM_CHAT")
        if tok and chat:
            requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                          json={"chat_id": chat, "text": line}, timeout=15)

    def send_to_seats(self, order):
        url = os.environ.get("SEATS_WEBHOOK")
        if url:
            requests.post(url, json={"order_id": time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                                               time.gmtime()), **order},
                          timeout=15)
        else:
            log.warning("no SEATS_WEBHOOK set, order not delivered: %s", order["token"])
