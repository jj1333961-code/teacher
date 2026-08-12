import { del } from '@vercel/blob'
import { Pool } from 'pg'

export const runtime = 'nodejs'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const expired = await pool.query(
    'SELECT id, pathname FROM public_attachments WHERE deleted_at IS NULL AND expires_at <= now() ORDER BY expires_at LIMIT 100',
  )
  let deleted = 0
  const failed: string[] = []
  for (const file of expired.rows) {
    try {
      await del(file.pathname)
      await pool.query('UPDATE public_attachments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [file.id])
      deleted += 1
    } catch {
      failed.push(file.id)
    }
  }
  return Response.json({ checked: expired.rowCount, deleted, failed })
}
