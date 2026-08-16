'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function JoinPortal() {
  const { data: session, isPending } = authClient.useSession()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function signInWithGoogle() {
    sessionStorage.setItem('join_name', name.trim())
    await authClient.signIn.social({ provider: 'google', callbackURL: '/join' })
  }

  async function submitRequest() {
    if (!session?.user) return
    const submittedName = name.trim() || sessionStorage.getItem('join_name') || session.user.name || ''
    if (submittedName.length < 2) {
      setMessage('اكتب الاسم بالكامل أولًا.')
      return
    }
    setSubmitting(true)
    const response = await fetch('/api/join-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: submittedName }),
    })
    const body = await response.json()
    setSubmitting(false)
    if (!response.ok) {
      setMessage(body.error || 'تعذر إرسال الطلب.')
      return
    }
    setMessage(body.status === 'approved' ? 'تمت الموافقة على طلبك.' : 'تم إرسال الطلب، وهو الآن في انتظار موافقة المسؤول.')
    setWhatsappUrl(body.whatsappUrl || '')
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <p className="font-mono text-xs font-semibold text-primary">طلب الانضمام</p>
        <h1 className="mt-2 text-balance text-2xl font-bold">إنشاء حساب جديد</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">اكتب اسمك ثم اختر حساب Google المسجل على جهازك. لن تتمكن من الدخول حتى يوافق المسؤول.</p>

        <label htmlFor="join-name" className="mt-6 block text-sm font-semibold">الاسم بالكامل</label>
        <input id="join-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={session?.user?.name || 'اكتب الاسم'} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring" />

        {!session?.user ? (
          <button type="button" disabled={isPending || name.trim().length < 2} onClick={signInWithGoogle} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">التسجيل باستخدام Google</button>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-secondary p-4">
            <p className="text-sm font-semibold">الحساب المختار</p>
            <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
            <button type="button" disabled={submitting} onClick={submitRequest} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{submitting ? 'جاري الإرسال...' : 'إرسال طلب الانضمام'}</button>
          </div>
        )}

        {message && <p role="status" className="mt-4 rounded-xl bg-secondary p-3 text-sm leading-6">{message}</p>}
        {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block w-full rounded-xl border border-border px-4 py-3 text-center font-semibold text-primary">فتح واتساب وإرسال الرسالة يدويًا</a>}
        <a href="/" className="mt-5 block text-center text-sm text-muted-foreground underline underline-offset-4">العودة إلى تسجيل الدخول</a>
      </section>
    </main>
  )
}
