'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Clock3, Code2, FileQuestion, Mic, Send, ShieldCheck, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import type { QuizData, QuizResult, VoiceProfile } from '@/lib/db/schema'

const emptyQuiz: QuizData = { id: '', title: '', questions: [] }
const surahs = ['الفاتحة', 'الإخلاص', 'الفلق', 'الناس', 'الكوثر', 'العصر', 'النصر', 'المسد']

function formatTime(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':')
}

async function saveSnapshot(data: unknown) {
  await fetch('/api/data', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data }) })
}

async function captureVoiceFeatures(): Promise<number[]> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const context = new AudioContext()
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  context.createMediaStreamSource(stream).connect(analyser)
  const values = new Uint8Array(analyser.frequencyBinCount)
  const samples: number[][] = []
  await new Promise<void>((resolve) => {
    const started = Date.now()
    const read = () => {
      analyser.getByteFrequencyData(values)
      samples.push(Array.from(values.slice(0, 48)))
      if (Date.now() - started < 3000) requestAnimationFrame(read)
      else resolve()
    }
    read()
  })
  stream.getTracks().forEach((track) => track.stop())
  await context.close()
  return Array.from({ length: 48 }, (_, index) => Math.round(samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length))
}

function voiceSimilarity(reference: number[], sample: number[]) {
  const distance = reference.reduce((sum, value, index) => sum + Math.abs(value - (sample[index] || 0)), 0) / reference.length
  return Math.max(0, Math.round(100 - distance))
}

