import { Sparkle } from "lucide-react"
import { ASMA_ALLAH } from "./data"

export default function AsmaAllahPage() {
  return (
    <div>
      <div className="itl-hero">
        <Sparkle className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>أسماء الله الحسنى</h1>
        <p>{ASMA_ALLAH.length} اسمًا من أسماء الله الحسنى مع بيان معانيها</p>
      </div>

      <div className="itl-grid">
        {ASMA_ALLAH.map((item, index) => (
          <div key={item.name} className="itl-tile" style={{ textAlign: "center" }}>
            <span style={{ fontSize: 11, color: "var(--itl-gold-ink)", fontWeight: 700 }}>{index + 1}</span>
            <strong style={{ fontFamily: "var(--font-quran)", fontSize: 20 }}>{item.name}</strong>
            <span>{item.meaning}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
