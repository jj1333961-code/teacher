import { pool } from '@/lib/db'
import { guardRequest, readJsonBody, RequestBodyError } from '@/lib/request-guards'

export const runtime = 'nodejs'
const MAX_MESSAGE_REQUEST_BYTES = 64_000
const MESSAGE_ROLES = new Set(['admin', 'student', 'parent'])

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } })
}

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g, '').trim().slice(0, maxLength)
    : ''
}

function bodyError(error: unknown) {
  return error instanceof RequestBodyError
    ? response({ error: error.message, code: error.code }, error.status)
    : null
}

export async function GET(request: Request) {
  const guard = guardRequest(request, { maxBytes: MAX_MESSAGE_REQUEST_BYTES })
  if (guard) return guard

  try {
    const url = new URL(request.url)
    const userId = clean(url.searchParams.get('userId'), 120)
    const role = clean(url.searchParams.get('role'), 20)
    if (!userId || !MESSAGE_ROLES.has(role)) return response({ error: 'بيانات المستلم غير مكتملة' }, 400)
    const result = await pool.query(
      `SELECT id, sender_id AS "senderId", sender_name AS "senderName", sender_role AS "senderRole", recipient_id AS "recipientId", recipient_name AS "recipientName", recipient_role AS "recipientRole", body, created_at AS "createdAt", read_at AS "readAt"
       FROM messages
       WHERE (sender_id = $1 AND sender_role = $2) OR (recipient_id = $1 AND recipient_role = $2)
       ORDER BY created_at ASC
       LIMIT 500`,
      [userId, role],
    )
    return response({ messages: result.rows })
  } catch {
    return response({ messages: [], unavailable: true })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const fields = ['senderId', 'senderName', 'senderRole', 'recipientId', 'recipientName', 'recipientRole', 'text']
    if (!body || fields.some((key) => typeof body[key] !== 'string' || !body[key].trim())) return response({ error: 'بيانات الرسالة غير مكتملة' }, 400)
    if (body.text.length > 5000) return response({ error: 'الرسالة طويلة جدًا' }, 400)
    const result = await pool.query(
      `INSERT INTO messages (sender_id, sender_name, sender_role, recipient_id, recipient_name, recipient_role, body)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, sender_id AS "senderId", sender_name AS "senderName", sender_role AS "senderRole", recipient_id AS "recipientId", recipient_name AS "recipientName", recipient_role AS "recipientRole", body, created_at AS "createdAt"`,
      [body.senderId.trim(), body.senderName.trim(), body.senderRole.trim(), body.recipientId.trim(), body.recipientName.trim(), body.recipientRole.trim(), body.text.trim()],
    )
    return response({ message: result.rows[0], saved: true })
  } catch {
    return response({ saved: false, unavailable: true }, 200)
  }
}
