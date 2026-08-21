"use client"

import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"

const PHRASES = [
  { key: "subhan", label: "سبحان الله" },
  { key: "hamd", label: "الحمد لله" },
  { key: "akbar", label: "الله أكبر" },
  { key: "istighfar", label: "أستغفر الله" },
]

export default function TasbihPage() {
  const [phraseKey, setPhraseKey] = useState(PHRASES[0].key)
  const [count, setCount] = useState(0)
  const [target, setTarget] = useState(33)

  useEffect(() => {
    const stored = Number(localStorage.getItem(`tasbih-${phraseKey}`) || 0)
    setCount(Number.isFinite(stored) ? stored : 0)
  }, [phraseKey])

  function increment() {
    setCount((prev) => {
      const next = prev + 1
      localStorage.setItem(`tasbih-${phraseKey}`, String(next))
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12)
      return next
    })
  }

  function reset() {
    setCount(0)
    localStorage.setItem(`tasbih-${phraseKey}`, "0")
  }

  const activePhrase = PHRASES.find((p) => p.key === phraseKey)!

  return (
    <div>
      <div className="itl-hero">
        <h1>المسبحة الإلكترونية</h1>
        <p>اختر الذكر ثم اضغط للتسبيح، ويُحفظ عدد كل ذكر بشكل منفصل على هذا المتصفح</p>
      </div>

      <div className="itl-card">
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {PHRASES.map((phrase) => (
            <button
              key={phrase.key}
              type="button"
              onClick={() => setPhraseKey(phrase.key)}
              className={phrase.key === phraseKey ? "itl-btn" : "itl-btn outline"}
              style={phrase.key !== phraseKey ? { color: "var(--itl-ink)", borderColor: "color-mix(in oklab, var(--itl-ink) 25%, transparent)" } : undefined}
            >
              {phrase.label}
            </button>
          ))}
        </div>

        <p style={{ textAlign: "center", fontFamily: "var(--font-quran)", fontSize: 24, color: "var(--itl-ink)", marginBottom: 8 }}>
          {activePhrase.label}
        </p>

        <button type="button" onClick={increment} className="itl-counter-circle" aria-label="اضغط للتسبيح" style={{ border: "0", cursor: "pointer" }}>
          {count}
        </button>

        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          {[33, 99, 100].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTarget(value)}
              className={target === value ? "itl-btn" : "itl-btn outline"}
              style={target !== value ? { color: "var(--itl-ink)", borderColor: "color-mix(in oklab, var(--itl-ink) 25%, transparent)" } : undefined}
            >
              {value}
            </button>
          ))}
          <button type="button" onClick={reset} className="itl-btn outline" style={{ color: "var(--itl-ink)", borderColor: "color-mix(in oklab, var(--itl-ink) 25%, transparent)" }}>
            <RotateCcw className="size-4" aria-hidden="true" />
            تصفير
          </button>
        </div>

        {count >= target && (
          <p style={{ textAlign: "center", marginTop: 14, color: "var(--itl-gold-ink)", fontWeight: 700 }}>
            بلغت الهدف ({target})، تقبّل الله ذكرك
          </p>
        )}
      </div>
    </div>
  )
}
