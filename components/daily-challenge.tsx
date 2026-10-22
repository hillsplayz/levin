'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { ArrowLeft, CalendarDays, Check, Clipboard, Download, ExternalLink, Flame, LockKeyhole, RotateCcw, Share2, SkipForward, Sparkles, TrendingUp, UserRound } from 'lucide-react'
import type { DailyChallenge as DailyChallengeData, DailyChoice } from '@/lib/daily-challenge'
import { calculateCouldaScore, getCouldaTitle } from '@/lib/daily-challenge'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Profile = { iq: number; title: string; played: number; correct: number; cooked: number; hypotheticalDelta: number; currentStreak: number; bestStreak: number; pattern: string; achievements: string[]; referralCode: string }
type Community = { buy: number; skip: number; total: number; buyPercent: number; skipPercent: number }
type GameStatus = { choice: DailyChoice | null; score: number | null; profile: Profile | null; community: Community }
type Props = { today: DailyChallengeData; archive: DailyChallengeData[]; initialChoice: DailyChoice | null }
type ReceiptFormat = 'landscape' | 'portrait'

const fetcher = (url: string) => fetch(url).then((response) => response.json() as Promise<GameStatus>)

function formatMoney(value: number) {
  const absolute = Math.abs(value)
  const formatted = absolute.toLocaleString('en-US', { maximumFractionDigits: absolute >= 100 ? 0 : 2 })
  return `${value < 0 ? '-' : ''}$${formatted}`
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${dateKey}T00:00:00Z`)).toUpperCase()
}

function getRoast(challenge: DailyChallengeData, choice: DailyChoice, score: number) {
  const templates = choice === 'skip'
    ? [`You researched ${challenge.ticker} for six hours and still managed to buy absolutely nothing.`, `You didn&apos;t miss the pump. You missed an entire character development arc.`, `Your risk management is immaculate. Your hypothetical portfolio is in tears.`]
    : challenge.outcomeMultiplier < 1
      ? [`You bought ${challenge.ticker} with conviction. The chart filed a restraining order.`, `You found the one falling knife that came with a loyalty program.`, `The good news: you acted. The chart&apos;s news was less supportive.`]
      : [`A fictional win and suddenly you&apos;re typing a 37-post trading thread.`, `You pressed BUY once and your group chat will hear about it forever.`, `Simulated profit. Extremely real ego. Classic.`]
  return templates[score % templates.length]
}

function Countdown() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  if (now === null) return <span aria-label="Loading time until the next challenge">--:--:--</span>
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  const remaining = Math.max(0, next.getTime() - now)
  const hours = String(Math.floor(remaining / 3_600_000)).padStart(2, '0')
  const minutes = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, '0')
  const seconds = String(Math.floor((remaining % 60_000) / 1_000)).padStart(2, '0')
  return <span aria-label={`${hours} hours, ${minutes} minutes until the next challenge`}>{hours}:{minutes}:{seconds}</span>
}

export function DailyChallenge({ today, archive, initialChoice }: Props) {
  const { data: status, mutate } = useSWR<GameStatus>('/api/daily-challenge', fetcher)
  const [selected, setSelected] = useState(today)
  const [draftChoice, setDraftChoice] = useState<DailyChoice | null>(initialChoice)
  const [lockedChoice, setLockedChoice] = useState<DailyChoice | null>(initialChoice)
  const [score, setScore] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [error, setError] = useState('')
  const [roast, setRoast] = useState('')
  const [receiptFormat, setReceiptFormat] = useState<ReceiptFormat>('landscape')
  const [notice, setNotice] = useState('')

  const isToday = selected.id === today.id
  const effectiveChoice = lockedChoice ?? (isToday ? status?.choice ?? null : null)
  const effectiveScore = score ?? (isToday ? status?.score ?? null : null) ?? (effectiveChoice ? calculateCouldaScore(selected, effectiveChoice) : 0)
  const title = getCouldaTitle(effectiveScore)
  const finalValue = selected.investment * selected.outcomeMultiplier
  const profit = finalValue - selected.investment
  const maxChartValue = Math.max(...selected.chart.map((point) => point.value))
  const community = status?.community
  const profile = status?.profile
  const activeRoast = roast || (effectiveChoice ? getRoast(selected, effectiveChoice, effectiveScore) : '')

  const shareText = useMemo(() => {
    if (!effectiveChoice) return ''
    return `I just got absolutely COOKED by COULDA.\n\n${formatMoney(selected.investment)} → ${formatMoney(finalValue)} fictional outcome.\nI chose ${effectiveChoice.toUpperCase()}.\nCOULDA score: ${effectiveScore}/100 — ${title}.\n\nWhat&apos;s your COULDA score?`
  }, [effectiveChoice, effectiveScore, finalValue, selected.investment, title])

  function selectChallenge(challenge: DailyChallengeData) {
    setSelected(challenge)
    setError('')
    setRoast('')
    setScore(null)
    setRevealing(false)
    const saved = challenge.id === today.id ? status?.choice ?? initialChoice : null
    setDraftChoice(saved)
    setLockedChoice(saved)
  }

  async function lockDecision() {
    if (!draftChoice || effectiveChoice || submitting) return
    setSubmitting(true)
    setError('')
    try {
      let confirmedChoice = draftChoice
      let confirmedScore = calculateCouldaScore(selected, confirmedChoice)
      if (isToday) {
        const referralCode = new URLSearchParams(window.location.search).get('ref')
        const response = await fetch('/api/daily-challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: selected.id, choice: draftChoice, referralCode }) })
        const result = await response.json() as { choice?: DailyChoice; score?: number; error?: string }
        if (!response.ok || !result.choice) throw new Error(result.error ?? 'Could not lock the decision.')
        confirmedChoice = result.choice
        confirmedScore = result.score ?? confirmedScore
        await mutate()
      }
      setRevealing(true)
      window.setTimeout(() => {
        setLockedChoice(confirmedChoice)
        setDraftChoice(confirmedChoice)
        setScore(confirmedScore)
        setRevealing(false)
        setSubmitting(false)
      }, 1_100)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not lock the decision.')
      setSubmitting(false)
    }
  }

  function replayArchive() {
    if (isToday) return
    setDraftChoice(null)
    setLockedChoice(null)
    setScore(null)
    setRoast('')
    setNotice('')
  }

  async function renderReceipt(format: ReceiptFormat) {
    if (!effectiveChoice) throw new Error('Complete a challenge first.')
    const width = format === 'landscape' ? 1200 : 1080
    const height = format === 'landscape' ? 675 : 1350
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable.')

    context.fillStyle = '#080b09'
    context.fillRect(0, 0, width, height)
    context.strokeStyle = '#70ff62'
    context.lineWidth = 8
    context.strokeRect(24, 24, width - 48, height - 48)
    context.fillStyle = '#70ff62'
    context.font = `900 ${format === 'landscape' ? 42 : 50}px monospace`
    context.fillText('COULDA REGRET RECEIPT', 72, 92)
    context.fillStyle = '#8d978f'
    context.font = `700 ${format === 'landscape' ? 20 : 24}px monospace`
    context.fillText(`RECEIPT #${String(selected.sequence).slice(-6)}  •  FICTIONAL SIMULATION`, 72, 132)

    context.fillStyle = '#f4f7f4'
    context.font = `900 ${format === 'landscape' ? 58 : 66}px sans-serif`
    context.fillText(`YOU ${effectiveChoice === 'buy' ? 'BOUGHT' : 'SKIPPED'} ${selected.ticker}`, 72, format === 'landscape' ? 230 : 300)
    context.fillStyle = '#70ff62'
    context.font = `900 ${format === 'landscape' ? 88 : 104}px sans-serif`
    context.fillText(`${formatMoney(selected.investment)} → ${formatMoney(finalValue)}`, 72, format === 'landscape' ? 335 : 430)
    context.fillStyle = '#f4f7f4'
    context.font = `900 ${format === 'landscape' ? 38 : 48}px monospace`
    context.fillText(`COULDA SCORE: ${effectiveScore}/100`, 72, format === 'landscape' ? 415 : 535)
    context.fillText(`VERDICT: ${title}`, 72, format === 'landscape' ? 465 : 600)

    const roastText = activeRoast.replaceAll('&apos;', "'")
    context.fillStyle = '#8d978f'
    context.font = `700 ${format === 'landscape' ? 22 : 28}px sans-serif`
    const words = roastText.split(' ')
    let line = ''
    let y = format === 'landscape' ? 525 : 700
    for (const word of words) {
      const candidate = `${line}${word} `
      if (context.measureText(candidate).width > width - 144) { context.fillText(line, 72, y); line = `${word} `; y += format === 'landscape' ? 30 : 40 } else line = candidate
    }
    context.fillText(line, 72, y)
    context.fillStyle = '#70ff62'
    context.font = `900 ${format === 'landscape' ? 26 : 34}px monospace`
    context.fillText('COULDA.FUN  •  NOT FINANCIAL ADVICE', 72, height - 66)

    return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not render receipt.')), 'image/png'))
  }

  async function downloadReceipt(format = receiptFormat) {
    try {
      const blob = await renderReceipt(format)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `coulda-receipt-${selected.dateKey}-${format}.png`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice(`${format.toUpperCase()} RECEIPT DOWNLOADED.`)
    } catch { setNotice('RECEIPT FAILED. TRY AGAIN.') }
  }

  async function copyReceipt() {
    try {
      const blob = await renderReceipt(receiptFormat)
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard unavailable')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setNotice('RECEIPT IMAGE COPIED.')
    } catch {
      await downloadReceipt(receiptFormat)
      setNotice('IMAGE CLIPBOARD UNAVAILABLE — DOWNLOADED INSTEAD.')
    }
  }

  function shareOnX(text = shareText) {
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text.replaceAll('&apos;', "'"))}&url=${encodeURIComponent(window.location.origin)}`, '_blank', 'noopener,noreferrer')
  }

  async function challengeFriend() {
    const code = profile?.referralCode
    const url = `${window.location.origin}/?challenge=${encodeURIComponent(selected.id)}${code ? `&ref=${encodeURIComponent(code)}` : ''}#daily`
    const text = `I scored ${effectiveScore} COULDA IQ. I bet you can&apos;t beat me. Take today&apos;s challenge.`.replaceAll('&apos;', "'")
    if (navigator.share) await navigator.share({ title: 'Beat my COULDA score', text, url })
    else { await navigator.clipboard.writeText(`${text} ${url}`); setNotice('CHALLENGE LINK COPIED.') }
  }

  return (
    <section id="daily" className="border-b border-border px-4 py-14 md:px-8 md:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="flex max-w-3xl flex-col gap-3">
            <div className="font-mono text-xs font-black tracking-[0.2em] text-primary">// ONE SHOT. SAME SCENARIO. EVERY DAY.</div>
            <h2 className="text-balance text-4xl font-black leading-[0.9] tracking-[-0.06em] sm:text-5xl md:text-7xl">THE COULDA<br />DAILY CHALLENGE.</h2>
          </div>
          <div className="flex items-center gap-4 border border-border bg-card p-4 font-mono">
            <div><p className="text-[10px] text-muted-foreground">NEXT UTC RESET</p><p className="mt-1 text-xl font-black text-primary"><Countdown /></p></div>
            <CalendarDays className="size-8 text-primary" aria-hidden="true" />
          </div>
        </div>

        <div className="grid min-w-0 overflow-hidden border border-border bg-card lg:grid-cols-[0.68fr_1.32fr]">
          <aside className="flex min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border p-4"><span className="font-mono text-xs font-black text-primary">COULDA TIME MACHINE</span><span className="font-mono text-[10px] text-muted-foreground">UTC</span></div>
            <nav aria-label="Challenge archive" className="flex gap-2 overflow-x-auto p-3 lg:flex-col">
              {[today, ...archive].map((challenge, index) => (
                <button key={challenge.id} type="button" onClick={() => selectChallenge(challenge)} className={cn('flex min-w-52 items-center justify-between border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary lg:min-w-0', selected.id === challenge.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary')}>
                  <span><span className="block font-mono text-[10px] font-bold">{index === 0 ? 'TODAY · OFFICIAL' : `ARCHIVE #${challenge.sequence}`}</span><span className="mt-1 block text-sm font-black">{challenge.ticker} · {formatDate(challenge.dateKey)}</span></span>
                  {index === 0 && status?.choice ? <Check className="size-4" aria-label="Completed" /> : <ArrowLeft className="size-3 rotate-180" aria-hidden="true" />}
                </button>
              ))}
            </nav>
            {profile && (
              <div className="mt-auto border-t border-border p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-black text-primary"><UserRound className="size-4" />YOUR COULDA PROFILE</div>
                <div className="mt-4 grid grid-cols-2 gap-px bg-border">
                  <div className="bg-background p-3"><p className="font-mono text-[9px] text-muted-foreground">COULDA IQ</p><p className="text-3xl font-black">{profile.iq}</p></div>
                  <div className="bg-background p-3"><p className="font-mono text-[9px] text-muted-foreground">STREAK</p><p className="flex items-center gap-1 text-3xl font-black">{profile.currentStreak}<Flame className="size-5 text-primary" /></p></div>
                  <div className="bg-background p-3"><p className="font-mono text-[9px] text-muted-foreground">PLAYED</p><p className="text-xl font-black">{profile.played}</p></div>
                  <div className="bg-background p-3"><p className="font-mono text-[9px] text-muted-foreground">COOKED</p><p className="text-xl font-black">{profile.cooked}</p></div>
                </div>
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">PATTERN: {profile.pattern}<br />BEST STREAK: {profile.bestStreak} · IQ IS ENTERTAINMENT, NOT INVESTMENT SKILL.</p>
              </div>
            )}
          </aside>

          <div className="relative min-h-[650px] min-w-0 overflow-hidden p-5 md:p-8 lg:p-10">
            {revealing && <div className="absolute inset-0 z-20 flex items-center justify-center bg-background" aria-live="polite"><div className="challenge-scan absolute inset-x-0 top-0 h-1/5 bg-primary/20" /><div className="flex flex-col items-center gap-4 text-center"><LockKeyhole className="size-10 text-primary" /><p className="font-mono text-sm font-black tracking-[0.2em] text-primary">DECISION LOCKED.</p><p className="font-mono text-xs text-muted-foreground">LET&apos;S SEE WHAT HAPPENS.</p></div></div>}

            {!effectiveChoice ? (
              <div className="flex h-full flex-col gap-7">
                <div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">{isToday ? 'TODAY\'S OFFICIAL CHALLENGE' : 'HISTORICAL FICTIONAL SIMULATION'}</Badge><span className="font-mono text-[10px] text-muted-foreground">#{selected.sequence}</span></div>
                <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
                  <div><p className="font-mono text-xs font-bold text-primary">YOU FOUND {selected.ticker} AT {formatMoney(selected.startCap)} MARKET CAP.</p><h3 className="mt-3 text-balance text-4xl font-black tracking-[-0.05em] md:text-6xl">{selected.coin}</h3><p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{selected.pitch}</p></div>
                  <Image src="/coulda-avatar.png" alt="Cal, the tired COULDA trader" width={150} height={150} className="size-28 rounded-full border border-primary object-cover md:size-36" />
                </div>
                <dl className="grid grid-cols-2 border-y border-border font-mono text-xs sm:grid-cols-3"><div className="border-r border-border p-4"><dt className="text-muted-foreground">FICTIONAL START MCAP</dt><dd className="mt-2 text-lg font-black">{formatMoney(selected.startCap)}</dd></div><div className="p-4 sm:border-r sm:border-border"><dt className="text-muted-foreground">YOUR STACK</dt><dd className="mt-2 text-lg font-black">{formatMoney(selected.investment)}</dd></div><div className="col-span-2 border-t border-border p-4 sm:col-span-1 sm:border-t-0"><dt className="text-muted-foreground">DECIDE</dt><dd className="mt-2 text-lg font-black text-primary">BUY OR SKIP?</dd></div></dl>
                <div className="border border-border bg-background p-4"><p className="font-mono text-[10px] font-bold text-muted-foreground">SUSPICIOUS SIGNAL</p><p className="mt-2 text-sm font-bold leading-relaxed">“{selected.signal}”</p></div>
                <div className="mt-auto flex flex-col gap-4"><ToggleGroup value={draftChoice ? [draftChoice] : []} onValueChange={(values) => setDraftChoice((values[0] as DailyChoice | undefined) ?? null)} variant="outline" spacing={2} className="grid w-full grid-cols-2" aria-label="Choose buy or skip"><ToggleGroupItem value="buy" className="h-20 text-lg font-black data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"><TrendingUp data-icon="inline-start" />BUY</ToggleGroupItem><ToggleGroupItem value="skip" className="h-20 text-lg font-black data-pressed:border-destructive data-pressed:bg-destructive data-pressed:text-foreground"><SkipForward data-icon="inline-start" />SKIP</ToggleGroupItem></ToggleGroup><Button size="lg" onClick={lockDecision} disabled={!draftChoice || submitting} className="h-14 font-mono font-black"><LockKeyhole data-icon="inline-start" />{submitting ? 'LOCKING...' : 'LOCK IT IN'}</Button>{error && <p role="alert" className="font-mono text-xs text-destructive">{error}</p>}<p className="text-center font-mono text-[10px] leading-relaxed text-muted-foreground">FICTIONAL SIMULATION. NO LIQUIDITY, SLIPPAGE, FEES, SUPPLY CHANGES, OR EXECUTION LIMITS MODELED. NOT FINANCIAL ADVICE.</p></div>
              </div>
            ) : (
              <div className="challenge-reveal flex h-full flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><Badge className="bg-primary text-primary-foreground">OUTCOME REVEALED</Badge><span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><LockKeyhole className="size-3" />YOU CHOSE {effectiveChoice.toUpperCase()}</span></div>
                <div className="grid gap-6 md:grid-cols-[1fr_0.8fr] md:items-end"><div><p className="font-mono text-xs font-bold text-muted-foreground">HYPOTHETICAL OUTCOME</p><p className={cn('mt-2 text-6xl font-black tracking-[-0.08em] md:text-8xl', selected.outcomeMultiplier >= 1 ? 'text-primary' : 'text-destructive')}>{formatMoney(finalValue)}</p><p className="mt-2 text-xl font-black">{formatMoney(selected.investment)} → {formatMoney(finalValue)} · {selected.outcomeMultiplier}X</p></div><div className="border border-primary bg-primary/10 p-5"><p className="font-mono text-[10px] text-muted-foreground">YOUR COULDA SCORE</p><p className="mt-1 text-5xl font-black text-primary">{effectiveScore}<span className="text-xl">/100</span></p><p className="mt-2 font-mono text-xs font-black">{title}</p></div></div>
                <div className="flex h-36 items-end gap-1 border border-border bg-background p-4" aria-label={`Fictional chart ending at ${selected.outcomeMultiplier} times`}>{selected.chart.map((point, index) => <div key={point.tick} className="flex h-full flex-1 items-end"><div className={cn('w-full origin-bottom animate-in slide-in-from-bottom duration-700', selected.outcomeMultiplier >= 1 ? 'bg-primary' : 'bg-destructive')} style={{ height: `${Math.max(5, (point.value / maxChartValue) * 100)}%`, animationDelay: `${index * 45}ms` }} /></div>)}</div>

                <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                  <div className="border border-border bg-background p-4"><p className="font-mono text-[10px] text-muted-foreground">SIMULATED P/L IF BOUGHT</p><p className={cn('mt-2 text-3xl font-black', profit >= 0 ? 'text-primary' : 'text-destructive')}>{profit >= 0 ? '+' : ''}{formatMoney(profit)}</p></div>
                  <div className="border border-border bg-background p-4"><div className="flex items-center justify-between gap-3"><p className="font-mono text-[10px] font-black text-primary">CAL&apos;S VERDICT</p><Button size="sm" variant="outline" onClick={() => setRoast(getRoast(selected, effectiveChoice, effectiveScore))}><Sparkles data-icon="inline-start" />ROAST ME</Button></div><p className="mt-3 text-lg font-black leading-snug">{activeRoast.replaceAll('&apos;', "'")}</p><button type="button" onClick={() => shareOnX(activeRoast)} className="mt-3 font-mono text-[10px] font-black text-muted-foreground hover:text-primary">SHARE YOUR ROAST →</button></div>
                </div>

                {isToday && community && <div className="border border-border p-4"><div className="flex items-center justify-between gap-3"><p className="font-mono text-xs font-black">THE CROWD</p><span className="font-mono text-[10px] text-muted-foreground">{community.total} VERIFIED {community.total === 1 ? 'DECISION' : 'DECISIONS'}</span></div>{community.total ? <><div className="mt-3 flex h-3 overflow-hidden bg-muted"><div className="bg-primary" style={{ width: `${community.buyPercent}%` }} /><div className="bg-destructive" style={{ width: `${community.skipPercent}%` }} /></div><div className="mt-2 flex justify-between font-mono text-[10px]"><span>BUY {community.buyPercent}%</span><span>SKIP {community.skipPercent}%</span></div></> : <p className="mt-3 font-mono text-xs text-muted-foreground">THE CROWD IS STILL DECIDING.</p>}</div>}

                <div className="border border-primary bg-primary/10 p-5" aria-label="COULDA regret receipt preview"><div className="flex items-center justify-between gap-4"><span className="font-mono text-lg font-black">COULDA REGRET RECEIPT</span><span className="font-mono text-[10px]">#{String(selected.sequence).slice(-6)}</span></div><p className="mt-6 font-mono text-xs text-muted-foreground">YOU {effectiveChoice === 'buy' ? 'BOUGHT' : 'SKIPPED'} {selected.ticker}</p><p className="mt-1 text-3xl font-black">{formatMoney(selected.investment)} → {formatMoney(finalValue)}</p><p className="mt-2 font-mono text-xs">SCORE {effectiveScore}/100 · {title}</p><p className="mt-4 font-mono text-[9px] text-muted-foreground">FICTIONAL SIMULATION · COULDA.FUN · NOT FINANCIAL ADVICE</p></div>

                <div className="flex flex-wrap gap-2"><ToggleGroup value={[receiptFormat]} onValueChange={(values) => values[0] && setReceiptFormat(values[0] as ReceiptFormat)} variant="outline" spacing={1} aria-label="Receipt format"><ToggleGroupItem value="landscape">X · 1200×675</ToggleGroupItem><ToggleGroupItem value="portrait">VERTICAL · 1080×1350</ToggleGroupItem></ToggleGroup><Button onClick={() => downloadReceipt()}><Download data-icon="inline-start" />DOWNLOAD</Button><Button variant="outline" onClick={copyReceipt}><Clipboard data-icon="inline-start" />COPY IMAGE</Button><Button variant="outline" onClick={() => shareOnX()}><ExternalLink data-icon="inline-start" />POST TO X</Button><Button variant="outline" onClick={challengeFriend}><Share2 data-icon="inline-start" />CHALLENGE A FRIEND</Button>{!isToday && <Button variant="ghost" onClick={replayArchive}><RotateCcw data-icon="inline-start" />REPLAY</Button>}</div>
                {notice && <p role="status" className="font-mono text-[10px] font-black text-primary">{notice}</p>}
                <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">SCORE FORMULA: 70 BASE POINTS FOR THE PREDETERMINED WINNING CHOICE PLUS UP TO 30 POINTS FOR OUTCOME MAGNITUDE; WRONG CHOICES START AT 30 AND LOSE THE SAME MAGNITUDE BONUS. THIS MEASURES GAME PERFORMANCE ONLY.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
