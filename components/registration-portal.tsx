'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, Globe2, GraduationCap, Loader2, MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import { authClient, useSession } from '@/lib/auth-client'

type FormData = { name: string; country: string; phone: string; nationalId: string; age: string; guardianName: string; juz: string; surah: string; notes: string }
const emptyForm: FormData = { name: '', country: '', phone: '', nationalId: '', age: '', guardianName: '', juz: '', surah: '', notes: '' }

export function RegistrationPortal() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<'phone' | 'google'>('phone')
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (session?.user) {
      setSource('google')
      setOpen(true)
      setForm((current) => ({ ...current, name: current.name || session.user.name || '' }))
    }
  }, [session])

  const update = (key: keyof FormData, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function continueWithGoogle() {
    await authClient.signIn.social({ provider: 'google', callbackURL: '/?register=google' })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setMessage('')
    const response = await fetch('/api/join-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, source, authUserId: session?.user.id }) })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) return setMessage(data.error || 'تعذر حفظ الطلب')
    if (data.status === 'pending' && !data.details) return setStatus('pending')
    if (data.status === 'approved') return setStatus('approved')
    const text = `اطلب الانضمام\nالاسم: ${form.name}\nرقم الهاتف: ${form.phone}\nكود الطلب: ${data.requestCode}\n\n${data.details}\n\nلابد من إرسال هذه الرسالة للموافقة`
    setStatus('sent')
    window.location.href = `https://wa.me/${data.whatsappNumber}?text=${encodeURIComponent(text)}`
  }

  async function checkStatus() {
    if (!form.phone) return setMessage('اكتب رقم الهاتف أولًا')
    setBusy(true)
    const response = await fetch(`/api/join-requests?phone=${encodeURIComponent(form.phone)}`)
    const data = await response.json()
    setBusy(false); setStatus(data.status)
  }

  if (status) return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground"><section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-2xl"><CheckCircle2 className="mx-auto text-primary" size={48}/><h1 className="mt-5 text-2xl font-bold">{status === 'approved' ? 'تمت الموافقة على طلبك' : status === 'not_found' ? 'لم يتم العثور على طلب' : 'طلبك قيد التنفيذ'}</h1><p className="mt-3 leading-7 text-muted-foreground">{status === 'approved' ? 'تواصل مع المسؤول حالًا لاستلام اسم المستخدم وكلمة المرور.' : status === 'not_found' ? 'تأكد من الرقم أو أنشئ طلب انضمام جديدًا.' : 'تم تسجيل طلبك بنجاح. سيقوم المسؤول بمراجعته وإضافة حساب الطالب يدويًا.'}</p><button onClick={() => setStatus('')} className="mt-6 rounded-xl border border-border px-5 py-3">العودة</button></section></main>

  return <main dir="rtl" className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap/></span><div><h1 className="font-bold">بوابة الطالب</h1><p className="text-sm text-muted-foreground">منصة المعلّم الذكية</p></div></div><a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">دخول المسؤول</a></div></header>
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-12 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-xl"><span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-primary"><ShieldCheck size={16}/> تسجيل آمن ومراجعة يدوية</span><h2 className="mt-6 text-balance text-4xl font-bold leading-tight md:text-6xl">ابدأ رحلة حفظ القرآن مع متابعة منظّمة</h2><p className="mt-5 text-pretty text-lg leading-8 text-muted-foreground">أرسل بيانات الطالب إلى المسؤول، تابع حالة الطلب، ثم استلم بيانات الدخول بعد الموافقة.</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={() => { setSource('phone'); setOpen(true) }} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground"><Phone size={18}/> التسجيل برقم الهاتف</button><button onClick={checkStatus} className="rounded-xl border border-border bg-card px-5 py-3 font-semibold">متابعة طلب سابق</button><a href="/index.html" className="rounded-xl border border-border bg-card px-5 py-3 font-semibold">لدي حساب بالفعل</a></div></div>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"><Globe2 className="text-primary" size={30}/><h3 className="mt-5 text-2xl font-bold">إنشاء حساب جديد</h3><p className="mt-2 leading-6 text-muted-foreground">اختر الطريقة المناسبة، ثم أكمل بيانات الطالب.</p><button onClick={continueWithGoogle} className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-semibold">المتابعة باستخدام Google</button><button onClick={() => { setSource('phone'); setOpen(true) }} className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">التسجيل برقم الهاتف <ChevronLeft size={18}/></button></div>
    </section>
    {open && <div className="fixed inset-0 z-50 overflow-y-auto bg-background/90 px-4 py-8 backdrop-blur"><form onSubmit={submit} className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-sm text-primary">{source === 'google' ? 'حساب Google متصل' : 'طلب برقم الهاتف'}</p><h2 className="mt-1 text-2xl font-bold">بيانات الطالب</h2></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-2">إغلاق</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{([['name','اسم الطالب'],['country','البلد'],['phone','رقم الهاتف'],['nationalId','الرقم القومي'],['age','السن'],['guardianName','اسم ولي الأمر'],['juz','الجزء الذي فيه الطالب'],['surah','السورة التي فيها الطالب']] as [keyof FormData,string][]).map(([key,label]) => <label key={key} className="grid gap-2 text-sm font-medium">{label}<input required={['name','country','phone'].includes(key)} type={key === 'age' ? 'number' : 'text'} value={form[key]} onChange={(e) => update(key, e.target.value)} className="rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"/></label>)}</div><label className="mt-4 grid gap-2 text-sm font-medium">ملاحظات<textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} className="min-h-24 rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"/></label>{message && <p className="mt-4 text-sm text-destructive">{message}</p>}<button disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 font-bold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={18}/> : <MessageCircle size={18}/>} حفظ والانتقال إلى واتساب</button><p className="mt-3 text-center text-xs leading-5 text-muted-foreground">لن تُرسل الرسالة تلقائيًا. سيُفتح واتساب برسالة مجهزة لتضغط إرسال بنفسك.</p></form></div>}
  </main>
}