export function TeacherDashboard() {
  const [quiz, setQuiz] = useState<QuizData>(emptyQuiz)
  const [surah, setSurah] = useState('الفاتحة')
  const [count, setCount] = useState(5)
  const [seconds, setSeconds] = useState(60)
  const [generating, setGenerating] = useState(false)
  const [active, setActive] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null)
  const [voiceStatus, setVoiceStatus] = useState('لم يتم تسجيل بصمة محلية')
  const [voiceVerified, setVoiceVerified] = useState(false)
  const [devPrompt, setDevPrompt] = useState('')
  const [devStatus, setDevStatus] = useState('')
  const [devPlan, setDevPlan] = useState<string[]>([])
  const answerRef = useRef<HTMLInputElement>(null)
  const question = quiz.questions[active]
  const totalSeconds = useMemo(() => question ? question.hours * 3600 + question.minutes * 60 + question.seconds : 0, [question])

  const finishQuiz = useCallback(async () => {
    const total = quiz.questions.reduce((sum, item) => sum + item.points, 0)
    const score = quiz.questions.reduce((sum, item) => sum + (answers[item.id] === item.answer ? item.points : 0), 0)
    const completed: QuizResult = { score, total, answers, voiceVerified, completedAt: new Date().toISOString() }
    setResult(completed)
    setStarted(false)
    await saveSnapshot({ quiz, result: completed, voiceProfile })
  }, [answers, quiz, voiceProfile, voiceVerified])

  const nextQuestion = useCallback(() => {
    if (active < quiz.questions.length - 1) {
      const next = active + 1
      setActive(next)
      const item = quiz.questions[next]
      setRemaining(item.hours * 3600 + item.minutes * 60 + item.seconds)
    } else void finishQuiz()
  }, [active, finishQuiz, quiz.questions])

  useEffect(() => {
    if (!started || remaining <= 0) return
    const timer = window.setInterval(() => setRemaining((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [started, remaining])

  useEffect(() => {
    if (started && remaining === 0) nextQuestion()
  }, [nextQuestion, remaining, started])

  async function generateQuiz() {
    setGenerating(true)
    setResult(null)
    try {
      const response = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'generate_exam', surah, count, seconds }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setQuiz(data.quiz)
      setActive(0)
      setAnswers({})
      await saveSnapshot({ quiz: data.quiz })
    } catch (error) {
      setDevStatus(error instanceof Error ? error.message : 'تعذر إنشاء الاختبار')
    } finally {
      setGenerating(false)
    }
  }

  async function enrollVoice() {
    if (!window.confirm('هل توافق على إنشاء قالب رقمي للبصمة الصوتية محليًا دون حفظ التسجيل الخام؟')) return
    try {
      setVoiceStatus('تحدث بوضوح لمدة 3 ثوانٍ...')
      const features = await captureVoiceFeatures()
      const profile = { consent: true, features, createdAt: new Date().toISOString() }
      setVoiceProfile(profile)
      setVoiceStatus('تم تسجيل القالب محليًا')
      await saveSnapshot({ quiz, voiceProfile: profile })
    } catch {
      setVoiceStatus('تعذر استخدام الميكروفون في هذا المتصفح')
    }
  }

  async function verifyVoice() {
    if (!voiceProfile) return
    try {
      setVoiceStatus('جاري التحقق المحلي...')
      const score = voiceSimilarity(voiceProfile.features, await captureVoiceFeatures())
      const verified = score >= 72
      setVoiceVerified(verified)
      setVoiceStatus(verified ? `تم التحقق بنسبة ${score}%` : `لم تتطابق العينة (${score}%) — استخدم تحقق المعلم البديل`)
    } catch {
      setVoiceStatus('الميزة غير مدعومة؛ استخدم تحقق المعلم البديل')
    }
  }

  function startQuiz() {
    if (!voiceVerified) return setVoiceStatus('تحقق من الهوية أولًا، أو اطلب تحقق المعلم البديل')
    setStarted(true)
    setActive(0)
    setRemaining(quiz.questions[0] ? quiz.questions[0].hours * 3600 + quiz.questions[0].minutes * 60 + quiz.questions[0].seconds : 0)
  }

  function submitAnswer(value: string) {
    if (!question) return
    setAnswers((current) => ({ ...current, [question.id]: value }))
    window.setTimeout(nextQuestion, 100)
  }

  async function requestDevelopment() {
    if (!devPrompt.trim()) return
    setDevStatus('جاري إعداد اقتراح محلي...')
    const response = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'developer', prompt: devPrompt }) })
    const data = await response.json()
    setDevStatus(data.message || data.error)
    setDevPlan(data.proposal?.steps || [])
  }

  return <main dir="rtl" className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4"><div><p className="font-mono text-xs text-primary">LOCAL / ZERO API COST</p><h1 className="text-balance text-2xl font-bold">مختبر الاختبارات القرآنية</h1></div><span className="rounded-full bg-secondary px-3 py-2 text-sm">محرك محلي مجاني</span></div></header>
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><WandSparkles className="text-primary"/><h2 className="text-xl font-bold">إنشاء اختبار</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">اختر الإعدادات ويولّد المحرك أسئلة من المكتبة القرآنية المحلية دون إرسال بيانات للخارج.</p><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="flex flex-col gap-2 text-sm">السورة<select value={surah} onChange={(event) => setSurah(event.target.value)} className="rounded-lg border bg-background p-3">{surahs.map((item) => <option key={item}>{item}</option>)}</select></label><label className="flex flex-col gap-2 text-sm">عدد الأسئلة<input type="number" min="1" max="12" value={count} onChange={(event) => setCount(Number(event.target.value))} className="rounded-lg border bg-background p-3"/></label><label className="flex flex-col gap-2 text-sm">زمن السؤال بالثواني<input type="number" min="15" max="600" value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} className="rounded-lg border bg-background p-3"/></label></div><button onClick={generateQuiz} disabled={generating} className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50"><Sparkles/>{generating ? 'جاري التوليد...' : 'توليد الأسئلة محليًا'}</button></div>
        {!quiz.questions.length ? <div className="rounded-2xl border border-dashed p-10 text-center"><FileQuestion className="mx-auto text-muted-foreground"/><p className="mt-3 text-muted-foreground">لا يوجد نموذج اختبار مضاف. أنشئ اختبارك من الإعدادات.</p></div> : <div className="rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">معاينة وتشغيل</p><h2 className="text-2xl font-bold">{quiz.title}</h2></div><button onClick={() => setQuiz(emptyQuiz)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Trash2/>حذف الاختبار</button></div><div className="mt-5 rounded-xl bg-secondary p-5"><div className="flex items-center justify-between gap-3"><span>السؤال {active + 1} من {quiz.questions.length}</span><span className="flex items-center gap-2 font-mono text-primary"><Clock3/>{formatTime(started ? remaining : totalSeconds)}</span></div><h3 className="mt-5 text-pretty text-xl font-semibold">{question.text}</h3>{question.type === 'choice' ? <div className="mt-4 flex flex-col gap-3">{question.options.map((option) => <button key={option} disabled={!started} onClick={() => submitAnswer(option)} className="rounded-xl border bg-background p-4 text-right disabled:opacity-60">{option}</button>)}</div> : <div className="mt-4 flex gap-2"><input ref={answerRef} disabled={!started} aria-label="إجابة السؤال" className="min-w-0 flex-1 rounded-xl border bg-background p-3" placeholder="اكتب الإجابة" onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) submitAnswer(event.currentTarget.value) }}/><button disabled={!started} onClick={() => submitAnswer(answerRef.current?.value || '')} className="rounded-xl bg-primary px-4 text-primary-foreground">إجابة</button></div>}<button onClick={startQuiz} disabled={started} className="mt-5 rounded-lg bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50">{started ? 'الاختبار يعمل' : 'بدء الاختبار'}</button></div></div>}
        {result && <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><CheckCircle2 className="text-primary"/><h2 className="text-xl font-bold">النتيجة النهائية</h2></div><p className="mt-3 text-3xl font-bold">{result.score} / {result.total}</p><p className="mt-2 text-sm text-muted-foreground">التحقق الصوتي يؤكد الهوية فقط ولم يدخل في حساب الدرجة.</p></div>}
      </section>
      <aside className="flex w-full flex-col gap-5 lg:w-96"><div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><ShieldCheck className="text-primary"/><h2 className="font-bold">التحقق الصوتي المحلي</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">مؤشر عملي وليس إثبات هوية جنائيًا. لا نحفظ التسجيل الخام ولا نرسله للخارج.</p><div className="mt-4 flex gap-2"><button onClick={enrollVoice} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Mic/>تسجيل القالب</button><button onClick={verifyVoice} disabled={!voiceProfile} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">تحقق الآن</button></div><p className="mt-3 text-sm">{voiceStatus}</p>{voiceProfile && <button onClick={() => { setVoiceProfile(null); setVoiceVerified(false); setVoiceStatus('تم حذف البصمة وإلغاء الموافقة') }} className="mt-3 text-sm text-destructive">حذف البصمة</button>}</div><div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><Code2 className="text-primary"/><h2 className="font-bold">مساعد تطوير للمراجعة</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">يحلل الطلب محليًا ويعرض خطة فقط. لن يعدّل GitHub أو ينشر تلقائيًا.</p><textarea value={devPrompt} onChange={(event) => setDevPrompt(event.target.value)} className="mt-4 min-h-28 w-full resize-none rounded-xl border bg-background p-3 text-sm" placeholder="مثال: أضف تقريرًا لنتائج الطلاب"/><button onClick={requestDevelopment} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-primary-foreground"><Send/>إعداد اقتراح</button>{devStatus && <p className="mt-3 text-sm text-primary">{devStatus}</p>}{devPlan.length > 0 && <ol className="mt-3 flex list-decimal flex-col gap-2 pr-5 text-sm text-muted-foreground">{devPlan.map((step) => <li key={step}>{step}</li>)}</ol>}</div></aside>
    </div>
  </main>
}
