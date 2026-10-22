import { ArrowUpRight } from 'lucide-react'

const links = [
  ['DAILY', '#daily'],
  ['CARD LAB', '#generator'],
  ['STORIES', '#archive'],
  ['LORE', '#lore'],
  ['TOKEN', '#token'],
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between px-4 md:h-16 md:flex-nowrap md:px-8">
        <a href="#top" className="group flex h-14 items-center gap-3 md:h-auto" aria-label="COULDA home">
          <span className="flex size-8 items-center justify-center border border-primary bg-primary font-mono text-sm font-black text-primary-foreground transition-transform group-hover:-rotate-6">C</span>
          <span className="font-mono text-lg font-black tracking-[-0.05em]">COULDA<span className="text-primary">.</span></span>
        </a>
        <nav aria-label="Main navigation" className="order-3 flex w-full items-center gap-6 overflow-x-auto border-t border-border py-3 md:order-none md:w-auto md:border-t-0 md:py-0">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="shrink-0 font-mono text-xs font-bold tracking-widest text-muted-foreground transition-colors hover:text-primary">{label}</a>
          ))}
          <a href="https://x.com/COULDAPUMP" target="_blank" rel="noopener noreferrer" className="shrink-0 font-mono text-xs font-bold tracking-widest text-muted-foreground transition-colors hover:text-primary" aria-label="COULDA on X at @COULDAPUMP">
            X / @COULDAPUMP
          </a>
        </nav>
        <a href="#daily" className="flex items-center gap-2 border border-primary px-3 py-2 font-mono text-[11px] font-black text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:px-4 sm:text-xs">
          PLAY TODAY <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}
