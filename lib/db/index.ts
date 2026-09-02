import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // لا تسمح للشبكة غير المتاحة بتعطيل تحميل الموقع أو إبقاء الطلب معلقًا.
  connectionTimeoutMillis: 2_500,
  query_timeout: 7_000,
  statement_timeout: 7_000,
  idleTimeoutMillis: 10_000,
  max: 5,
})
export const db = drizzle(pool, { schema })
