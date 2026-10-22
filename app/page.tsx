import { cookies } from 'next/headers'
import { DailyChallenge } from '@/components/daily-challenge'
import { Hero } from '@/components/hero'
import { LoreSection } from '@/components/lore-section'
import { RegretArchive } from '@/components/regret-archive'
import { RegretGenerator } from '@/components/regret-generator'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { TokenSection } from '@/components/token-section'
import { getChallengeArchive, getChallengeCookieName, getDailyChallenge, isDailyChoice } from '@/lib/daily-challenge'

export default async function Page() {
  const today = getDailyChallenge()
  const archive = getChallengeArchive(new Date(), 7)
  const cookieStore = await cookies()
  const savedChoice = cookieStore.get(getChallengeCookieName(today.dateKey))?.value
  const initialChoice = isDailyChoice(savedChoice) ? savedChoice : null

  return (
    <main>
      <SiteHeader />
      <Hero />
      <DailyChallenge today={today} archive={archive} initialChoice={initialChoice} />
      <div className="border-b border-border px-4 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs font-black tracking-[0.2em] text-primary">// MORE WAYS TO REGRET PRODUCTIVELY</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-5xl">THE COULDA LAB.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Make a custom regret card, browse community-style cautionary tales, then learn the painfully repetitive lore.</p>
        </div>
      </div>
      <RegretGenerator />
      <RegretArchive />
      <LoreSection />
      <TokenSection />
      <SiteFooter />
    </main>
  )
}
