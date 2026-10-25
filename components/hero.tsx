import Image from 'next/image'
import { ArrowDownRight, ArrowRight, Radio } from 'lucide-react'

export function Hero() {
  return (
    <section id="purpose" className="scroll-mt-28 relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 terminal-grid opacity-40" />
      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center px-4 py-12 md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-16">
        <div className="relative z-10 flex flex-col items-start gap-7">
          <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-[0.18em] text-primary">
            <Radio className="size-4 animate-pulse" aria-hidden="true" />
            LIVE FROM THE BAD TIMELINE
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="max-w-4xl text-balance font-sans text-[clamp(4rem,11vw,9.5rem)] font-black leading-[0.78] tracking-[-0.09em]">
              YOU COULDA<br /><span className="text-primary">BEEN RICH.</span>
            </h2>
            <p className="max-w-xl text-pretty text-base font-bold leading-relaxed text-foreground md:text-xl">
              Every day, one coin. One decision. One chance to prove you&apos;re not a coward.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a href="#daily" className="flex h-12 items-center justify-center gap-3 bg-primary px-6 font-mono text-sm font-black text-primary-foreground transition-transform hover:-translate-y-1">
              PLAY TODAY&apos;S CHALLENGE <ArrowDownRight className="size-5" aria-hidden="true" />
            </a>
            <a href="#archive" className="flex h-12 items-center justify-center gap-3 border border-border bg-card px-6 font-mono text-sm font-black transition-colors hover:border-primary hover:text-primary">
              ENTER THE ARCHIVE <ArrowRight className="size-5" aria-hidden="true" />
            </a>
          </div>
          <p className="font-mono text-[11px] uppercase leading-relaxed text-muted-foreground">
            No wallet. No money. Just regret. Fictional simulation only.
          </p>
        </div>
        <div className="relative mt-10 min-h-[390px] lg:mt-0 lg:min-h-[650px]">
          <div className="absolute left-0 top-6 z-10 border border-destructive bg-background px-3 py-2 font-mono text-[10px] font-bold text-destructive md:left-8 md:top-10">
            POSITION: $0.00<br />CONVICTION: ALSO $0.00
          </div>
          <Image src="/coulda-mascot.png" alt="The COULDA mascot slumped in a chair while watching a fictional chart surge without him" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-contain object-center" />
          <div className="absolute bottom-2 right-0 z-10 max-w-[220px] border border-border bg-background/95 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground md:bottom-8">
            <span className="text-primary">SIMULATED CHART</span><br />No real asset. Unfortunately, the feeling is authentic.
          </div>
        </div>
      </div>
      <div className="marquee border-t border-border bg-primary py-2 text-primary-foreground" aria-hidden="true">
        <div>YOU SAW IT · YOU HESITATED · YOU LOST THE BAG · ANOTHER DAY · ANOTHER MISSED 100X · </div>
      </div>
    </section>
  )
}
