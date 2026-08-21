import { HandHeart } from "lucide-react"

const DUA_CATEGORIES = [
  {
    title: "أدعية من القرآن الكريم",
    items: [
      "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
      "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي",
      "رَبِّ زِدْنِي عِلْمًا",
      "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً",
    ],
  },
  {
    title: "أدعية اليوم والليلة",
    items: [
      "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",
      "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ",
      "اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي",
      "اللَّهُمَّ اغْفِرْ لِي ذَنْبِي وَوَسِّعْ لِي فِي دَارِي وَبَارِكْ لِي فِيمَا رَزَقْتَنِي",
    ],
  },
  {
    title: "أدعية طلب العلم والاستعداد للاختبار",
    items: [
      "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا",
      "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِنْ لِسَانِي",
      "اللَّهُمَّ افْتَحْ عَلَيَّ فَهْمِي وَاشْرَحْ لِي عِلْمِي",
    ],
  },
]

export default function DuaPage() {
  return (
    <div>
      <div className="itl-hero">
        <HandHeart className="mx-auto mb-2 size-8" style={{ color: "var(--itl-gold)" }} aria-hidden="true" />
        <h1>الأدعية</h1>
        <p>مجموعة مختارة من الأدعية القرآنية والنبوية</p>
      </div>

      {DUA_CATEGORIES.map((category) => (
        <div key={category.title} className="itl-card">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--itl-ink)", marginBottom: 12 }}>{category.title}</h2>
          {category.items.map((item, index) => (
            <p
              key={index}
              style={{
                fontFamily: "var(--font-quran)",
                fontSize: 19,
                lineHeight: 2,
                color: "var(--itl-ink)",
                padding: "10px 0",
                borderBottom: index === category.items.length - 1 ? "none" : "1px solid color-mix(in oklab, var(--itl-ink) 10%, transparent)",
              }}
            >
              {item}
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}
