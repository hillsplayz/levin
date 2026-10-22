const footerLinks = [
  ['HOME', '#top'], ['DAILY', '#daily'], ['CARD LAB', '#generator'], ['STORIES', '#archive'], ['LORE', '#lore'], ['TOKEN INFO', '#token'],
]

export function SiteFooter() {
  return (
    <footer className="px-4 py-12 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div><p className="font-mono text-2xl font-black">COULDA<span className="text-primary">.</span></p><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">The coin you didn&apos;t buy. An internet experiment about hesitation, hindsight, and charts that refuse to wait.</p></div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3">{footerLinks.map(([label, href]) => <a key={href} href={href} className="font-mono text-xs font-bold text-muted-foreground hover:text-primary">{label}</a>)}</nav>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-border pt-5 font-mono text-[10px] text-muted-foreground md:flex-row">
          <p>© 2026 COULDA · FICTIONAL SIMULATIONS FOR ENTERTAINMENT</p>
          <a href="https://x.com/COULDAPUMP" target="_blank" rel="noopener noreferrer" className="font-bold text-foreground transition-colors hover:text-primary" aria-label="Follow COULDA on X at @COULDAPUMP">
            X / TWITTER: @COULDAPUMP
          </a>
        </div>
      </div>
    </footer>
  )
}
