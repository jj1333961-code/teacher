"use client"

import { useMemo } from "react"
import { CalendarRange, RotateCw } from "lucide-react"
import { useIslamicLocation } from "@/hooks/use-islamic-location"
import { calculatePrayerTimes } from "@/lib/islamic/prayer"

export default function MonthlyPrayerPage() {
  const location = useIslamicLocation()

  const rows = useMemo(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const list: { date: Date; entries: ReturnType<typeof calculatePrayerTimes> }[] = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const current = new Date(d)
      list.push({ date: current, entries: calculatePrayerTimes(current, location.lat, location.lon) })
    }
    return list
  }, [location.lat, location.lon])

  const today = new Date()

  return (
    <div>
      <div className="itl-hero">
        <CalendarRange className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>مواقيت الصلاة الشهرية</h1>
        <p>{today.toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}</p>
      </div>

      {location.isFallback && location.status !== "loading" && (
        <div className="itl-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <p style={{ color: "var(--itl-ink)", fontSize: 13 }}>الجدول محسوب على موقع القاهرة الافتراضي، والأوقات تقديرية.</p>
          <button type="button" onClick={location.retry} className="itl-btn">
            <RotateCw className="size-4" aria-hidden="true" />
            إعادة تحديد موقعي
          </button>
        </div>
      )}

      <div className="itl-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--itl-ink)", fontSize: 13 }} dir="rtl">
          <thead>
            <tr style={{ borderBottom: "2px solid var(--itl-gold)" }}>
              <th style={{ padding: "8px 4px", textAlign: "right" }}>اليوم</th>
              <th style={{ padding: "8px 4px" }}>الفجر</th>
              <th style={{ padding: "8px 4px" }}>الشروق</th>
              <th style={{ padding: "8px 4px" }}>الظهر</th>
              <th style={{ padding: "8px 4px" }}>العصر</th>
              <th style={{ padding: "8px 4px" }}>المغرب</th>
              <th style={{ padding: "8px 4px" }}>العشاء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isToday = row.date.toDateString() === today.toDateString()
              return (
                <tr
                  key={row.date.toISOString()}
                  style={{
                    borderBottom: "1px solid color-mix(in oklab, var(--itl-ink) 8%, transparent)",
                    background: isToday ? "color-mix(in oklab, var(--itl-gold) 14%, transparent)" : "transparent",
                    fontWeight: isToday ? 700 : 400,
                  }}
                >
                  <td style={{ padding: "6px 4px" }}>{row.date.getDate()}</td>
                  {row.entries
                    .filter((e) => e.name !== "sunrise" || true)
                    .map((entry) => (
                      <td key={entry.name} style={{ padding: "6px 4px", textAlign: "center" }} dir="ltr">
                        {entry.time}
                      </td>
                    ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
