import { pool } from '@/lib/db'
import { rejectCrossOrigin } from '@/lib/request-security'
import { requireUser } from '@/lib/server-auth'

export const runtime = 'nodejs'

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  try {
    const userId = String(auth.user?.email || '')
    if (!userId) return response({ error: 'هوية المستخدم غير مكتملة' }, 400)
    const result = await pool.query(
      `SELECT id, sender_id AS "senderId", sender_name AS "senderName", sender_role AS "senderRole", recipient_id AS "recipientId", recipient_name AS "recipientName", recipient_role AS "recipientRole", body, created_at AS "createdAt", read_at AS "readAt"
       FROM messages WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at ASC`,
      [userId],
    )
    return response({ messages: result.rows })
  } catch {
    return response({ error: 'تعذر تحميل الرسائل' }, 503)
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  try {
    const body = await request.json()
    const fields = ['recipientId', 'recipientName', 'recipientRole', 'text']
    if (!body || fields.some((key) => typeof body[key] !== 'string' || !body[key].trim())) return response({ error: 'بيانات الرسالة غير مكتملة' }, 400)
    body.senderId = String(auth.user?.email || '')
    body.senderName = String(auth.user?.name || auth.user?.email || '')
    body.senderRole = 'user'
    if (body.text.length > 5000 || body.senderId.length > 160 || body.recipientId.length > 160 || body.senderRole.length > 40 || body.recipientRole.length > 40) return response({ error: 'بيانات الرسالة تتجاوز الحد المسموح' }, 400)
    const result = await pool.query(
      `INSERT INTO messages (sender_id, sender_name, sender_role, recipient_id, recipient_name, recipient_role, body)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, sender_id AS "senderId", sender_name AS "senderName", sender_role AS "senderRole", recipient_id AS "recipientId", recipient_name AS "recipientName", recipient_role AS "recipientRole", body, created_at AS "createdAt"`,
      [body.senderId.trim(), body.senderName.trim(), body.senderRole.trim(), body.recipientId.trim(), body.recipientName.trim(), body.recipientRole.trim(), body.text.trim()],
    )
    return response({ message: result.rows[0], saved: true })
  } catch {
    return response({ error: 'تعذر حفظ الرسالة' }, 503)
  }
}
