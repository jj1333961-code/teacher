"use client"

import { useMemo } from "react"
import { CalendarDays } from "lucide-react"

export default function HijriPage() {
  const today = useMemo(() => new Date(), [])

  const hijriFull = today.toLocaleDateString("ar-SA-u-ca-islamic", { dateStyle: "full" })
  const gregorianFull = today.toLocaleDateString("ar-EG", { dateStyle: "full" })

  const monthDays = useMemo(() => {
    const days: { greg: Date; hijriDay: string; isToday: boolean }[] = []
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const current = new Date(d)
      const hijriDay = current.toLocaleDateString("ar-SA-u-ca-islamic", { day: "numeric" })
      days.push({ greg: current, hijriDay, isToday: current.toDateString() === today.toDateString() })
    }
    return days
  }, [today])

  return (
    <div>
      <div className="itl-hero">
        <CalendarDays className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>التقويم الهجري</h1>
      </div>

      <div className="itl-card" style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-quran)", fontSize: 24, color: "var(--itl-ink)", marginBottom: 6 }}>{hijriFull}</p>
        <p className="itl-muted" style={{ color: "color-mix(in oklab, var(--itl-ink) 60%, transparent)" }}>{gregorianFull}</p>
      </div>

      <div className="itl-card">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--itl-ink)", marginBottom: 12 }}>الشهر الميلادي الحالي بالتاريخ الهجري</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {monthDays.map((day) => (
            <div
              key={day.greg.toISOString()}
              style={{
                textAlign: "center",
                padding: "8px 2px",
                borderRadius: 10,
                background: day.isToday ? "var(--itl-gold)" : "color-mix(in oklab, var(--itl-ink) 5%, transparent)",
                color: day.isToday ? "var(--itl-gold-ink)" : "var(--itl-ink)",
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7 }}>{day.greg.getDate()}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{day.hijriDay}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
