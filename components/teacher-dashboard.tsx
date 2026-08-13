'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock3, Code2, FileQuestion, Plus, Send, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import type { QuizData, QuizQuestion } from '@/lib/db/schema'

const initialQuiz: QuizData = { id: 'demo-quiz', title: 'اختبار الحفظ الأسبوعي', questions: [
  { id: 'q1', text: 'اكتب بداية الآية التالية', options: ['الحمد لله رب العالمين', 'قل هو الله أحد', 'إنا أعطيناك الكوثر'], hours: 0, minutes: 1, seconds: 30 },
  { id: 'q2', text: 'اختر السورة التي تبدأ بـ «تبارك الذي بيده الملك»', options: ['الملك', 'الرحمن', 'الواقعة'], hours: 0, minutes: 0, seconds: 45 },
] }

function formatTime(total: number) { const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60; return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':') }

export function TeacherDashboard() {
  const [quiz, setQuiz] = useState(initialQuiz)
  const [active, setActive] = useState(0)
  const [remaining, setRemaining] = useState(() => initialQuiz.questions[0].seconds)
  const [started, setStarted] = useState(false)
  const [devPrompt, setDevPrompt] = useState('')
  const [devStatus, setDevStatus] = useState('')
  const question = quiz.questions[active]
  const totalSeconds = useMemo(() => question.hours * 3600 + question.minutes * 60 + question.seconds, [question])
  useEffect(() => { if (!started || remaining <= 0) return; const timer = window.setInterval(() => setRemaining((value) => { if (value <= 1) { window.clearInterval(timer); nextQuestion(); return 0 } return value - 1 }), 1000); return () => window.clearInterval(timer) }, [started, remaining])

  function startQuiz() { setStarted(true); setRemaining(totalSeconds) }
  function nextQuestion() { if (active < quiz.questions.length - 1) { const next = active + 1; setActive(next); setRemaining(quiz.questions[next].hours * 3600 + quiz.questions[next].minutes * 60 + quiz.questions[next].seconds) } else setStarted(false) }
  function deleteQuiz() { if (window.confirm('هل تريد حذف الاختبار بالكامل؟')) setQuiz({ ...quiz, questions: [] }) }
  function addQuestion() { const newQuestion: QuizQuestion = { id: crypto.randomUUID(), text: 'سؤال جديد', options: ['إجابة 1', 'إجابة 2'], hours: 0, minutes: 1, seconds: 0 }; setQuiz({ ...quiz, questions: [...quiz.questions, newQuestion] }) }
  async function requestDevelopment() { if (!devPrompt.trim()) return; setDevStatus('جاري التحليل...'); const res = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'developer', prompt: devPrompt }) }); const data = await res.json(); setDevStatus(data.message || data.error || 'تم إرسال الطلب'); setDevPrompt('') }

  return <main dir="rtl" className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><p className="font-mono text-xs text-primary">EDU / AI WORKSPACE</p><h1 className="mt-1 text-2xl font-bold tracking-tight">منصة المعلّم الذكية</h1></div><div className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm"><span className="size-2 rounded-full bg-primary" /> متصل بـ Neon</div></div></header>
    <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6"><div className="flex items-end justify-between"><div><p className="text-sm text-muted-foreground">إدارة الاختبارات</p><h2 className="mt-1 text-3xl font-bold">{quiz.title}</h2></div><div className="flex gap-2"><button onClick={addQuestion} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><Plus size={16}/> سؤال</button><button onClick={deleteQuiz} className="flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground"><Trash2 size={16}/> حذف الاختبار</button></div></div>
        {quiz.questions.length ? <div className="rounded-2xl border border-border bg-card p-6"><div className="mb-6 flex items-center justify-between"><span className="rounded-md bg-secondary px-3 py-1 text-sm">السؤال {active + 1} من {quiz.questions.length}</span><span className="flex items-center gap-2 font-mono text-lg text-primary"><Clock3 size={18}/>{formatTime(started ? remaining : totalSeconds)}</span></div><h3 className="text-xl font-semibold">{question.text}</h3><div className="mt-5 grid gap-3">{question.options.map((option) => <button key={option} onClick={nextQuestion} className="rounded-xl border border-border p-4 text-right transition hover:border-primary hover:bg-secondary">{option}</button>)}</div><div className="mt-6 flex items-center justify-between"><button onClick={startQuiz} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground"><Sparkles size={16}/>{started ? 'الاختبار يعمل' : 'بدء الاختبار'}</button><p className="text-xs text-muted-foreground">ينتقل تلقائيًا عند الإجابة أو انتهاء الوقت</p></div></div> : <div className="rounded-2xl border border-dashed border-border p-12 text-center"><FileQuestion className="mx-auto text-muted-foreground"/><p className="mt-3 text-muted-foreground">تم حذف الاختبار</p></div>}
      </section>
      <aside className="space-y-5"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><WandSparkles className="text-primary" size={19}/><h2 className="font-semibold">مساعد تطوير الموقع</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">اكتب طلب التعديل، وسيحلله الذكاء الاصطناعي ويجهز التغيير للمستودع.</p><textarea value={devPrompt} onChange={(e) => setDevPrompt(e.target.value)} placeholder="مثال: أضف تقريرًا لنتائج الطلاب..." className="mt-4 min-h-28 w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"/><button onClick={requestDevelopment} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground"><Send size={16}/> إرسال طلب التعديل</button>{devStatus && <p className="mt-3 text-sm text-primary">{devStatus}</p>}</div><div className="rounded-2xl border border-border bg-secondary p-5"><div className="flex items-center gap-2"><Code2 size={18}/><h3 className="font-semibold">حالة التنفيذ</h3></div><p className="mt-2 text-sm leading-6 text-muted-foreground">يظهر هنا التقدم والوقت المتبقي، ويتم حفظ بيانات الموقع في Neon وتغييرات الكود في GitHub.</p></div></aside>
    </div></main>
}
