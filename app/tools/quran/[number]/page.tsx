import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { ScrollToSurah } from "../scroll-to-surah"

const MUSHAF_PDF_URL =
  "https://blobs.vusercontent.net/blob/%D8%A7%D9%84%D9%85%D8%B5%D8%AD%D9%81%20-89mxsMK1eEvQmsne3W24JBjxpyNKY1.pdf"

type Ayah = { number: number; text: string; numberInSurah: number }
type Surah = {
  number: number
  name: string
  englishName: string
  revelationType: "Meccan" | "Medinan"
  ayahs: Ayah[]
}

async function getFullQuran(): Promise<Surah[]> {
  const res = await fetch("https://api.alquran.cloud/v1/quran/quran-uthmani", {
    next: { revalidate: 86400 },
  })
  if (!res.ok) throw new Error("تعذر تحميل المصحف")
  const data = await res.json()
  return data.data.surahs
}

export default async function QuranReaderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  const surahNumber = Number.parseInt(number, 10)
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) notFound()

  let surahs: Surah[] = []
  let error = ""
  try {
    surahs = await getFullQuran()
  } catch {
    error = "تعذر تحميل نص المصحف من الإنترنت. تحقق من الاتصال وأعد المحاولة."
  }

  return (
    <div>
      <ScrollToSurah surahNumber={surahNumber} />
      <div className="itl-hero" style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <Link href="/tools/quran" className="itl-btn outline">
            كل السور
          </Link>
          <a href={MUSHAF_PDF_URL} target="_blank" rel="noopener noreferrer" className="itl-btn">
            <ExternalLink className="size-4" aria-hidden="true" />
            فتح ملف المصحف PDF
          </a>
        </div>
      </div>

      {error ? (
        <div className="itl-card">{error}</div>
      ) : (
        <div className="itl-card">
          {surahs.map((surah) => (
            <section key={surah.number} id={`surah-${surah.number}`}>
              <div className="itl-surah-heading">
                <h2>{surah.name}</h2>
                <small>
                  {surah.revelationType === "Meccan" ? "مكية" : "مدنية"} — {surah.ayahs.length} آية
                </small>
              </div>
              {surah.number !== 1 && surah.number !== 9 && <p className="itl-basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>}
              <p className="itl-quran-text">
                {surah.ayahs.map((ayah) => (
                  <span key={ayah.number} className="itl-ayah">
                    {ayah.text}
                    <span className="itl-ayah-num">{ayah.numberInSurah}</span>{" "}
                  </span>
                ))}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
