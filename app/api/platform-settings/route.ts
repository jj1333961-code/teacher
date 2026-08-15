import { NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT admin_whatsapp AS "adminWhatsapp" FROM platform_settings WHERE id = 1`,
    )
    return NextResponse.json({ adminWhatsapp: rows[0]?.adminWhatsapp ?? "+201554542019" })
  } catch {
    return NextResponse.json({ adminWhatsapp: "+201554542019" })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const adminWhatsapp = String(body.adminWhatsapp ?? "").trim()
    if (!/^\+?\d{10,15}$/.test(adminWhatsapp)) {
      return NextResponse.json({ error: "رقم واتساب غير صحيح" }, { status: 400 })
    }
    await pool.query(
      `INSERT INTO platform_settings (id, admin_whatsapp, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET admin_whatsapp = EXCLUDED.admin_whatsapp, updated_at = now()`,
      [adminWhatsapp],
    )
    return NextResponse.json({ adminWhatsapp })
  } catch {
    return NextResponse.json({ error: "تعذر حفظ رقم المسؤول" }, { status: 500 })
  }
}
