import { put } from '@vercel/blob'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const MAX_FILE_SIZE = 25 * 1024 * 1024
const SNAPSHOT_ID = 'teacher-platform-v1'
const ALLOWED_TYPES = /^(image|audio|video)\//
const ALLOWED_DOCUMENTS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: 'لم يتم اختيار ملف' }, { status: 400 })
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return Response.json({ error: 'حجم الملف يجب ألا يتجاوز 25 ميجابايت' }, { status: 413 })
    const contentType = file.type || 'application/octet-stream'
    if (!ALLOWED_TYPES.test(contentType) && !ALLOWED_DOCUMENTS.has(contentType)) {
      return Response.json({ error: 'نوع الملف غير مسموح' }, { status: 415 })
    }

    const id = randomUUID()
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(-120) || 'file'
    const pathname = `teacher-files/${id}/${safeName}`
    const blob = await put(pathname, file, { access: 'private', addRandomSuffix: false })
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await pool.query(
      `INSERT INTO file_attachments (id, snapshot_id, pathname, filename, content_type, size_bytes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, SNAPSHOT_ID, blob.pathname, file.name, contentType, file.size, expiresAt],
    )
    return Response.json({ id, pathname: blob.pathname, name: file.name, type: contentType, size: file.size, uploadedAt: new Date().toISOString(), expiresAt: expiresAt.toISOString() })
  } catch {
    return Response.json({ error: 'تعذر رفع الملف' }, { status: 500 })
  }
}
