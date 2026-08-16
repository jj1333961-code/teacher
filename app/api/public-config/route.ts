import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    adminWhatsappNumber: process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER?.replace(/\D/g, '') || '',
  })
}
