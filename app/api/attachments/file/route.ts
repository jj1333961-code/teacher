import { get } from '@vercel/blob'
import { Pool } from 'pg'

export const runtime = 'nodejs'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return new Response('Missing id', { status: 400 })
    const row = await pool.query(
      'SELECT pathname, filename FROM public_attachments WHERE id = $1 AND deleted_at IS NULL AND expires_at > now()',
      [id],
    )
    if (!row.rows[0]) return new Response('Not found', { status: 404 })
    const result = await get(row.rows[0].pathname, { access: 'private', ifNoneMatch: request.headers.get('if-none-match') || undefined })
    if (!result) return new Response('Not found', { status: 404 })
    if (result.statusCode === 304) return new Response(null, { status: 304, headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } })
    const download = new URL(request.url).searchParams.get('download') === '1'
    return new Response(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || 'application/octet-stream',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(row.rows[0].filename)}`,
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Failed to read file', { status: 500 })
  }
}
