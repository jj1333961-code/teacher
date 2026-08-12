import { del, get, put } from '@vercel/blob'
import { Pool } from 'pg'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const MAX_FILE_SIZE = 25 * 1024 * 1024

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return reply({ error: 'لم يصل ملف صالح' }, 400)
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return reply({ error: 'حجم الملف غير مسموح (الحد 25MB)' }, 413)
    const id = crypto.randomUUID()
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(-120) || 'file'
    const pathname = `teacher-uploads/${id}/${safeName}`
    const blob = await put(pathname, file, { access: 'private', addRandomSuffix: false })
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    try {
      await pool.query(
        `INSERT INTO uploaded_files (id, original_name, pathname, content_type, size_bytes, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, file.name, blob.pathname, file.type || 'application/octet-stream', file.size, expiresAt],
      )
    } catch (error) {
      await del(blob.url).catch(() => undefined)
      throw error
    }
    return reply({ id, name: file.name, pathname: blob.pathname, size: file.size, type: file.type, uploadedAt: new Date().toISOString(), expiresAt: expiresAt.toISOString(), data: `/api/files?id=${encodeURIComponent(id)}` })
  } catch {
    return reply({ error: 'تعذر رفع الملف' }, 500)
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return reply({ error: 'معرّف الملف مطلوب' }, 400)
  const result = await pool.query('SELECT pathname, content_type, original_name FROM uploaded_files WHERE id = $1 AND deleted_at IS NULL AND expires_at > now()', [id])
  const file = result.rows[0]
  if (!file) return reply({ error: 'الملف غير موجود أو انتهت صلاحيته' }, 404)
  const blob = await get(file.pathname, { access: 'private', ifNoneMatch: request.headers.get('if-none-match') || undefined })
  if (!blob) return reply({ error: 'الملف غير موجود' }, 404)
  if (blob.statusCode === 304) return new Response(null, { status: 304, headers: { ETag: blob.blob.etag, 'Cache-Control': 'private, no-cache' } })
  return new Response(blob.stream, { headers: { 'Content-Type': file.content_type, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`, ETag: blob.blob.etag, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' } })
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return reply({ error: 'معرّف الملف مطلوب' }, 400)
    const result = await pool.query('SELECT pathname FROM uploaded_files WHERE id = $1 AND deleted_at IS NULL', [id])
    if (!result.rows[0]) return reply({ deleted: true })
    await del(result.rows[0].pathname)
    await pool.query('UPDATE uploaded_files SET deleted_at = now(), deletion_error = NULL WHERE id = $1', [id])
    return reply({ deleted: true })
  } catch {
    return reply({ error: 'تعذر حذف الملف' }, 500)
  }
}
