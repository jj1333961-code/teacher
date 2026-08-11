import { Pool } from "pg"

const globalForNeon = globalThis as unknown as { neonPool?: Pool }

export function getNeonPool() {
  const connectionString = process.env.NEON_DATABASE_URL
  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL is not configured")
  }

  if (!globalForNeon.neonPool) {
    globalForNeon.neonPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }

  return globalForNeon.neonPool
}
