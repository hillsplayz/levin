import Image from 'next/image'

const episodes = [
  ['01', 'THE DISCOVERY', 'Tiny market cap. Strong idea. He is, somehow, early.'],
  ['02', 'THE RESEARCH', '37 tabs. 12 videos. Zero increase in conviction.'],
  ['03', 'THE DECISION', 'He closes the tab. Calls it “risk management.”'],
  ['04', 'THE PUMP', 'The chart exits the known atmosphere without him.'],
  ['05', 'THE REGRET', '“I literally had it on my watchlist.”'],
  ['06', 'THE NEXT ONE', 'A fresh ticker appears. The loop begins again.'],
]

export function LoreSection() {
  return (
    <section id="lore" className="border-b border-border px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <div className="flex max-w-4xl flex-col gap-4">
          <div className="font-mono text-xs font-bold tracking-[0.2em] text-primary">// THE COULDA LORE · EPISODE 001</div>
          <h2 className="text-balance text-5xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">A HERO WITH<br />NO POSITION.</h2>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">Meet Cal. He can detect a 100x from three browser tabs away—and will conduct just enough research to miss every single one.</p>
        </div>
        <figure className="overflow-hidden border border-border bg-card">
          <div className="relative aspect-[3/1] min-h-72 w-full">
            <Image src="/coulda-comic.png" alt="Six comic panels showing Cal discover, overthink, skip, and regret a fictional coin before repeating the cycle" fill sizes="100vw" className="object-cover object-center" />
          </div>
          <figcaption className="border-t border-border px-4 py-3 font-mono text-[10px] text-muted-foreground">THE INFINITE LOOP · ORIGINAL COULDA CHARACTER ART</figcaption>
        </figure>
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {episodes.map(([number, title, copy]) => (
            <article key={number} className="flex min-h-44 flex-col justify-between gap-6 bg-background p-5">
              <span className="font-mono text-xs font-black text-primary">EP.{number}</span>
              <div><h3 className="font-mono text-sm font-black">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
