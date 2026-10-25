import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleDashed } from 'lucide-react'

const tokenFields = [
  { label: 'BLOCKCHAIN', value: 'Solana', confirmed: true },
  { label: 'CONTRACT ADDRESS', value: 'Published at launch', confirmed: false },
  { label: 'EXPLORER', value: 'Available after launch', confirmed: false },
  { label: 'MARKET CHART', value: 'Pump.fun', href: 'https://pump.fun', confirmed: true },
  { label: 'LIQUIDITY', value: 'Locked', confirmed: true },
  { label: 'OFFICIAL SOCIAL', value: 'X / @COULDAPUMP', href: 'https://x.com/COULDAPUMP', confirmed: true },
]

export function TokenSection() {
  return (
    <section id="token" className="scroll-mt-28 border-b border-border bg-card px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="flex flex-col gap-6">
          <div className="font-mono text-xs font-bold tracking-[0.2em] text-primary">// $COULDA STATUS</div>
          <h2 className="text-balance text-5xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">VERIFY.<br />DON&apos;T TRUST.</h2>
          <p className="text-pretty leading-relaxed text-muted-foreground">$COULDA is planned for Solana with its market chart on Pump.fun and locked liquidity. The contract and explorer links will only appear here once they are public and verifiable.</p>
          <div className="border border-destructive bg-destructive/10 p-4">
            <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" /><p className="text-sm leading-relaxed text-muted-foreground"><strong className="text-destructive">Risk disclosure:</strong> Meme tokens are highly speculative and may lose all their value. Nothing on this site is financial advice or a promise of returns.</p></div>
          </div>
        </div>
        <dl className="border border-border">
          {tokenFields.map(({ label, value, href, confirmed }) => (
            <div key={label} className="grid grid-cols-[0.8fr_1.2fr] items-center border-b border-border px-4 py-5 last:border-b-0 md:px-6">
              <dt className="font-mono text-[10px] font-bold text-muted-foreground md:text-xs">{label}</dt>
              <dd className="flex items-center justify-end gap-2 text-right font-mono text-xs font-black md:text-sm">
                {confirmed ? <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> : <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />}
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-primary">
                    {value}<ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                ) : value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
