import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getChallengeCookieName, getDailyChallenge, isDailyChoice } from '@/lib/daily-challenge'

export async function POST(request: Request) {
  const challenge = getDailyChallenge()
  const body = (await request.json().catch(() => null)) as { challengeId?: unknown; choice?: unknown } | null

  if (!body || body.challengeId !== challenge.id || !isDailyChoice(body.choice)) {
    return NextResponse.json({ error: 'That challenge or choice is not valid.' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const cookieName = getChallengeCookieName(challenge.dateKey)
  const existingChoice = cookieStore.get(cookieName)?.value
  const lockedChoice = isDailyChoice(existingChoice) ? existingChoice : body.choice

  if (!isDailyChoice(existingChoice)) {
    cookieStore.set(cookieName, lockedChoice, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 90,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return NextResponse.json({ choice: lockedChoice, mode: 'demo' })
}
