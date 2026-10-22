import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDatabase = globalThis as unknown as { couldaPool?: Pool }

export const pool = globalForDatabase.couldaPool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== 'production') globalForDatabase.couldaPool = pool

export const db = drizzle(pool, { schema })
