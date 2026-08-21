"use client"

import { useEffect, useState } from "react"
import { Clock3, RotateCw } from "lucide-react"
import { useIslamicLocation } from "@/hooks/use-islamic-location"
import { calculatePrayerTimes, nextPrayer } from "@/lib/islamic/prayer"

export default function PrayerTimesPage() {
  const location = useIslamicLocation()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const entries = calculatePrayerTimes(now, location.lat, location.lon)
  const upcoming = nextPrayer(entries, now)

  return (
    <div>
      <div className="itl-hero">
        <Clock3 className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>مواقيت الصلاة</h1>
        <p>
          {now.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {location.isFallback && location.status !== "loading" && (
        <div className="itl-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <p style={{ color: "var(--itl-ink)", fontSize: 13 }}>
            {location.status === "unsupported"
              ? "متصفحك لا يدعم تحديد الموقع، الأوقات محسوبة على موقع القاهرة وتُعد تقديرية."
              : "تم رفض الوصول للموقع، فتم استخدام موقع القاهرة الافتراضي والأوقات تقديرية."}
          </p>
          <button type="button" onClick={location.retry} className="itl-btn">
            <RotateCw className="size-4" aria-hidden="true" />
            إعادة تحديد موقعي
          </button>
        </div>
      )}

      <div className="itl-card">
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <p className="itl-muted" style={{ color: "var(--itl-ink)" }}>الصلاة القادمة</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: "var(--itl-gold-ink)" }}>{upcoming.label}</p>
          <p style={{ fontSize: 20, color: "var(--itl-ink)" }} dir="ltr">
            {upcoming.time}
          </p>
        </div>
        {entries.map((entry) => (
          <div key={entry.name} className={`itl-prayer-row ${entry.name === upcoming.name ? "active" : ""}`} style={{ color: "var(--itl-ink)" }}>
            <span>{entry.label}</span>
            <strong dir="ltr">{entry.time}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
