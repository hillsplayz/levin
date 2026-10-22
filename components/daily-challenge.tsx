'use client'

import { useState } from 'react'
import { ArrowLeft, CalendarDays, Check, ExternalLink, LockKeyhole, RotateCcw, SkipForward, TrendingUp } from 'lucide-react'
import type { DailyChallenge as DailyChallengeData, DailyChoice } from '@/lib/daily-challenge'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Props = {
  today: DailyChallengeData
  archive: DailyChallengeData[]
  initialChoice: DailyChoice | null
}

function formatMoney(value: number) {
  const digits = value >= 100 ? 0 : 2
  const [whole, decimal] = value.toFixed(digits).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimal ? `$${grouped}.${decimal}` : `$${grouped}`
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${months[Number(month) - 1]} ${Number(day)}, ${year}`
}

function resultCopy(challenge: DailyChallengeData, choice: DailyChoice) {
  const finalValue = challenge.investment * challenge.outcomeMultiplier
  if (choice === 'skip') {
    if (challenge.outcomeMultiplier < 1) return 'You skipped it and, against all precedent, your hesitation developed survival instincts.'
    if (challenge.outcomeMultiplier > 25) return 'You conducted flawless research and then used it to watch somebody else become unbearable online.'
    return 'Your watchlist remains undefeated. Unfortunately, watchlists cannot purchase groceries.'
  }
  if (challenge.outcomeMultiplier < 1) return 'You bought the top with the confidence of someone who had already drafted the victory post.'
  if (challenge.outcomeMultiplier > 25) return 'A fictional home run. Please do not let this simulated event alter your personality.'
  return 'You bought, it worked, and now your group chat must endure the consequences.'
}

export function DailyChallenge({ today, archive, initialChoice }: Props) {
  const [selected, setSelected] = useState(today)
  const [todayChoice, setTodayChoice] = useState<DailyChoice | null>(initialChoice)
  const [draftChoice, setDraftChoice] = useState<DailyChoice | null>(initialChoice)
  const [lockedChoice, setLockedChoice] = useState<DailyChoice | null>(initialChoice)
  const [submitting, setSubmitting] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [error, setError] = useState('')

  const isToday = selected.id === today.id
  const finalValue = selected.investment * selected.outcomeMultiplier
  const profit = finalValue - selected.investment
  const maxChartValue = Math.max(...selected.chart.map((point) => point.value))

  function selectChallenge(challenge: DailyChallengeData) {
    setSelected(challenge)
    setError('')
    setRevealing(false)
    if (challenge.id === today.id) {
      setDraftChoice(todayChoice)
      setLockedChoice(todayChoice)
    } else {
      setDraftChoice(null)
      setLockedChoice(null)
    }
  }

  async function lockDecision() {
    if (!draftChoice || lockedChoice || submitting) return
    setSubmitting(true)
    setError('')

    try {
      let confirmedChoice = draftChoice
      if (isToday) {
        const response = await fetch('/api/daily-challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: selected.id, choice: draftChoice }),
        })
        const result = (await response.json()) as { choice?: DailyChoice; error?: string }
        if (!response.ok || !result.choice) throw new Error(result.error ?? 'Could not lock the decision.')
        confirmedChoice = result.choice
      }

      setDraftChoice(confirmedChoice)
      if (isToday) setTodayChoice(confirmedChoice)
      setRevealing(true)
      window.setTimeout(() => {
        setLockedChoice(confirmedChoice)
        setRevealing(false)
        setSubmitting(false)
      }, 900)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not lock the decision.')
      setSubmitting(false)
    }
  }

  function replayArchive() {
    if (isToday) return
    setDraftChoice(null)
    setLockedChoice(null)
    setRevealing(false)
    setError('')
  }

  function shareOnX() {
    if (!lockedChoice) return
    const action = lockedChoice === 'buy' ? `BOUGHT ${selected.ticker}` : `SKIPPED ${selected.ticker}`
    const outcome = selected.outcomeMultiplier >= 1 ? `${selected.outcomeMultiplier}x` : `${Math.round((1 - selected.outcomeMultiplier) * 100)}% down`
    const text = `${action} in The COULDA Daily Challenge. Fictional outcome: ${outcome}. ${resultCopy(selected, lockedChoice)} #COULDA`
    const shareUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <section id="daily" className="border-b border-border px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="flex max-w-3xl flex-col gap-3">
            <div className="font-mono text-xs font-black tracking-[0.2em] text-primary">// ONE SHOT. SAME SCENARIO. EVERY DAY.</div>
            <h2 className="text-balance text-4xl font-black leading-[0.9] tracking-[-0.06em] sm:text-5xl md:text-7xl">THE COULDA<br />DAILY CHALLENGE.</h2>
          </div>
          <div className="flex max-w-sm flex-col gap-3 border-l border-primary pl-4">
            <Badge variant="outline" className="w-fit">DEMO MODE · UNVERIFIED</Badge>
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">Your official daily choice is locked to this browser. No leaderboard is shown because no verified results database is connected.</p>
          </div>
        </div>

        <div className="grid min-w-0 overflow-hidden border border-border bg-card lg:grid-cols-[0.72fr_1.28fr]">
          <div className="flex min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border p-4 md:p-5">
              <div className="flex items-center gap-2 font-mono text-xs font-black text-primary"><CalendarDays className="size-4" aria-hidden="true" />CHALLENGE LOG</div>
              <span className="font-mono text-[10px] text-muted-foreground">UTC DAILY</span>
            </div>
            <nav aria-label="Daily challenge archive" className="flex min-w-0 max-w-full gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
              <button type="button" onClick={() => selectChallenge(today)} className={cn('flex min-w-48 items-center justify-between border p-3 text-left transition-colors lg:min-w-0', isToday ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary')}>
                <span><span className="block font-mono text-[10px] font-bold">TODAY</span><span className="mt-1 block text-sm font-black">{today.ticker} · {formatDate(today.dateKey)}</span></span>
                {todayChoice && <Check className="size-4" aria-label="Completed" />}
              </button>
              {archive.map((challenge) => (
                <button key={challenge.id} type="button" onClick={() => selectChallenge(challenge)} className={cn('flex min-w-48 items-center justify-between border p-3 text-left transition-colors lg:min-w-0', selected.id === challenge.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary')}>
                  <span><span className="block font-mono text-[10px] text-muted-foreground">ARCHIVE #{challenge.sequence}</span><span className="mt-1 block text-sm font-black">{challenge.ticker} · {formatDate(challenge.dateKey)}</span></span>
                  <ArrowLeft className="size-3 rotate-180 text-muted-foreground" aria-hidden="true" />
                </button>
              ))}
            </nav>
            <div className="mt-auto border-t border-border p-4 font-mono text-[10px] leading-relaxed text-muted-foreground md:p-5">ARCHIVE REPLAYS ARE FOR PRACTICE. THEY DO NOT ALTER OR VERIFY TODAY&apos;S LOCKED CHOICE.</div>
          </div>

          <div className="relative min-h-[620px] min-w-0 overflow-hidden p-5 md:p-8 lg:p-10">
            {revealing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background" aria-live="polite">
                <div className="challenge-scan absolute inset-x-0 top-0 h-1/5 bg-primary/20" />
                <div className="flex flex-col items-center gap-4 text-center">
                  <LockKeyhole className="size-10 text-primary" aria-hidden="true" />
                  <p className="font-mono text-sm font-black tracking-[0.2em] text-primary">DECISION LOCKED</p>
                  <p className="font-mono text-xs text-muted-foreground">CALCULATING FICTIONAL CONSEQUENCES...</p>
                </div>
              </div>
            )}

            {!lockedChoice ? (
              <div className="flex h-full flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant="outline">{isToday ? 'TODAY\'S OFFICIAL CHALLENGE' : 'ARCHIVE REPLAY'}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">#{selected.sequence} · {formatDate(selected.dateKey)}</span>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="font-mono text-xs font-bold text-primary">{selected.ticker}</p>
                  <h3 className="text-balance text-4xl font-black tracking-[-0.05em] md:text-6xl">{selected.coin}</h3>
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{selected.pitch}</p>
                </div>
                <dl className="grid grid-cols-2 border-y border-border font-mono text-xs sm:grid-cols-3">
                  <div className="border-r border-border p-4"><dt className="text-muted-foreground">FICTIONAL START MCAP</dt><dd className="mt-2 text-lg font-black text-foreground">{formatMoney(selected.startCap)}</dd></div>
                  <div className="p-4 sm:border-r sm:border-border"><dt className="text-muted-foreground">HYPOTHETICAL STACK</dt><dd className="mt-2 text-lg font-black text-foreground">{formatMoney(selected.investment)}</dd></div>
                  <div className="col-span-2 border-t border-border p-4 sm:col-span-1 sm:border-t-0"><dt className="text-muted-foreground">TIME TO DECIDE</dt><dd className="mt-2 text-lg font-black text-primary">RIGHT NOW</dd></div>
                </dl>
                <div className="border border-border bg-background p-4">
                  <p className="font-mono text-[10px] font-bold text-muted-foreground">SUSPICIOUS SIGNAL</p>
                  <p className="mt-2 text-sm font-bold leading-relaxed">“{selected.signal}”</p>
                </div>
                <div className="mt-auto flex flex-col gap-4">
                  <div>
                    <p className="mb-3 font-mono text-xs font-black">LOCK YOUR DECISION</p>
                    <ToggleGroup value={draftChoice ? [draftChoice] : []} onValueChange={(values) => setDraftChoice((values[0] as DailyChoice | undefined) ?? null)} variant="outline" spacing={2} className="grid w-full grid-cols-2" aria-label="Choose buy or skip">
                      <ToggleGroupItem value="buy" className="h-16 text-base font-black data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"><TrendingUp data-icon="inline-start" />BUY</ToggleGroupItem>
                      <ToggleGroupItem value="skip" className="h-16 text-base font-black data-pressed:border-destructive data-pressed:bg-destructive data-pressed:text-foreground"><SkipForward data-icon="inline-start" />SKIP</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <Button size="lg" onClick={lockDecision} disabled={!draftChoice || submitting} className="h-14 font-mono font-black"><LockKeyhole data-icon="inline-start" />{submitting ? 'LOCKING...' : 'LOCK IT IN'}</Button>
                  {error && <p role="alert" className="font-mono text-xs text-destructive">{error}</p>}
                  <p className="text-center font-mono text-[10px] leading-relaxed text-muted-foreground">ALL TOKENS, PRICES, MARKET CAPS, AND RETURNS ARE FICTIONAL SIMULATIONS. NOT FINANCIAL ADVICE.</p>
                </div>
              </div>
            ) : (
              <div className="challenge-reveal flex h-full flex-col gap-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge className="bg-primary text-primary-foreground">OUTCOME REVEALED</Badge>
                  <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><LockKeyhole className="size-3" aria-hidden="true" />CHOICE LOCKED: {lockedChoice.toUpperCase()}</span>
                </div>

                <div className="grid gap-6 md:grid-cols-[1fr_0.9fr] md:items-end">
                  <div>
                    <p className="font-mono text-xs font-bold text-muted-foreground">FICTIONAL RETURN</p>
                    <p className={cn('mt-2 text-7xl font-black tracking-[-0.08em] md:text-8xl', selected.outcomeMultiplier >= 1 ? 'text-primary' : 'text-destructive')}>{selected.outcomeMultiplier}X</p>
                    <p className="mt-3 max-w-xl text-pretty text-xl font-black leading-snug">{resultCopy(selected, lockedChoice)}</p>
                  </div>
                  <dl className="border border-border bg-background font-mono text-xs">
                    <div className="flex justify-between gap-4 border-b border-border p-3"><dt className="text-muted-foreground">HYPOTHETICAL START</dt><dd className="font-bold">{formatMoney(selected.investment)}</dd></div>
                    <div className="flex justify-between gap-4 border-b border-border p-3"><dt className="text-muted-foreground">SIMULATED END</dt><dd className="font-bold">{formatMoney(finalValue)}</dd></div>
                    <div className="flex justify-between gap-4 p-3"><dt className="text-muted-foreground">SIMULATED P/L</dt><dd className={cn('font-bold', profit >= 0 ? 'text-primary' : 'text-destructive')}>{profit >= 0 ? '+' : ''}{formatMoney(profit)}</dd></div>
                  </dl>
                </div>

                <div className="flex h-40 items-end gap-1 border border-border bg-background p-4" aria-label={`Fictional outcome chart ending at ${selected.outcomeMultiplier} times`}>
                  {selected.chart.map((point, index) => (
                    <div key={point.tick} className="flex h-full flex-1 items-end">
                      <div className={cn('w-full origin-bottom transition-transform duration-700', selected.outcomeMultiplier >= 1 ? 'bg-primary' : 'bg-destructive')} style={{ height: `${Math.max(5, (point.value / maxChartValue) * 100)}%`, transitionDelay: `${index * 45}ms` }} />
                    </div>
                  ))}
                </div>

                <div className="border border-primary bg-primary/10 p-5" aria-label="Shareable COULDA result card">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-lg font-black">COULDA<span className="text-primary">.</span></span>
                    <span className="font-mono text-[10px] text-muted-foreground">DAILY #{selected.sequence}</span>
                  </div>
                  <p className="mt-8 font-mono text-xs text-muted-foreground">I {lockedChoice === 'buy' ? 'BOUGHT' : 'SKIPPED'} {selected.ticker}</p>
                  <p className="mt-1 text-3xl font-black tracking-[-0.04em]">{selected.outcomeMultiplier >= 1 ? `${selected.outcomeMultiplier}X FICTIONAL OUTCOME` : `${Math.round((1 - selected.outcomeMultiplier) * 100)}% FICTIONAL DROP`}</p>
                  <p className="mt-3 font-mono text-[10px] text-muted-foreground">SIMULATION ONLY · UNVERIFIED DEMO RESULT · NOT FINANCIAL ADVICE</p>
                </div>

                <div className="mt-auto flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" onClick={shareOnX} className="h-12 flex-1 font-mono font-black">SHARE ON X <ExternalLink data-icon="inline-end" /></Button>
                  {!isToday && <Button size="lg" variant="outline" onClick={replayArchive} className="h-12 flex-1 font-mono font-black"><RotateCcw data-icon="inline-start" />REPLAY THIS DAY</Button>}
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">ALL VALUES SHOWN ARE FICTIONAL SIMULATIONS. NO PARTICIPANT COUNT OR LEADERBOARD IS DISPLAYED BECAUSE DEMO RESULTS ARE NOT DATABASE-VERIFIED.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
