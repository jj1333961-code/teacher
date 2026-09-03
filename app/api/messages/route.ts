import { pool } from '@/lib/db'
import { rejectCrossOrigin } from '@/lib/request-security'

export const runtime = 'nodejs'

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const role = url.searchParams.get('role')
    if (!userId || !role || userId.length > 160 || role.length > 40) return response({ error: 'بيانات المستلم غير مكتملة' }, 400)
    const result = await pool.query(
      `SELECT id, sender_id AS "senderId", sender_name AS "senderName", sender_role AS "senderRole", recipient_id AS "recipientId", recipient_name AS "recipientName", recipient_role AS "recipientRole", body, created_at AS "createdAt", read_at AS "readAt"
       FROM messages WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at ASC`,
      [userId],
    )
    return response({ messages: result.rows })
  } catch {
    return response({ messages: [], unavailable: true })
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError
  try {
    const body = await request.json()
    const fields = ['senderId', 'senderName', 'senderRole', 'recipientId', 'recipientName', 'recipientRole', 'text']
    if (!body || fields.some((key) => typeof body[key] !== 'string' || !body[key].trim())) return response({ error: 'بيانات الرسالة غير مكتملة' }, 400)
    if (body.text.length > 5000 || body.senderId.length > 160 || body.recipientId.length > 160 || body.senderRole.length > 40 || body.recipientRole.length > 40) return response({ error: 'بيانات الرسالة تتجاوز الحد المسموح' }, 400)
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
