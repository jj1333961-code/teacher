import { NextResponse } from "next/server"

export const runtime = "nodejs"

const promptFor = (incident: Record<string, unknown>) => `حلل حادثة مراقبة امتحان بشكل سريع ومحايد. لا تعتمد على مؤشر واحد. أعد JSON فقط بالشكل {"decision":"violation" أو "uncertain","confidence":0 إلى 1,"reason":"جملة عربية قصيرة"}. المؤشرات الرقمية: ${JSON.stringify(incident)}`

export async function POST(request: Request) {
  try {
    const incident = await request.json()
    const prompt = promptFor(incident)
    const geminiKey = process.env.GEMINI_API_KEY?.trim()
    if (geminiKey) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }) })
      if (res.ok) { const data = await res.json(); const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ""; return NextResponse.json({ provider: "gemini", result: JSON.parse(text.replace(/^```json\s*|```$/g, "").trim()) }) }
    }
    const groqKey = process.env.GROQ_API_KEY?.trim()
    if (groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${groqKey}` }, body: JSON.stringify({ model: "qwen/qwen3.6-27b", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }) })
      if (res.ok) { const data = await res.json(); return NextResponse.json({ provider: "groq", result: JSON.parse(data.choices?.[0]?.message?.content || "{}") }) }
    }
    return NextResponse.json({ provider: "local", result: { decision: "uncertain", confidence: 0, reason: "لا يوجد مزود تحليل متاح" } })
  } catch { return NextResponse.json({ error: "تعذر تحليل الحادثة" }, { status: 400 }) }
}
