import { BookMarked } from "lucide-react"

const HADITHS = [
  {
    text: "«إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى»",
    source: "رواه البخاري ومسلم",
  },
  {
    text: "«مَنْ سَلَكَ طَرِيقًا يَطْلُبُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ»",
    source: "رواه مسلم",
  },
  {
    text: "«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»",
    source: "رواه البخاري",
  },
  {
    text: "«الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ، وَفِي كُلٍّ خَيْرٌ»",
    source: "رواه مسلم",
  },
  {
    text: "«مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَلَهُ حَسَنَةٌ، وَالْحَسَنَةُ بِعَشْرِ أَمْثَالِهَا»",
    source: "رواه الترمذي",
  },
  {
    text: "«تَعَلَّمُوا الْقُرْآنَ وَعَلِّمُوهُ، فَإِنَّ أَجْرَ ذَلِكَ عَظِيمٌ»",
    source: "رواه أحمد",
  },
]

export default function HadithPage() {
  return (
    <div>
      <div className="itl-hero">
        <BookMarked className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>الحديث الشريف</h1>
        <p>أحاديث نبوية مختارة عن العلم وطلبه — وليست موسوعة حديثية شاملة</p>
      </div>

      <div className="itl-card">
        {HADITHS.map((hadith, index) => (
          <div
            key={index}
            style={{
              padding: "14px 0",
              borderBottom: index === HADITHS.length - 1 ? "none" : "1px solid color-mix(in oklab, var(--itl-ink) 10%, transparent)",
            }}
          >
            <p style={{ fontFamily: "var(--font-quran)", fontSize: 20, lineHeight: 2, color: "var(--itl-ink)", marginBottom: 6 }}>
              {hadith.text}
            </p>
            <p className="itl-muted" style={{ color: "color-mix(in oklab, var(--itl-ink) 60%, transparent)" }}>{hadith.source}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
