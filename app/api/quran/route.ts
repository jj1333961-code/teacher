import { getLocalQuranSurah } from "@/lib/quran-reference"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const surahNumber = Number(new URL(request.url).searchParams.get("surah"))
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return Response.json({ error: "رقم السورة غير صالح" }, { status: 400 })
  }

  try {
    const surah = await getLocalQuranSurah(surahNumber)
    return Response.json(surah, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر قراءة المصحف المحلي"
    return Response.json({ error: message }, { status: 500 })
  }
}
