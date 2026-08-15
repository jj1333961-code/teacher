import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const SNAPSHOT_ID = 'teacher-platform-v1'

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('20') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 11) return `20${digits.slice(1)}`
  return digits
}

function hashCode(phone: string, code: string) {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex')
}

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS phone_verifications (
    id text PRIMARY KEY,
    phone text NOT NULL,
    code_hash text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    approved_at timestamptz
  )`)
  await pool.query('CREATE INDEX IF NOT EXISTS phone_verifications_phone_idx ON phone_verifications (phone, created_at DESC)')
  await pool.query("DELETE FROM phone_verifications WHERE expires_at <= now() AND status = 'pending'")
}

async function getSettings() {
  const result = await pool.query('SELECT data FROM app_snapshots WHERE id = $1', [SNAPSHOT_ID])
  const data = result.rows[0]?.data ?? {}
  const settings = data.portalSettings ?? {}
  return {
    data,
    adminPhone: normalizePhone(settings.adminPhone || '201554542019'),
    expiryMinutes: Math.min(60, Math.max(5, Number(settings.verificationMinutes) || 10)),
  }
}

function validAdmin(data: Record<string, unknown>, mobile: string, password: string) {
  const admins = Array.isArray(data.admins) ? data.admins as Array<{ mobile?: string; password?: string }> : []
  return admins.some((admin) => admin.mobile === mobile && admin.password === password)
}

export async function POST(request: Request) {
  try {
    await ensureTable()
    const body = await request.json()
    const action = String(body.action ?? '')
    const phone = normalizePhone(body.phone)
    if (!phone || phone.length < 10 || phone.length > 15) return json({ error: 'رقم الهاتف غير صالح' }, 400)

    if (action === 'create') {
      const { adminPhone, expiryMinutes } = await getSettings()
      const code = String(randomInt(100000, 1000000))
      const id = randomUUID()
      await pool.query("UPDATE phone_verifications SET status = 'replaced' WHERE phone = $1 AND status = 'pending'", [phone])
      const result = await pool.query(
        "INSERT INTO phone_verifications (id, phone, code_hash, expires_at) VALUES ($1, $2, $3, now() + ($4 * interval '1 minute')) RETURNING expires_at",
        [id, phone, hashCode(phone, code), expiryMinutes],
      )
      return json({ id, phone, code, adminPhone, expiryMinutes, expiresAt: result.rows[0].expires_at })
    }

    if (action === 'status') {
      const result = await pool.query('SELECT status, expires_at FROM phone_verifications WHERE id = $1 AND phone = $2', [body.id, phone])
      const row = result.rows[0]
      if (!row) return json({ status: 'expired' })
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        await pool.query('DELETE FROM phone_verifications WHERE id = $1', [body.id])
        return json({ status: 'expired' })
      }
      return json({ status: row.status, expiresAt: row.expires_at })
    }

    if (action === 'approve') {
      const { data } = await getSettings()
      if (!validAdmin(data, String(body.adminMobile ?? ''), String(body.adminPassword ?? ''))) return json({ error: 'بيانات المسؤول غير صحيحة' }, 403)
      const suppliedHash = hashCode(phone, String(body.code ?? ''))
      const result = await pool.query("SELECT id, code_hash, expires_at FROM phone_verifications WHERE phone = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [phone])
      const row = result.rows[0]
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) return json({ error: 'انتهت صلاحية الكود' }, 410)
      const expected = Buffer.from(row.code_hash, 'hex'); const supplied = Buffer.from(suppliedHash, 'hex')
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return json({ error: 'الكود غير صحيح' }, 400)
      await pool.query("UPDATE phone_verifications SET status = 'approved', approved_at = now() WHERE id = $1", [row.id])
      return json({ approved: true })
    }

    if (action === 'submit') {
      let googleVerified = false
      if (body.googleCredential && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(body.googleCredential))}`, { cache: 'no-store' })
        const token = tokenResponse.ok ? await tokenResponse.json() as { aud?: string } : null
        googleVerified = token?.aud === process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      }
      if (!googleVerified) {
        const verification = await pool.query("SELECT id FROM phone_verifications WHERE id = $1 AND phone = $2 AND status = 'approved' AND expires_at > now()", [body.id, phone])
        if (!verification.rowCount) return json({ error: 'يجب تفعيل رقم الهاتف أولًا' }, 403)
      }
      const name = String(body.name ?? '').trim(); const nationalId = String(body.nationalId ?? '').replace(/\D/g, '')
      const role = body.role === 'parent' ? 'parent' : 'student'; const notes = String(body.notes ?? '').trim().slice(0, 1000)
      if (name.length < 3 || nationalId.length !== 14) return json({ error: 'يرجى مراجعة الاسم والرقم القومي' }, 400)
      const snapshot = await getSettings(); const registration = { id: randomUUID(), name, nationalId, phone, role, notes, method: googleVerified ? 'google' : 'phone', status: 'new', createdAt: new Date().toISOString() }
      const registrations = Array.isArray(snapshot.data.registrationRequests) ? snapshot.data.registrationRequests : []
      const messages = Array.isArray(snapshot.data.messages) ? snapshot.data.messages : []
      snapshot.data.registrationRequests = [registration, ...registrations]
      snapshot.data.messages = [{ id: Date.now(), type: 'registration', from: name, text: `طلب انضمام جديد من ${name} (${phone})`, date: new Date().toISOString(), read: false, registrationId: registration.id }, ...messages]
      await pool.query(`INSERT INTO app_snapshots (id, data, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [SNAPSHOT_ID, JSON.stringify(snapshot.data)])
      await pool.query("UPDATE phone_verifications SET status = 'used' WHERE id = $1", [body.id])
      return json({ submitted: true })
    }

    return json({ error: 'طلب غير صالح' }, 400)
  } catch {
    return json({ error: 'تعذر إكمال العملية حاليًا' }, 500)
  }
}
