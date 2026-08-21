import { Sparkles } from "lucide-react"
import { AZKAR_CATEGORIES } from "./data"
import { AzkarItemRow } from "./azkar-item"

export default function AzkarPage() {
  return (
    <div>
      <div className="itl-hero">
        <Sparkles className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>الأذكار</h1>
        <p>أذكار الصباح والمساء والنوم مع عدّاد لكل ذكر</p>
      </div>

      {AZKAR_CATEGORIES.map((category) => (
        <div key={category.key} className="itl-card">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--itl-ink)", marginBottom: 14 }}>{category.title}</h2>
          {category.items.map((item, index) => (
            <AzkarItemRow key={index} text={item.text} count={item.count} />
          ))}
        </div>
      ))}
    </div>
  )
}
