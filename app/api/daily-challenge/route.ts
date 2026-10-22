import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, avg, count, desc, eq, sql, sum } from 'drizzle-orm'
import { db } from '@/lib/db'
import { couldaDecisions, couldaPlayers, couldaReferrals } from '@/lib/db/schema'
import { calculateCouldaScore, getCouldaTitle, getDailyChallenge, getWinningChoice, isDailyChoice } from '@/lib/daily-challenge'

const PLAYER_COOKIE = 'coulda_player'
const PLAYER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function daysBetween(left: string, right: string) {
  return Math.round((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000)
}

async function getCommunityStats(challengeId: string) {
  const rows = await db
    .select({ choice: couldaDecisions.choice, total: count() })
    .from(couldaDecisions)
    .where(eq(couldaDecisions.challengeId, challengeId))
    .groupBy(couldaDecisions.choice)

  const buy = Number(rows.find((row) => row.choice === 'buy')?.total ?? 0)
  const skip = Number(rows.find((row) => row.choice === 'skip')?.total ?? 0)
  const total = buy + skip
  return { buy, skip, total, buyPercent: total ? Math.round((buy / total) * 100) : 0, skipPercent: total ? Math.round((skip / total) * 100) : 0 }
}

async function getProfile(anonymousId: string) {
  const [player] = await db.select().from(couldaPlayers).where(eq(couldaPlayers.anonymousId, anonymousId)).limit(1)
  const [summary] = await db
    .select({
      played: count(),
      correct: count(sql`CASE WHEN ${couldaDecisions.choice} = ${couldaDecisions.winningChoice} THEN 1 END`),
      iq: avg(couldaDecisions.score),
      delta: sum(couldaDecisions.hypotheticalDelta),
      buys: count(sql`CASE WHEN ${couldaDecisions.choice} = 'buy' THEN 1 END`),
    })
    .from(couldaDecisions)
    .where(eq(couldaDecisions.anonymousId, anonymousId))

  const played = Number(summary?.played ?? 0)
  const buys = Number(summary?.buys ?? 0)
  const iq = Math.round(Number(summary?.iq ?? 0))
  const correct = Number(summary?.correct ?? 0)
  const achievements = [played >= 1 ? 'FIRST REGRET' : null, player?.currentStreak && player.currentStreak >= 3 ? 'THREE-DAY DAMAGE' : null, correct >= 5 ? 'COIN FLIP ORACLE' : null].filter(Boolean)

  return {
    iq,
    title: getCouldaTitle(iq),
    played,
    correct,
    cooked: played - correct,
    hypotheticalDelta: Number(summary?.delta ?? 0),
    currentStreak: player?.currentStreak ?? 0,
    bestStreak: player?.bestStreak ?? 0,
    pattern: played === 0 ? 'UNCLASSIFIED' : buys / played > 0.65 ? 'CHRONIC BUTTON CLICKER' : buys / played < 0.35 ? 'CONFIRMATION WAITER' : 'BALANCED HESITATOR',
    achievements,
    referralCode: player?.referralCode ?? '',
  }
}

export async function GET() {
  const challenge = getDailyChallenge()
  const cookieStore = await cookies()
  const anonymousId = cookieStore.get(PLAYER_COOKIE)?.value
  const community = await getCommunityStats(challenge.id)
  const profile = anonymousId ? await getProfile(anonymousId) : null
  const [decision] = anonymousId
    ? await db.select().from(couldaDecisions).where(and(eq(couldaDecisions.anonymousId, anonymousId), eq(couldaDecisions.challengeId, challenge.id))).limit(1)
    : []

  return NextResponse.json({ choice: isDailyChoice(decision?.choice) ? decision.choice : null, score: decision?.score ?? null, profile, community })
}

export async function POST(request: Request) {
  const challenge = getDailyChallenge()
  const body = (await request.json().catch(() => null)) as { challengeId?: unknown; choice?: unknown; referralCode?: unknown } | null

  if (!body || body.challengeId !== challenge.id || !isDailyChoice(body.choice)) {
    return NextResponse.json({ error: 'That challenge or choice is not valid.' }, { status: 400 })
  }

  const choice = body.choice
  const cookieStore = await cookies()
  const existingAnonymousId = cookieStore.get(PLAYER_COOKIE)?.value
  const anonymousId = existingAnonymousId && /^[0-9a-f-]{36}$/i.test(existingAnonymousId) ? existingAnonymousId : randomUUID()
  const referralCode = randomUUID().replaceAll('-', '').slice(0, 10)
  const winningChoice = getWinningChoice(challenge)
  const score = calculateCouldaScore(challenge, choice)
  const finalValue = challenge.investment * challenge.outcomeMultiplier
  const hypotheticalDelta = choice === 'buy' ? finalValue - challenge.investment : challenge.investment - finalValue

  try {
    await db.transaction(async (transaction) => {
      await transaction.insert(couldaPlayers).values({ anonymousId, referralCode }).onConflictDoNothing()
      const inserted = await transaction.insert(couldaDecisions).values({
        anonymousId,
        challengeId: challenge.id,
        challengeDate: challenge.dateKey,
        choice: choice,
        winningChoice,
        score,
        hypotheticalDelta: hypotheticalDelta.toFixed(2),
      }).onConflictDoNothing().returning({ id: couldaDecisions.id })

      if (inserted.length) {
        const [player] = await transaction.select().from(couldaPlayers).where(eq(couldaPlayers.anonymousId, anonymousId)).limit(1)
        const gap = player?.lastPlayedDate ? daysBetween(challenge.dateKey, player.lastPlayedDate) : 0
        const nextStreak = !player?.lastPlayedDate ? 1 : gap === 1 ? player.currentStreak + 1 : gap === 0 ? player.currentStreak : 1
        await transaction.update(couldaPlayers).set({ lastPlayedDate: challenge.dateKey, currentStreak: nextStreak, bestStreak: Math.max(player?.bestStreak ?? 0, nextStreak) }).where(eq(couldaPlayers.anonymousId, anonymousId))
      }

      if (typeof body.referralCode === 'string' && /^[0-9a-f]{10}$/i.test(body.referralCode)) {
        await transaction.insert(couldaReferrals).values({ referralCode: body.referralCode, visitorAnonymousId: anonymousId, challengeId: challenge.id, completed: true, completedAt: new Date() }).onConflictDoNothing()
      }
    })

    const [decision] = await db.select().from(couldaDecisions).where(and(eq(couldaDecisions.anonymousId, anonymousId), eq(couldaDecisions.challengeId, challenge.id))).orderBy(desc(couldaDecisions.createdAt)).limit(1)
    const profile = await getProfile(anonymousId)
    const community = await getCommunityStats(challenge.id)

    if (!existingAnonymousId) {
      cookieStore.set(PLAYER_COOKIE, anonymousId, { httpOnly: true, maxAge: PLAYER_COOKIE_MAX_AGE, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    }
    cookieStore.set(`coulda_daily_${challenge.dateKey.replaceAll('-', '_')}`, decision.choice, { httpOnly: true, maxAge: PLAYER_COOKIE_MAX_AGE, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })

    return NextResponse.json({ choice: decision.choice, score: decision.score, title: getCouldaTitle(decision.score), profile, community })
  } catch {
    return NextResponse.json({ error: 'The regret machine is offline. Your decision was not recorded—try again.' }, { status: 503 })
  }
}
