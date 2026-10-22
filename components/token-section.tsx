import { AlertTriangle, CircleDashed } from 'lucide-react'

const tokenFields = [
  ['BLOCKCHAIN', 'Not announced'],
  ['CONTRACT ADDRESS', 'Not announced'],
  ['EXPLORER', 'Coming soon'],
  ['MARKET CHART', 'Coming soon'],
  ['TOTAL SUPPLY', 'Not announced'],
  ['DISTRIBUTION', 'Not announced'],
  ['LIQUIDITY', 'Not verified'],
  ['OFFICIAL SOCIALS', 'Not announced'],
]

export function TokenSection() {
  return (
    <section id="token" className="border-b border-border bg-card px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="flex flex-col gap-6">
          <div className="font-mono text-xs font-bold tracking-[0.2em] text-primary">// $COULDA STATUS</div>
          <h2 className="text-balance text-5xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">VERIFY.<br />DON&apos;T TRUST.</h2>
          <p className="text-pretty leading-relaxed text-muted-foreground">No contract, supply, launch status, liquidity, listings, or partnerships are published until they can be verified. The website is free to use and never requires a token purchase.</p>
          <div className="border border-destructive bg-destructive/10 p-4">
            <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" /><p className="text-sm leading-relaxed text-muted-foreground"><strong className="text-destructive">Risk disclosure:</strong> Meme tokens are highly speculative and may lose all their value. Nothing on this site is financial advice or a promise of returns.</p></div>
          </div>
        </div>
        <dl className="border border-border">
          {tokenFields.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[0.8fr_1.2fr] items-center border-b border-border px-4 py-5 last:border-b-0 md:px-6">
              <dt className="font-mono text-[10px] font-bold text-muted-foreground md:text-xs">{label}</dt>
              <dd className="flex items-center justify-end gap-2 text-right font-mono text-xs font-black md:text-sm"><CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
