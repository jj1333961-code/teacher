import { normalizeQuranText } from "@/lib/quran-reference"

// ===== بناء متشابهات حقيقية من المصحف كاملاً (مصدر شبكي موثوق) =====
// الهدف: أسئلة شديدة الصعوبة مبنية على مقاطع متشابهة لفظياً موجودة فعلاً في
// القرآن، لا على آيات مشهورة سهلة. نحمّل المصحف كاملاً من Al Quran Cloud مرة
// واحدة، ونبني فهرس مقاطع (shingles) من أربع كلمات، ثم نستخرج لكل آية أقرب
// الآيات المشابهة لها في مواضع أخرى.

export type AyahRef = { surahNumber: number; surah: string; ayah: number; text: string }
export type SimilarityGroup = { target: AyahRef; similar: AyahRef[]; sharedPhrase: string }

const SHINGLE = 4
const CACHE_TTL = 12 * 60 * 60 * 1000

// سور مشهورة جداً أو قصيرة يحفظها الجميع؛ نستبعدها من أسئلة المستوى الصعب.
export const FAMOUS_SURAHS = new Set([1, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114])
// آيات مشهورة بعينها لا تصلح لسؤال صعب.
export const FAMOUS_AYAHS = new Set([
  "2:255", "2:256", "2:286", "3:26", "3:185", "9:128", "17:80", "18:10", "20:114",
  "21:87", "23:118", "24:35", "25:74", "36:82", "39:53", "40:60", "48:1", "55:13",
  "59:23", "65:3", "67:1", "94:5", "94:6", "103:1",
])

type QuranCache = { ayahs: AyahRef[]; index: Map<string, number[]>; loadedAt: number }
let cache: QuranCache | null = null
let pending: Promise<QuranCache> | null = null

function shinglesOf(normalized: string) {
  const words = normalized.split(" ").filter((word) => word.length > 1)
  const list: string[] = []
  for (let i = 0; i + SHINGLE <= words.length; i++) list.push(words.slice(i, i + SHINGLE).join(" "))
  return list
}

async function loadQuran(): Promise<QuranCache> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL) return cache
  if (!pending) {
    pending = (async () => {
      const response = await fetch("https://api.alquran.cloud/v1/quran/quran-uthmani", {
        cache: "force-cache",
        signal: AbortSignal.timeout(20_000),
      })
      const data = await response.json().catch(() => null)
      const surahs = Array.isArray(data?.data?.surahs) ? data.data.surahs : []
      if (!response.ok || !surahs.length) throw new Error("تعذر تحميل المصحف الكامل من المصدر الشبكي")
      const ayahs: AyahRef[] = []
      for (const surah of surahs) {
        const surahNumber = Number(surah?.number) || 0
        const name = String(surah?.name || "")
        for (const ayah of Array.isArray(surah?.ayahs) ? surah.ayahs : []) {
          ayahs.push({
            surahNumber,
            surah: name,
            ayah: Number(ayah?.numberInSurah) || 0,
            text: String(ayah?.text || "").trim(),
          })
        }
      }
      const index = new Map<string, number[]>()
      ayahs.forEach((entry, position) => {
        for (const shingle of new Set(shinglesOf(normalizeQuranText(entry.text)))) {
          const bucket = index.get(shingle)
          if (bucket) bucket.push(position)
          else index.set(shingle, [position])
        }
      })
      cache = { ayahs, index, loadedAt: Date.now() }
      return cache
    })().finally(() => { pending = null })
  }
  return pending
}

/**
 * يستخرج مجموعات متشابهات حقيقية داخل نطاق السور المطلوب.
 * كل مجموعة = آية هدف + آيات أخرى تشترك معها في مقطع لفظي طويل.
 */
export async function findMutashabihat(surahNumbers: number[], limit = 18): Promise<SimilarityGroup[]> {
  const { ayahs, index } = await loadQuran()
  const wanted = new Set(surahNumbers.filter((number) => !FAMOUS_SURAHS.has(number)))
  if (!wanted.size) return []
  const groups: SimilarityGroup[] = []

  ayahs.forEach((entry, position) => {
    if (groups.length >= limit * 4) return
    if (!wanted.has(entry.surahNumber)) return
    if (FAMOUS_AYAHS.has(`${entry.surahNumber}:${entry.ayah}`)) return
    const normalized = normalizeQuranText(entry.text)
    const words = normalized.split(" ").filter(Boolean)
    // نتجاهل الآيات القصيرة جداً؛ لا تحمل فارقاً لفظياً يصلح لسؤال صعب.
    if (words.length < 6) return

    const scores = new Map<number, number>()
    const phrases = new Map<number, string>()
    for (const shingle of shinglesOf(normalized)) {
      for (const other of index.get(shingle) || []) {
        if (other === position) continue
        const candidate = ayahs[other]
        // نستبعد الآية المجاورة مباشرة في نفس السورة (ليست متشابهاً).
        if (candidate.surahNumber === entry.surahNumber && Math.abs(candidate.ayah - entry.ayah) <= 1) continue
        if (FAMOUS_SURAHS.has(candidate.surahNumber)) continue
        scores.set(other, (scores.get(other) || 0) + 1)
        if (!phrases.has(other)) phrases.set(other, shingle)
      }
    }
    if (!scores.size) return
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    const best = ranked[0]
    if (!best || best[1] < 1) return
    groups.push({
      target: entry,
      similar: ranked.map(([other]) => ayahs[other]),
      sharedPhrase: phrases.get(best[0]) || "",
    })
  })

  // نوزّع المجموعات على سور مختلفة ثم نخلطها حتى لا تتكرر نفس السورة.
  const bySurah = new Map<number, SimilarityGroup[]>()
  for (const group of groups) {
    const bucket = bySurah.get(group.target.surahNumber) || []
    bucket.push(group)
    bySurah.set(group.target.surahNumber, bucket)
  }
  const spread: SimilarityGroup[] = []
  let added = true
  while (spread.length < limit && added) {
    added = false
    for (const bucket of bySurah.values()) {
      if (!bucket.length || spread.length >= limit) continue
      const pick = bucket.splice(Math.floor(Math.random() * bucket.length), 1)[0]
      if (pick) { spread.push(pick); added = true }
    }
  }
  return spread
}

/** يحوّل المتشابهات إلى سياق نصي مختصر يُرسل للنموذج لصياغة أسئلة صعبة. */
export function formatMutashabihatContext(groups: SimilarityGroup[]) {
  if (!groups.length) return ""
  return `متشابهات حقيقية مستخرجة آلياً من المصحف الكامل (استخدمها أساساً للأسئلة الصعبة والمشتتات):\n${groups
    .map((group) => {
      const others = group.similar
        .map((entry) => `${entry.surah} ${entry.ayah}: ${entry.text}`)
        .join(" | ")
      return `• ${group.target.surah} ${group.target.ayah}: ${group.target.text}\n  المشترك اللفظي: «${group.sharedPhrase}»\n  المشابه لها: ${others}`
    })
    .join("\n")}`.slice(0, 20_000)
}
