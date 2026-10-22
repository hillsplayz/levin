export type DailyChoice = 'buy' | 'skip'

export type DailyChallenge = {
  id: string
  dateKey: string
  sequence: number
  coin: string
  ticker: string
  pitch: string
  signal: string
  startCap: number
  investment: number
  outcomeMultiplier: number
  chart: { tick: string; value: number }[]
}

const challengeTemplates = [
  {
    id: 'office-chair-finance',
    coin: 'Office Chair Finance',
    ticker: '$SPIN',
    pitch: 'A community-owned swivel economy with absolutely no brakes.',
    signal: 'Three anonymous accounts changed their profile pictures to the same chair.',
    startCap: 18_400,
    investment: 100,
    outcomeMultiplier: 14.6,
    values: [18, 17, 20, 19, 24, 32, 29, 45, 61, 94, 151, 269],
  },
  {
    id: 'expired-coupon',
    coin: 'Expired Coupon',
    ticker: '$SAVE',
    pitch: 'A rewards protocol for discounts you remembered one day too late.',
    signal: 'The roadmap is a receipt with “soon” circled three times.',
    startCap: 42_000,
    investment: 100,
    outcomeMultiplier: 0.38,
    values: [42, 48, 44, 57, 63, 51, 39, 31, 27, 22, 18, 16],
  },
  {
    id: 'pocket-lint-network',
    coin: 'Pocket Lint Network',
    ticker: '$FLUFF',
    pitch: 'Turning forgotten pocket inventory into a permissionless reserve asset.',
    signal: 'A spreadsheet claims lint is “the final scarce commodity.”',
    startCap: 9_800,
    investment: 100,
    outcomeMultiplier: 73,
    values: [10, 9, 12, 11, 16, 15, 24, 41, 88, 174, 356, 715],
  },
  {
    id: 'meeting-that-coulda',
    coin: 'Meeting That Coulda Been An Email',
    ticker: '$SYNC',
    pitch: 'Decentralized calendar avoidance for people currently “circling back.”',
    signal: 'The founder postponed the launch call because it should have been async.',
    startCap: 31_500,
    investment: 100,
    outcomeMultiplier: 4.2,
    values: [32, 30, 35, 33, 40, 52, 49, 61, 79, 91, 118, 132],
  },
  {
    id: 'browser-tab-dao',
    coin: 'Browser Tab DAO',
    ticker: '$LATER',
    pitch: 'Governance for the 47 tabs you promise you will read eventually.',
    signal: 'Token holders voted to defer the vote about deferring the vote.',
    startCap: 12_700,
    investment: 100,
    outcomeMultiplier: 22.4,
    values: [13, 14, 12, 18, 17, 29, 25, 48, 77, 123, 196, 284],
  },
  {
    id: 'soggy-cereal',
    coin: 'Soggy Cereal Labs',
    ticker: '$MILK',
    pitch: 'A high-liquidity breakfast layer that gets worse every minute.',
    signal: 'The whitepaper is just a timer counting down from “crunchy.”',
    startCap: 67_000,
    investment: 100,
    outcomeMultiplier: 0.12,
    values: [67, 71, 65, 58, 49, 41, 35, 27, 21, 16, 11, 8],
  },
  {
    id: 'typing-indicator',
    coin: 'Typing Indicator Protocol',
    ticker: '$DOTS',
    pitch: 'Monetizing the emotional damage of watching three dots disappear.',
    signal: 'The community manager has been typing an announcement for six hours.',
    startCap: 25_600,
    investment: 100,
    outcomeMultiplier: 8.8,
    values: [26, 24, 29, 28, 34, 47, 42, 68, 91, 133, 179, 225],
  },
  {
    id: 'one-percent-battery',
    coin: 'One Percent Battery',
    ticker: '$CHARGE',
    pitch: 'A last-resort energy market powered by pure notification anxiety.',
    signal: 'The contract deployer posted “low power mode is a mindset.”',
    startCap: 15_200,
    investment: 100,
    outcomeMultiplier: 41.5,
    values: [15, 14, 16, 13, 19, 27, 25, 44, 88, 167, 341, 631],
  },
] as const

const DAY_MS = 86_400_000

function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getDailyChallenge(date = new Date()): DailyChallenge {
  const dateKey = dateKeyFromDate(date)
  const sequence = Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / DAY_MS)
  const template = challengeTemplates[((sequence % challengeTemplates.length) + challengeTemplates.length) % challengeTemplates.length]

  return {
    ...template,
    id: `${dateKey}:${template.id}`,
    dateKey,
    sequence,
    chart: template.values.map((value, index) => ({ tick: `T${index + 1}`, value })),
  }
}

export function getChallengeArchive(today = new Date(), days = 7) {
  return Array.from({ length: days }, (_, index) => getDailyChallenge(new Date(today.getTime() - (index + 1) * DAY_MS)))
}

export function getChallengeCookieName(dateKey: string) {
  return `coulda_daily_${dateKey.replaceAll('-', '_')}`
}

export function isDailyChoice(value: unknown): value is DailyChoice {
  return value === 'buy' || value === 'skip'
}

export function getWinningChoice(challenge: DailyChallenge): DailyChoice {
  return challenge.outcomeMultiplier >= 1 ? 'buy' : 'skip'
}

export function calculateCouldaScore(challenge: DailyChallenge, choice: DailyChoice) {
  const correct = choice === getWinningChoice(challenge)
  const magnitude = challenge.outcomeMultiplier >= 1
    ? Math.min(30, Math.round(Math.log2(challenge.outcomeMultiplier) * 6))
    : Math.min(30, Math.round((1 - challenge.outcomeMultiplier) * 30))

  return correct ? 70 + magnitude : 30 - magnitude
}

export function getCouldaTitle(score: number) {
  if (score >= 95) return 'CEO OF COULDA'
  if (score >= 80) return 'REGRET MAXXER'
  if (score >= 60) return 'CERTIFIED COOKED'
  if (score >= 40) return 'SERIAL HESITATOR'
  if (score >= 20) return 'PAPER HANDS'
  return 'PROFESSIONAL NPC'
}
