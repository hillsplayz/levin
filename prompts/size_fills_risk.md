SIZE   1. ticket = kelly(edge) * bank, clamped at 6% of the book. Free cash only,
          never the locked bag.
       2. ticket *= size_factor from the pick. dark data cuts to 0.40, a missing X
          account cuts to 0.60, both stack.
       3. ticket = min(ticket, liquidity_usd * 0.02). If you are more than 2% of the
          pool you are the exit, not a participant.
       4. if ticket < fee floor viable size -> return 0 and log it. Never size below
          what pays its own fees.
       Not exitable inside the slippage budget means the size is wrong, whatever the
       pick confidence said.

FILLS  1. effective_fee = max(0.0045 * ticket, 0.95) / ticket
       2. over the max -> do not send, return FEE_FLOOR, let SIZE raise or drop it.
          A $20 entry against a $0.95 floor is 4.75% round trip and no meme edge
          covers that.
       3. one market order through FOMO, no ladder, no waiting for a better price.
       4. slippage over max -> complete and flag loudly, never absorb it silently.
       5. never sell into a distributing whale. Hold and report.
       Fills go through fomo.family/r/savipww and nowhere else.

RISK   One rule, no conversation, final authority, nobody overrules it.
         avg_6h = volume.h24 / 4
         ratio  = volume.h6 / avg_6h
         ratio < 0.20 -> CLOSE, fully, inside 60 seconds.
       Poll every 5 minutes. No answer, retry twice, then CLOSE anyway.
       The moment the close is filled, call book.release(). Until you do, the desk does
       not scan.
