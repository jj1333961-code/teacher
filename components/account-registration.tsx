'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, MessageCircle, UserRound } from 'lucide-react'

export type JoinRequest = {
  id: string
  name: string
  phone: string
  countryCode: string
  verificationCode: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export const JOIN_REQUESTS_KEY = 'teacher.join-requests.v1'

const countries = [
  { code: '+20', label: 'مصر (+20)' },
  { code: '+966', label: 'السعودية (+966)' },
  { code: '+971', label: 'الإمارات (+971)' },
  { code: '+965', label: 'الكويت (+965)' },
  { code: '+974', label: 'قطر (+974)' },
  { code: '+962', label: 'الأردن (+962)' },
  { code: '+212', label: 'المغرب (+212)' },
  { code: '+213', label: 'الجزائر (+213)' },
]

function GoogleMark() {
  return <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full border border-border font-mono text-xs font-bold text-primary">G</span>
}

export function AccountRegistration({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<'choice' | 'whatsapp'>('choice')
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('+20')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function submitWhatsapp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanPhone = phone.replace(/\D/g, '').replace(/^0+/, '')
    if (name.trim().length < 2 || cleanPhone.length < 7) {
      setError('يرجى كتابة الاسم ورقم واتساب صحيح.')
      return
    }

    const request: JoinRequest = {
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: cleanPhone,
      countryCode,
      verificationCode: String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const current = JSON.parse(localStorage.getItem(JOIN_REQUESTS_KEY) || '[]') as JoinRequest[]
    localStorage.setItem(JOIN_REQUESTS_KEY, JSON.stringify([request, ...current]))
    window.dispatchEvent(new Event('join-requests-changed'))

    const adminPhone = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER?.replace(/\D/g, '')
    const message = `طلب إنشاء حساب جديد\nاسم المستخدم: ${request.name}\nرقم الهاتف: ${countryCode}${cleanPhone}\nكود التحقق: ${request.verificationCode}`
    setSaved(true)
    if (adminPhone) window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    else setError('تم حفظ الطلب، لكن رقم واتساب المسؤول غير مضبوط.')
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4" role="dialog" aria-modal="true" aria-labelledby="registration-title">
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
      <button onClick={onClose} className="mb-5 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowRight size={16}/> العودة</button>
      <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><UserRound size={22}/></span><div><h2 id="registration-title" className="text-2xl font-bold">إنشاء حساب جديد</h2><p className="text-sm text-muted-foreground">اختر طريقة الانضمام المناسبة</p></div></div>

      {method === 'choice' ? <div className="mt-6 flex flex-col gap-3">
        <a href="/api/auth/google" className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-semibold transition hover:border-primary"><GoogleMark/> المتابعة باستخدام Google</a>
        <button onClick={() => setMethod('whatsapp')} className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><MessageCircle size={19}/> التسجيل برقم واتساب</button>
        <p className="text-center text-xs leading-5 text-muted-foreground">ستظهر حسابات Google المتاحة من خلال واجهة Google الآمنة.</p>
      </div> : saved ? <div className="mt-8 flex flex-col items-center gap-3 text-center"><CheckCircle2 size={42} className="text-primary"/><h3 className="text-xl font-bold">تم تسجيل طلبك</h3><p className="text-sm leading-6 text-muted-foreground">تم حفظ الطلب وفتح واتساب برسالة جاهزة. اضغط إرسال داخل واتساب لإبلاغ المسؤول.</p><button onClick={onClose} className="mt-2 rounded-lg bg-primary px-5 py-2 text-primary-foreground">تم</button></div> : <form onSubmit={submitWhatsapp} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">الاسم الكامل<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring" placeholder="اكتب اسمك"/></label>
        <div className="flex flex-col gap-2"><span className="text-sm font-medium">رقم واتساب</span><div className="flex gap-2"><select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} aria-label="رمز الدولة" className="w-40 rounded-xl border border-input bg-background px-3 py-3">{countries.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}</select><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" className="min-w-0 flex-1 rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring" placeholder="رقم الهاتف"/></div></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">حفظ الطلب وفتح واتساب</button>
      </form>}
    </div>
  </div>
}
