'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export function WelcomeScreen() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioReady, setAudioReady] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.preload = 'none'
    const onReady = () => setAudioReady(true)
    audio.addEventListener('canplay', onReady)
    return () => audio.removeEventListener('canplay', onReady)
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-center">
      <audio ref={audioRef} preload="none" src="/audio/ibrahim-minshawi.mp3" />
      <section className="w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-xl sm:p-14">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl bg-primary text-4xl font-bold text-primary-foreground">ث</div>
        <p className="font-mono text-xs tracking-[0.25em] text-primary">THIMAR / QURAN LEARNING</p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-foreground sm:text-7xl">ثمار</h1>
        <p className="mt-4 text-xl font-semibold text-muted-foreground">تعلمٌ هادئ، ونموٌ ثابت</p>
        <p className="mx-auto mt-6 max-w-lg leading-8 text-muted-foreground">مساحة متكاملة للتسميع والاختبارات والمهام، تجمع الطالب والمعلم وولي الأمر في تجربة واضحة وسريعة.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" prefetch={false} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90">دخول النظام</Link>
          <Link href="/signup" prefetch={false} className="rounded-xl border border-border px-6 py-3 font-semibold text-foreground transition hover:bg-muted">إنشاء حساب</Link>
        </div>
        <button type="button" disabled={!audioReady} onClick={() => void audioRef.current?.play()} className="mt-6 text-sm text-muted-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50">{audioReady ? 'استماع إلى التلاوة' : 'تجهيز التلاوة عند الطلب'}</button>
      </section>
    </main>
  )
}

export default WelcomeScreen
