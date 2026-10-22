'use client'

import { useState } from 'react'
import { Send, Share2 } from 'lucide-react'
import { archiveStories } from '@/lib/coulda-data'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Story = (typeof archiveStories)[number]

export function RegretArchive() {
  const [stories, setStories] = useState<Story[]>(archiveStories)
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [message, setMessage] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (title.trim().length < 3 || story.trim().length < 12) {
      setMessage('Give us a title and at least 12 characters of regret.')
      return
    }
    setStories([{ title: title.trim(), story: story.trim(), opportunity: 'Community demo submission', rating: 87 }, ...stories])
    setTitle('')
    setStory('')
    setMessage('Added to this demo session. Database publishing requires moderation setup.')
  }

  async function share(item: Story) {
    const text = `${item.title}: ${item.story} ${item.opportunity} #COULDA`
    if (navigator.share) await navigator.share({ title: item.title, text, url: window.location.href })
    else { await navigator.clipboard.writeText(`${text} ${window.location.href}`); setMessage('Story copied to clipboard.') }
  }

  return (
    <section id="archive" className="border-b border-border bg-card px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <div className="grid gap-8 md:grid-cols-[1fr_0.7fr] md:items-end">
          <div className="flex flex-col gap-4">
            <div className="font-mono text-xs font-bold tracking-[0.2em] text-destructive">// PUBLIC RECORD OF BAD DECISIONS</div>
            <h2 className="text-balance text-5xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">THE REGRET<br />ARCHIVE.</h2>
          </div>
          <p className="max-w-lg text-pretty leading-relaxed text-muted-foreground">Original fictional stories from the timeline where everybody had conviction except you. No fake community counts. No fake live feed.</p>
        </div>

        <div className="grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {stories.map((item, index) => (
            <article key={`${item.title}-${index}`} className="flex min-h-72 flex-col justify-between gap-8 bg-background p-6 transition-colors hover:bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <span className="font-mono text-[10px] text-muted-foreground">CASE_{String(index + 1).padStart(3, '0')}</span>
                <span className="font-mono text-xs font-black text-destructive">COOKED {item.rating}/100</span>
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-2xl font-black tracking-[-0.04em]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.story}</p>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <span className="font-mono text-[10px] font-bold text-primary">{item.opportunity}</span>
                <button onClick={() => share(item)} className="flex size-9 items-center justify-center border border-border transition-colors hover:border-primary hover:text-primary" aria-label={`Share ${item.title}`}><Share2 className="size-4" aria-hidden="true" /></button>
              </div>
            </article>
          ))}
        </div>

        <div className="grid border border-border lg:grid-cols-[0.7fr_1.3fr]">
          <div className="border-b border-border p-6 md:p-8 lg:border-b-0 lg:border-r">
            <p className="font-mono text-xs font-bold text-primary">SUBMIT YOUR L</p>
            <h3 className="mt-3 text-3xl font-black tracking-[-0.04em]">Make the archive worse.</h3>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Demo submissions live only in your current session. A production database and moderation queue are intentionally not faked.</p>
          </div>
          <form onSubmit={submit} className="p-6 md:p-8" noValidate>
            <FieldGroup>
              <Field data-invalid={message.startsWith('Give')}>
                <FieldLabel htmlFor="story-title">Short title</FieldLabel>
                <Input id="story-title" maxLength={44} value={title} aria-invalid={message.startsWith('Give')} onChange={(event) => setTitle(event.target.value)} placeholder="The dip that never came" />
              </Field>
              <Field data-invalid={message.startsWith('Give')}>
                <FieldLabel htmlFor="story-body">The painful version</FieldLabel>
                <Textarea id="story-body" maxLength={220} value={story} aria-invalid={message.startsWith('Give')} onChange={(event) => setStory(event.target.value)} placeholder="I found it at..." />
                <FieldDescription>Keep it anonymous and fictionalized. 220 characters max.</FieldDescription>
              </Field>
              {message && (message.startsWith('Give') ? <FieldError>{message}</FieldError> : <p role="status" className="font-mono text-xs text-primary">{message}</p>)}
              <Button type="submit" className="h-11 self-start rounded-none font-mono font-black"><Send data-icon="inline-start" />ADD TO DEMO</Button>
            </FieldGroup>
          </form>
        </div>
      </div>
    </section>
  )
}
