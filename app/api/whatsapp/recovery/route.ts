import { NextResponse } from 'next/server'

const required = ['META_WHATSAPP_ACCESS_TOKEN', 'META_WHATSAPP_PHONE_NUMBER_ID', 'META_WHATSAPP_ADMIN_PHONE', 'META_WHATSAPP_TEMPLATE_NAME'] as const

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? '').trim()
    const nationalId = String(body?.nationalId ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const type = String(body?.type ?? '').trim()
    if (!name || !nationalId || !phone || !type) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

    const missing = required.filter((key) => !process.env[key])
    if (missing.length) return NextResponse.json({ error: 'تكامل واتساب غير مكتمل', missing }, { status: 503 })

    const language = process.env.META_WHATSAPP_TEMPLATE_LANGUAGE || 'ar'
    const graphVersion = process.env.META_WHATSAPP_GRAPH_VERSION || 'v23.0'
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${process.env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.META_WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: process.env.META_WHATSAPP_ADMIN_PHONE,
        type: 'template',
        template: {
          name: process.env.META_WHATSAPP_TEMPLATE_NAME,
          language: { code: language },
          components: [{ type: 'body', parameters: [{ type: 'text', text: name }, { type: 'text', text: type }, { type: 'text', text: nationalId }, { type: 'text', text: phone }] }],
        },
      }),
    })
    if (!response.ok) return NextResponse.json({ error: 'تعذر إرسال تنبيه واتساب' }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'تعذر معالجة الطلب' }, { status: 500 })
  }
}
