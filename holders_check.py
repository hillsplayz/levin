"""Is the 'top wallet' check being fooled by pool vaults?   python holders_check.py <solana mint>

Prints the biggest token accounts of a Solana token, who owns each, and whether the owner is a
normal wallet. The biggest account is often the liquidity pool or the pump.fun bonding curve.
The desk only counts real wallets, so the number on the last line is the one it uses."""
import sys
from collect import sol_holders, sol_top_wallet

if len(sys.argv) != 2:
    sys.exit("usage: python holders_check.py <mint address>")
mint = sys.argv[1]
hs = sol_holders(mint)
print(f"{'share':>7}  {'type':12} owner")
for h in hs:
    print(f"{h['pct']:7.1%}  {'wallet' if h['is_wallet'] else 'pool/program':12} {h['owner']}")
naive = hs[0]["pct"] if hs else None
print(f"\nnaive top account (the guide's way): {naive:.1%}" if naive is not None else "no holders")
print(f"biggest real wallet (what the desk now uses): {sol_top_wallet(mint):.1%}")
