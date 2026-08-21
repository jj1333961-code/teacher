"use client"

import { Compass, LocateFixed, RotateCw } from "lucide-react"
import { useIslamicLocation } from "@/hooks/use-islamic-location"
import { distanceToKaabaKm, qiblaBearing } from "@/lib/islamic/prayer"

export default function QiblaPage() {
  const location = useIslamicLocation()
  const bearing = qiblaBearing(location.lat, location.lon)
  const distance = distanceToKaabaKm(location.lat, location.lon)

  return (
    <div>
      <div className="itl-hero">
        <Compass className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>اتجاه القبلة</h1>
        <p>يتم حساب الاتجاه نحو الكعبة المشرفة تلقائيًا بحسب موقعك الجغرافي الحالي</p>
      </div>

      <div className="itl-card">
        {location.status === "loading" && <p className="itl-muted" style={{ color: "var(--itl-ink)" }}>جارِ تحديد موقعك...</p>}

        {location.isFallback && location.status !== "loading" && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: "color-mix(in oklab, var(--itl-gold) 14%, transparent)" }}>
            <p style={{ color: "var(--itl-ink)", fontSize: 13, marginBottom: 8 }}>
              {location.status === "unsupported"
                ? "متصفحك لا يدعم تحديد الموقع. تم استخدام موقع القاهرة الافتراضي والاتجاه تقريبي."
                : "تم رفض الوصول للموقع، فتم استخدام موقع القاهرة الافتراضي والاتجاه تقريبي."}
            </p>
            <button type="button" onClick={location.retry} className="itl-btn">
              <RotateCw className="size-4" aria-hidden="true" />
              إعادة تحديد موقعي
            </button>
          </div>
        )}

        <div className="itl-compass-wrap">
          <div className="itl-compass">
            <span style={{ position: "absolute", top: 8, color: "var(--itl-ink)", fontSize: 12, fontWeight: 700 }}>ش</span>
            <span style={{ position: "absolute", bottom: 8, color: "var(--itl-ink)", fontSize: 12, fontWeight: 700 }}>ج</span>
            <span style={{ position: "absolute", right: 10, color: "var(--itl-ink)", fontSize: 12, fontWeight: 700 }}>غ</span>
            <span style={{ position: "absolute", left: 10, color: "var(--itl-ink)", fontSize: 12, fontWeight: 700 }}>ق</span>
            <div className="itl-compass-needle" style={{ transform: `translateX(-50%) rotate(${bearing}deg)` }} />
            <div className="itl-compass-center">
              <LocateFixed className="size-4" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", color: "var(--itl-ink)" }}>
          <p style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{Math.round(bearing)}° من الشمال</p>
          <p className="itl-muted" style={{ color: "color-mix(in oklab, var(--itl-ink) 65%, transparent)" }}>
            المسافة التقريبية إلى الكعبة: {distance.toLocaleString("ar-EG")} كم
          </p>
        </div>
      </div>

      <div className="itl-card">
        <p className="itl-muted" style={{ color: "var(--itl-ink)" }}>
          وجّه هاتفك بحيث يشير الجزء العلوي منه نحو الشمال الحقيقي، ثم اتبع اتجاه السهم الذهبي لتحديد جهة القبلة.
        </p>
      </div>
    </div>
  )
}
