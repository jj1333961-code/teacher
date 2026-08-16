import { pool } from '@/lib/db'

function isAdmin(request: Request) {
  return request.headers.get('x-admin-user') === '00000000000' && request.headers.get('x-admin-password') === '1234'
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: 'غير مصرح.' }, { status: 401 })
  const result = await pool.query('SELECT id, user_id, name, email, status, created_at, updated_at FROM join_requests ORDER BY created_at DESC')
  return Response.json({ requests: result.rows })
}

export async function PATCH(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: 'غير مصرح.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!['approved', 'rejected'].includes(body.status) || typeof body.id !== 'string') return Response.json({ error: 'طلب غير صالح.' }, { status: 400 })
  const result = await pool.query('UPDATE join_requests SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status', [body.status, body.id])
  if (!result.rowCount) return Response.json({ error: 'الطلب غير موجود.' }, { status: 404 })
  return Response.json(result.rows[0])
}
