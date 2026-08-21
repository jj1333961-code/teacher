"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"

export function AzkarItemRow({ text, count }: { text: string; count: number }) {
  const [remaining, setRemaining] = useState(count)

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: 14,
        border: "1px solid color-mix(in oklab, var(--itl-ink) 10%, transparent)",
        marginBottom: 10,
        background: remaining === 0 ? "color-mix(in oklab, var(--itl-gold) 12%, transparent)" : "transparent",
      }}
    >
      <p style={{ fontFamily: "var(--font-quran)", fontSize: 19, lineHeight: 1.9, color: "var(--itl-ink)", marginBottom: 10 }}>
        {text}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <button
          type="button"
          onClick={() => setRemaining((r) => Math.max(0, r - 1))}
          disabled={remaining === 0}
          className="itl-btn"
          style={{ opacity: remaining === 0 ? 0.5 : 1 }}
        >
          {remaining === 0 ? "تم" : `تسبيح (${remaining} متبقٍ)`}
        </button>
        <button
          type="button"
          onClick={() => setRemaining(count)}
          className="itl-btn outline"
          style={{ color: "var(--itl-ink)", borderColor: "color-mix(in oklab, var(--itl-ink) 25%, transparent)" }}
          aria-label="إعادة العد"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
