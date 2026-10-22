import { bigint, boolean, date, integer, numeric, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const couldaPlayers = pgTable('coulda_players', {
  anonymousId: text('anonymous_id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastPlayedDate: date('last_played_date'),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  referralCode: text('referral_code').notNull().unique(),
})

export const couldaDecisions = pgTable('coulda_decisions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  anonymousId: text('anonymous_id').notNull(),
  challengeId: text('challenge_id').notNull(),
  challengeDate: date('challenge_date').notNull(),
  choice: text('choice', { enum: ['buy', 'skip'] }).notNull(),
  winningChoice: text('winning_choice', { enum: ['buy', 'skip'] }).notNull(),
  score: integer('score').notNull(),
  hypotheticalDelta: numeric('hypothetical_delta', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique().on(table.anonymousId, table.challengeId)])

export const couldaReferrals = pgTable('coulda_referrals', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  referralCode: text('referral_code').notNull(),
  visitorAnonymousId: text('visitor_anonymous_id').notNull(),
  challengeId: text('challenge_id').notNull(),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [unique().on(table.referralCode, table.visitorAnonymousId, table.challengeId)])
