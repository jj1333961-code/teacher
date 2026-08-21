import type { Metadata } from "next"
import { Amiri, Reem_Kufi } from "next/font/google"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import "./tools.css"

const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-quran" })
const reemKufi = Reem_Kufi({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-kufi" })

export const metadata: Metadata = {
  title: "الأدوات الإسلامية | ثمار",
  description: "مواقيت الصلاة، القبلة، القرآن الكريم، الأذكار والأدعية والمزيد من الأدوات الإسلامية.",
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${amiri.variable} ${reemKufi.variable} islamic-tools-scope min-h-screen`}>
      <header className="islamic-tools-header">
        <Link href="/index.html" className="islamic-tools-back">
          <ArrowRight className="size-4" aria-hidden="true" />
          <span>العودة إلى المنصة</span>
        </Link>
      </header>
      <main className="islamic-tools-main">{children}</main>
    </div>
  )
}
