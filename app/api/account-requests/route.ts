import { NextResponse } from "next/server"
import { pool } from "@/lib/db"

const clean = (value: unknown, max = 500) =>
  String(value ?? "").trim().slice(0, max)

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT id, role, full_name AS "fullName", national_id AS "nationalId",
        phone, juz, surah, notes, verification_method AS "verificationMethod",
        verification_status AS "verificationStatus", status, is_read AS "isRead",
        created_at AS "createdAt"
       FROM account_requests ORDER BY created_at DESC LIMIT 100`,
    )
    return NextResponse.json({ requests: rows })
  } catch {
    return NextResponse.json({ error: "تعذر تحميل الطلبات" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const role = clean(body.role, 20)
    const fullName = clean(body.fullName, 120)
    const nationalId = clean(body.nationalId, 14)
    const phone = clean(body.phone, 20)
    const juz = clean(body.juz, 20)
    const surah = clean(body.surah, 100)
    const notes = clean(body.notes, 1000)
    const verificationMethod = clean(body.verificationMethod, 20)

    if (!['student', 'parent'].includes(role)) {
      return NextResponse.json({ error: "نوع الحساب غير صحيح" }, { status: 400 })
    }
    if (!fullName || !/^\d{14}$/.test(nationalId) || !/^\+?\d{10,15}$/.test(phone) || !juz || !surah) {
      return NextResponse.json({ error: "يرجى إدخال جميع البيانات بشكل صحيح" }, { status: 400 })
    }
    if (!['google', 'whatsapp'].includes(verificationMethod)) {
      return NextResponse.json({ error: "اختر طريقة التحقق" }, { status: 400 })
    }

    const { rows } = await pool.query(
      `INSERT INTO account_requests
        (role, full_name, national_id, phone, juz, surah, notes, verification_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, created_at AS "createdAt"`,
      [role, fullName, nationalId, phone, juz, surah, notes, verificationMethod],
    )
    return NextResponse.json({ request: rows[0] }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "تعذر إرسال الطلب" }, { status: 500 })
  }
}
