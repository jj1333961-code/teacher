import { del } from '@vercel/blob'
import { Pool } from 'pg'

export const runtime = 'nodejs'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await pool.query(
    `SELECT id, pathname FROM uploaded_files
     WHERE deleted_at IS NULL AND expires_at <= now()
     ORDER BY expires_at ASC LIMIT 100`,
  )
  let deleted = 0
  const failed: string[] = []
  for (const file of result.rows) {
    try {
      await del(file.pathname)
      await pool.query('UPDATE uploaded_files SET deleted_at = now(), deletion_error = NULL WHERE id = $1', [file.id])
      deleted++
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown deletion error'
      await pool.query('UPDATE uploaded_files SET deletion_error = $2 WHERE id = $1', [file.id, message])
      failed.push(file.id)
    }
  }
  return Response.json({ checked: result.rowCount, deleted, failed })
}
