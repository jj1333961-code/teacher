import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'

const DEFAULT_WHATSAPP = '201554542019'

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 120) : ''
}

function normalizeWhatsapp(value: string) {
  return value.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '20')
}

export async function GET() {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ authenticated: false }, { status: 401 })
  const result = await pool.query('SELECT status, name, email FROM join_requests WHERE user_id = $1 LIMIT 1', [session.user.id])
  return Response.json({ authenticated: true, request: result.rows[0] ?? null })
}

export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  if (!session?.user?.id || !session.user.email) return Response.json({ error: 'يجب تسجيل الدخول باستخدام Google أولًا.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const name = normalizeName(body.name)
  if (name.length < 2) return Response.json({ error: 'اكتب الاسم بالكامل.' }, { status: 400 })

  const saved = await pool.query(
    `INSERT INTO join_requests (user_id, name, email, status, updated_at)
     VALUES ($1, $2, $3, 'pending', now())
     ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, updated_at = now()
     RETURNING id, status, name, email, created_at`,
    [session.user.id, name, session.user.email],
  )
  const settings = await pool.query("SELECT whatsapp_number FROM app_settings WHERE id = 'main' LIMIT 1")
  const whatsapp = normalizeWhatsapp(settings.rows[0]?.whatsapp_number || DEFAULT_WHATSAPP)
  const text = ['طلب الانضمام', `الاسم: ${name}`, `البريد: ${session.user.email}`, `رقم الطلب: ${saved.rows[0].id}`, 'الحالة: في انتظار موافقة المسؤول'].join('\n')
  return Response.json({ ...saved.rows[0], whatsappUrl: `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}` })
}
