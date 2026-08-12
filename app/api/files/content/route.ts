import { get } from '@vercel/blob'
import { Pool } from 'pg'

export const runtime = 'nodejs'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return new Response('Missing id', { status: 400 })
  const result = await pool.query(
    'SELECT pathname, filename, content_type FROM file_attachments WHERE id = $1 AND deleted_at IS NULL AND expires_at > now()',
    [id],
  )
  const file = result.rows[0]
  if (!file) return new Response('Not found', { status: 404 })
  const blob = await get(file.pathname, { access: 'private' })
  if (!blob || blob.statusCode !== 200) return new Response('Not found', { status: 404 })
  return new Response(blob.stream, {
    headers: {
      'Content-Type': file.content_type,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      ETag: blob.blob.etag,
      'Cache-Control': 'private, no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
