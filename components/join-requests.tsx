'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Inbox, X } from 'lucide-react'
import { JOIN_REQUESTS_KEY, type JoinRequest } from '@/components/account-registration'

export function JoinRequests() {
  const [requests, setRequests] = useState<JoinRequest[]>([])

  const loadRequests = useCallback(() => {
    try { setRequests(JSON.parse(localStorage.getItem(JOIN_REQUESTS_KEY) || '[]')) }
    catch { setRequests([]) }
  }, [])

  useEffect(() => {
    loadRequests()
    window.addEventListener('join-requests-changed', loadRequests)
    window.addEventListener('storage', loadRequests)
    return () => { window.removeEventListener('join-requests-changed', loadRequests); window.removeEventListener('storage', loadRequests) }
  }, [loadRequests])

  function updateStatus(id: string, status: JoinRequest['status']) {
    const next = requests.map((request) => request.id === id ? { ...request, status } : request)
    setRequests(next)
    localStorage.setItem(JOIN_REQUESTS_KEY, JSON.stringify(next))
  }

  return <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="join-requests-title">
    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Inbox className="text-primary" size={19}/><h2 id="join-requests-title" className="font-semibold">طلبات الانضمام</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{requests.filter((request) => request.status === 'pending').length} جديد</span></div>
    {!requests.length ? <p className="mt-4 text-sm leading-6 text-muted-foreground">لا توجد طلبات محفوظة على هذا المتصفح بعد.</p> : <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto">{requests.map((request) => <article key={request.id} className="rounded-xl border border-border bg-background p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{request.name}</h3><p dir="ltr" className="mt-1 text-right font-mono text-xs text-muted-foreground">{request.countryCode}{request.phone}</p></div><span className="rounded-md bg-secondary px-2 py-1 text-xs">{request.status === 'pending' ? 'قيد المراجعة' : request.status === 'approved' ? 'مقبول' : 'مرفوض'}</span></div><p className="mt-3 text-xs text-muted-foreground">كود الطلب: <b className="font-mono text-foreground">{request.verificationCode}</b></p>{request.status === 'pending' && <div className="mt-3 flex gap-2"><button onClick={() => updateStatus(request.id, 'approved')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Check size={14}/> قبول</button><button onClick={() => updateStatus(request.id, 'rejected')} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><X size={14}/> رفض</button></div>}</article>)}</div>}
    <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">الحفظ محلي ومؤقت على هذا المتصفح، وقد فُصلت طبقة البيانات لتسهيل نقلها إلى قاعدة بيانات لاحقًا.</p>
  </section>
}
