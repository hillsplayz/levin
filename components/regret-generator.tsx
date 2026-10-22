'use client'

import { useRef, useState } from 'react'
import { Download, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type CardData = { coin: string; marketCap: number; multiplier: number; caption: string }

const initialCard: CardData = { coin: 'Left Sock', marketCap: 16000, multiplier: 61, caption: 'I was waiting for a better entry.' }

function formatWholeNumber(value: number) {
  return Math.trunc(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function RegretGenerator() {
  const [card, setCard] = useState(initialCard)
  const [draft, setDraft] = useState(initialCard)
  const [error, setError] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const hypothetical = 100 * card.multiplier

  function generate(event: React.FormEvent) {
    event.preventDefault()
    const coin = draft.coin.trim()
    if (coin.length < 2 || coin.length > 24) return setError('Coin name must be 2–24 characters.')
    if (!Number.isFinite(draft.marketCap) || draft.marketCap < 100 || draft.marketCap > 1_000_000_000) return setError('Market cap must be between $100 and $1B.')
    if (!Number.isFinite(draft.multiplier) || draft.multiplier < 2 || draft.multiplier > 1000) return setError('Multiplier must be between 2x and 1,000x.')
    if (draft.caption.length > 90) return setError('Caption must be 90 characters or fewer.')
    setError('')
    setCard({ ...draft, coin })
  }

  function downloadCard() {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 675
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#090b0a'
    ctx.fillRect(0, 0, 1200, 675)
    ctx.strokeStyle = '#272b28'
    ctx.lineWidth = 2
    for (let x = 0; x <= 1200; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 675); ctx.stroke() }
    for (let y = 0; y <= 675; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke() }
    ctx.fillStyle = '#c8ff2e'
    ctx.font = '900 42px monospace'
    ctx.fillText('COULDA.', 70, 88)
    ctx.fillStyle = '#f4f5ef'
    ctx.font = '900 78px sans-serif'
    ctx.fillText(`I SKIPPED ${card.coin.toUpperCase()}.`, 70, 220)
    ctx.fillStyle = '#c8ff2e'
    ctx.font = '900 136px sans-serif'
    ctx.fillText(`${card.multiplier}X LATER.`, 70, 370)
    ctx.fillStyle = '#f4f5ef'
    ctx.font = '700 32px monospace'
    ctx.fillText(`$100 → hypothetical $${formatWholeNumber(hypothetical)}`, 70, 455)
    ctx.fillStyle = '#929991'
    ctx.font = '24px sans-serif'
    ctx.fillText(`“${card.caption || 'You saw it. You hesitated.'}”`, 70, 525)
    ctx.font = '700 22px monospace'
    ctx.fillText('COULDA.FUN · FICTIONAL SCENARIO · HOW COOKED ARE YOU?', 70, 610)
    const link = document.createElement('a')
    link.download = `coulda-${card.coin.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <section id="generator" className="border-b border-border px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="font-mono text-xs font-bold tracking-[0.2em] text-primary">// REGRET GENERATOR</div>
            <h2 className="text-balance text-5xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">MAKE IT<br />OFFICIAL.</h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">Turn your finest non-decision into a downloadable artifact. Calculations are hypothetical; emotional damage may vary.</p>
          </div>
          <form onSubmit={generate} noValidate>
            <FieldGroup>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="coin">Coin name</FieldLabel>
                <Input id="coin" value={draft.coin} maxLength={24} aria-invalid={!!error} onChange={(event) => setDraft({ ...draft, coin: event.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="market-cap">Entry market cap</FieldLabel>
                  <Input id="market-cap" type="number" min={100} max={1_000_000_000} value={draft.marketCap} onChange={(event) => setDraft({ ...draft, marketCap: Number(event.target.value) })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="multiplier">Missed multiplier</FieldLabel>
                  <Input id="multiplier" type="number" min={2} max={1000} value={draft.multiplier} onChange={(event) => setDraft({ ...draft, multiplier: Number(event.target.value) })} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="caption">Your excuse</FieldLabel>
                <Textarea id="caption" maxLength={90} value={draft.caption} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} />
                <FieldDescription>Optional. Keep it painfully short.</FieldDescription>
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" size="lg" className="h-12 rounded-none font-mono font-black"><WandSparkles data-icon="inline-start" />GENERATE CARD</Button>
            </FieldGroup>
          </form>
        </div>

        <div className="flex flex-col gap-4">
          <div ref={previewRef} className="relative aspect-[16/9] overflow-hidden border border-border bg-card p-6 terminal-grid md:p-10">
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between gap-4 font-mono text-xs font-black"><span className="text-primary">COULDA.</span><span className="text-muted-foreground">REGRET RECEIPT #404</span></div>
              <div className="flex flex-col gap-2">
                <p className="text-balance text-2xl font-black leading-none tracking-[-0.05em] md:text-5xl">I SKIPPED {card.coin.toUpperCase()}.</p>
                <p className="text-5xl font-black leading-none tracking-[-0.07em] text-primary md:text-8xl">{card.multiplier}X LATER.</p>
                <p className="font-mono text-xs font-bold md:text-base">$100 → HYPOTHETICAL ${formatWholeNumber(hypothetical)}</p>
              </div>
              <div className="flex items-end justify-between gap-5">
                <p className="max-w-md text-sm italic text-muted-foreground md:text-base">“{card.caption || 'You saw it. You hesitated.'}”</p>
                <p className="shrink-0 font-mono text-[9px] text-muted-foreground md:text-xs">COULDA.FUN</p>
              </div>
            </div>
          </div>
          <Button onClick={downloadCard} variant="outline" className="h-11 self-end rounded-none font-mono font-black"><Download data-icon="inline-start" />DOWNLOAD PNG</Button>
          <p className="font-mono text-[10px] text-muted-foreground">FICTIONAL, HYPOTHETICAL OUTPUT. NOT A RETURN PROMISE.</p>
        </div>
      </div>
    </section>
  )
}
