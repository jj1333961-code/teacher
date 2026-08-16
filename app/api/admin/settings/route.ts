import { pool } from '@/lib/db'

const DEFAULT_WHATSAPP = '201554542019'

function isAdmin(request: Request) {
  return request.headers.get('x-admin-user') === '00000000000' && request.headers.get('x-admin-password') === '1234'
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: 'غير مصرح.' }, { status: 401 })
  const result = await pool.query("SELECT whatsapp_number FROM app_settings WHERE id = 'main' LIMIT 1")
  return Response.json({ whatsappNumber: result.rows[0]?.whatsapp_number || DEFAULT_WHATSAPP })
}

export async function PUT(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: 'غير مصرح.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const whatsappNumber = String(body.whatsappNumber || '').replace(/\D/g, '').replace(/^00/, '')
  if (whatsappNumber.length < 10 || whatsappNumber.length > 15) return Response.json({ error: 'أدخل رقم واتساب صحيحًا بصيغة الدولة.' }, { status: 400 })
  await pool.query("INSERT INTO app_settings (id, whatsapp_number, updated_at) VALUES ('main', $1, now()) ON CONFLICT (id) DO UPDATE SET whatsapp_number = EXCLUDED.whatsapp_number, updated_at = now()", [whatsappNumber])
  return Response.json({ whatsappNumber })
}
