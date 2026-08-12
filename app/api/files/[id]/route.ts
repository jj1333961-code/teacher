import { del } from '@vercel/blob'
import { Pool } from 'pg'

export const runtime = 'nodejs'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const result = await pool.query('SELECT pathname FROM file_attachments WHERE id = $1 AND deleted_at IS NULL', [id])
  if (!result.rows[0]) return Response.json({ error: 'الملف غير موجود' }, { status: 404 })
  await del(result.rows[0].pathname)
  await pool.query('UPDATE file_attachments SET deleted_at = now() WHERE id = $1', [id])
  return Response.json({ deleted: true })
}
