import { del, put } from '@vercel/blob'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'

export const runtime = 'nodejs'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const MAX_FILE_SIZE = 25 * 1024 * 1024

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, filename, content_type AS "contentType", size_bytes AS "size", uploaded_at AS "uploadedAt", expires_at AS "expiresAt"
       FROM public_attachments WHERE deleted_at IS NULL AND expires_at > now() ORDER BY uploaded_at DESC`,
    )
    return reply({ files: result.rows })
  } catch {
    return reply({ error: 'تعذر تحميل قائمة المرفقات' }, 500)
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return reply({ error: 'لم يتم اختيار ملف' }, 400)
    if (!file.size || file.size > MAX_FILE_SIZE) return reply({ error: 'حجم الملف يجب ألا يتجاوز 25 ميجابايت' }, 413)
    const safeName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120) || 'file'
    const id = randomUUID()
    const pathname = `public-attachments/${id}/${safeName}`
    const blob = await put(pathname, file, { access: 'private', addRandomSuffix: false })
    const result = await pool.query(
      `INSERT INTO public_attachments (id, pathname, filename, content_type, size_bytes, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + interval '7 days')
       RETURNING id, filename, content_type AS "contentType", size_bytes AS "size", uploaded_at AS "uploadedAt", expires_at AS "expiresAt"`,
      [id, blob.pathname, safeName, file.type || 'application/octet-stream', file.size],
    )
    return reply({ file: result.rows[0] }, 201)
  } catch {
    return reply({ error: 'تعذر رفع الملف إلى التخزين' }, 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return reply({ error: 'معرّف الملف مطلوب' }, 400)
    const result = await pool.query('SELECT pathname FROM public_attachments WHERE id = $1 AND deleted_at IS NULL', [id])
    if (!result.rows[0]) return reply({ error: 'الملف غير موجود' }, 404)
    await del(result.rows[0].pathname)
    await pool.query('UPDATE public_attachments SET deleted_at = now() WHERE id = $1', [id])
    return reply({ deleted: true })
  } catch {
    return reply({ error: 'تعذر حذف الملف' }, 500)
  }
}
