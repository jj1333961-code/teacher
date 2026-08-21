import Link from "next/link"
import { BookOpen } from "lucide-react"

type Surah = {
  number: number
  name: string
  englishName: string
  numberOfAyahs: number
  revelationType: "Meccan" | "Medinan"
}

async function getSurahs(): Promise<Surah[]> {
  const res = await fetch("https://api.alquran.cloud/v1/surah", { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error("تعذر تحميل قائمة السور")
  const data = await res.json()
  return data.data
}

export default async function QuranIndexPage() {
  let surahs: Surah[] = []
  let error = ""
  try {
    surahs = await getSurahs()
  } catch {
    error = "تعذر تحميل قائمة السور من الإنترنت. تحقق من الاتصال وأعد تحميل الصفحة."
  }

  return (
    <div>
      <div className="itl-hero">
        <BookOpen className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>القرآن الكريم</h1>
        <p>تصفّح السور الـ 114 كاملة، مع بيان مكية أو مدنية وعدد آياتها</p>
      </div>

      {error ? (
        <div className="itl-card">
          <p style={{ color: "var(--itl-ink)" }}>{error}</p>
        </div>
      ) : (
        <div className="itl-surah-list">
          {surahs.map((surah) => (
            <Link key={surah.number} href={`/tools/quran/${surah.number}`} className="itl-surah-row">
              <div className="itl-surah-number">{surah.number}</div>
              <div style={{ flex: 1 }}>
                <div className="itl-surah-name">{surah.name}</div>
                <div className="itl-surah-meta">
                  <span className={`itl-badge ${surah.revelationType === "Meccan" ? "meccan" : "medinan"}`}>
                    {surah.revelationType === "Meccan" ? "مكية" : "مدنية"}
                  </span>
                  <span>{surah.numberOfAyahs} آية</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
