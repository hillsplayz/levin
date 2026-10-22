'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, Flame, RefreshCw, Share2, TrendingUp } from 'lucide-react'
import { scenarios } from '@/lib/coulda-data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Choice = 'buy' | 'skip'

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value > 999 ? 0 : 2 }).format(value)
}

export function RegretSimulator() {
  const dailyIndex = useMemo(() => {
    const now = new Date()
    return (now.getUTCFullYear() * 372 + now.getUTCMonth() * 31 + now.getUTCDate()) % scenarios.length
  }, [])
  const [scenarioIndex, setScenarioIndex] = useState(dailyIndex)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [shared, setShared] = useState(false)
  const scenario = scenarios[scenarioIndex]
  const missedValue = scenario.investment * scenario.multiplier
  const boughtValue = scenario.investment * scenario.buyMultiplier
  const regretScore = choice === 'skip' ? Math.min(100, Math.round(48 + scenario.multiplier / 1.5)) : Math.max(12, Math.round(70 - scenario.buyMultiplier * 14))

  function playAgain() {
    setScenarioIndex((current) => (current + 1) % scenarios.length)
    setChoice(null)
    setShared(false)
  }

  async function shareResult() {
    const action = choice === 'skip' ? `skipped ${scenario.ticker} before a fictional ${scenario.multiplier}x` : `bought ${scenario.ticker} and survived the simulation`
    const text = `I ${action}. Regret score: ${regretScore}/100. How cooked are you? #COULDA`
    if (navigator.share) {
      await navigator.share({ title: 'My COULDA result', text, url: window.location.href })
    } else {
      await navigator.clipboard.writeText(`${text} ${window.location.href}`)
      setShared(true)
    }
  }

  return (
    <section id="simulator" className="border-b border-border px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex max-w-3xl flex-col gap-4">
            <div className="font-mono text-xs font-bold tracking-[0.2em] text-primary">// CORE EXPERIENCE</div>
            <h2 className="text-balance text-5xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">THE MISSED-100X<br />SIMULATOR.</h2>
          </div>
          <div className="max-w-xs font-mono text-xs leading-relaxed text-muted-foreground">
            FICTIONAL SCENARIOS.<br />REAL DECISION PARALYSIS.<br /><span className="text-primary">ZERO FINANCIAL ADVICE.</span>
          </div>
        </div>

        <div className="grid overflow-hidden border border-border bg-card lg:grid-cols-[1.45fr_0.75fr]">
          <div className="relative min-h-[430px] border-b border-border p-4 md:p-8 lg:border-b-0 lg:border-r">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="size-2 animate-pulse bg-primary" />
                <span className="font-mono text-xs font-bold text-primary">SIMULATION FEED</span>
              </div>
              <Badge variant="outline">FICTIONAL DATA</Badge>
            </div>
            <div className="h-[310px] w-full" aria-label={`Simulated price chart for ${scenario.coin}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scenario.chart} margin={{ top: 10, right: 8, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c8ff2e" stopOpacity={0.34} />
                      <stop offset="100%" stopColor="#c8ff2e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgb(244 245 239 / 0.15)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="tick" hide />
                  <YAxis tick={{ fill: 'rgb(244 245 239 / 0.58)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#151916', border: '1px solid rgb(244 245 239 / 0.15)', borderRadius: 0, fontFamily: 'var(--font-geist-mono)', fontSize: 11 }} formatter={(value) => [`${value} index`, 'SIM VALUE']} labelFormatter={() => 'FICTIONAL TICK'} />
                  <Area type="stepAfter" dataKey="value" stroke="#c8ff2e" strokeWidth={3} fill="url(#chartFill)" isAnimationActive animationDuration={1400} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute bottom-4 left-4 font-mono text-[10px] text-muted-foreground md:left-8">NOT MARKET DATA · FOR ENTERTAINMENT ONLY</div>
          </div>

          <div className="flex min-h-[430px] flex-col p-5 md:p-8">
            {!choice ? (
              <>
                <div className="flex flex-1 flex-col gap-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">TODAY&apos;S FICTIONAL COIN</p>
                      <h3 className="mt-2 text-3xl font-black tracking-[-0.04em]">{scenario.coin}</h3>
                      <p className="font-mono text-sm font-bold text-primary">{scenario.ticker}</p>
                    </div>
                    <span className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">#{scenarioIndex + 1}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{scenario.pitch}</p>
                  <dl className="grid grid-cols-2 border-y border-border py-4 font-mono text-xs">
                    <div><dt className="text-muted-foreground">STARTING MCAP</dt><dd className="mt-1 font-bold text-foreground">{formatMoney(scenario.startCap)}</dd></div>
                    <div><dt className="text-muted-foreground">YOUR STACK</dt><dd className="mt-1 font-bold text-foreground">{formatMoney(scenario.investment)}</dd></div>
                  </dl>
                  <p className="text-pretty text-lg font-bold">You found it before the timeline did. What do you do?</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-6">
                  <Button size="lg" className="h-12 rounded-none font-mono font-black" onClick={() => setChoice('buy')}>BUY <TrendingUp data-icon="inline-end" /></Button>
                  <Button size="lg" variant="outline" className="h-12 rounded-none font-mono font-black" onClick={() => setChoice('skip')}>SKIP <ArrowRight data-icon="inline-end" /></Button>
                </div>
              </>
            ) : (
              <div className="flex h-full animate-reveal flex-col justify-between gap-8">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-destructive">OUTCOME REVEALED</span>
                    <Flame className="size-6 text-destructive" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{choice === 'skip' ? 'YOU SKIPPED. IT DID' : 'YOU BOUGHT. YOUR POSITION BECAME'}</p>
                    <p className="mt-2 text-7xl font-black tracking-[-0.08em] text-primary">{choice === 'skip' ? `${scenario.multiplier}X` : formatMoney(boughtValue)}</p>
                  </div>
                  <p className="text-pretty text-lg font-bold leading-snug">
                    {choice === 'skip' ? `Your hypothetical ${formatMoney(scenario.investment)} coulda become ${formatMoney(missedValue)}. You were early. You did nothing.` : boughtValue < scenario.investment ? 'Amazing. The one time you bought, it dipped. This is still fictional. The pain is impressively efficient.' : `A fictional win: ${formatMoney(boughtValue)}. Suspicious. Do not get used to this.`}
                  </p>
                  <div className="border border-destructive bg-destructive/10 p-4">
                    <p className="font-mono text-xs text-destructive">HOW COOKED ARE YOU?</p>
                    <div className="mt-2 flex items-end justify-between gap-4"><span className="text-5xl font-black">{regretScore}</span><span className="pb-1 font-mono text-xs text-muted-foreground">/ 100 REGRET</span></div>
                    <div className="mt-3 h-2 bg-muted"><div className="h-full bg-destructive transition-all duration-1000" style={{ width: `${regretScore}%` }} /></div>
                  </div>
                  <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">Hypothetical simulation only. This is not a claim of real profit or a guarantee of future returns.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={shareResult} className="h-11 flex-1 rounded-none font-mono font-black"><Share2 data-icon="inline-start" />{shared ? 'LINK COPIED' : 'SHARE REGRET'}</Button>
                  <Button onClick={playAgain} variant="outline" className="h-11 flex-1 rounded-none font-mono font-black"><RefreshCw data-icon="inline-start" />PLAY AGAIN</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
