import Link from "next/link"
import { Grid2x2, Sparkle, CalendarDays, CalendarRange } from "lucide-react"

const TILES = [
  { href: "/tools/more/asma", icon: Sparkle, title: "أسماء الله الحسنى", desc: "التسعة والتسعون اسمًا مع بيان المعنى" },
  { href: "/tools/more/hijri", icon: CalendarDays, title: "التقويم الهجري", desc: "تاريخ اليوم هجريًا وميلاديًا مع شهر كامل" },
  { href: "/tools/more/monthly", icon: CalendarRange, title: "مواقيت الصلاة الشهرية", desc: "جدول مواقيت الصلاة لكامل الشهر الحالي" },
]

export default function MorePage() {
  return (
    <div>
      <div className="itl-hero">
        <Grid2x2 className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>المزيد</h1>
        <p>أدوات إسلامية إضافية</p>
      </div>

      <div className="itl-grid">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="itl-tile">
            <tile.icon className="size-6" style={{ color: "var(--itl-gold-ink)" }} aria-hidden="true" />
            <strong>{tile.title}</strong>
            <span>{tile.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
