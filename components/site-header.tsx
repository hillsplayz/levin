import { ArrowUpRight, Menu } from 'lucide-react'

const links = [
  ['DAILY', '#daily'],
  ['CARD LAB', '#generator'],
  ['STORIES', '#archive'],
  ['LORE', '#lore'],
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <a href="#top" className="group flex items-center gap-3" aria-label="COULDA home">
          <span className="flex size-8 items-center justify-center border border-primary bg-primary text-primary-foreground font-mono text-sm font-black transition-transform group-hover:-rotate-6">C</span>
          <span className="font-mono text-lg font-black tracking-[-0.05em]">COULDA<span className="text-primary">.</span></span>
        </a>
        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="font-mono text-xs font-bold tracking-widest text-muted-foreground transition-colors hover:text-primary">{label}</a>
          ))}
        </nav>
        <a href="#daily" className="hidden items-center gap-2 border border-primary px-4 py-2 font-mono text-xs font-black text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:flex">
          PLAY TODAY <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
        <a href="#daily" className="flex size-9 items-center justify-center border border-border md:hidden" aria-label="Go to daily challenge">
          <Menu className="size-4" aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}
