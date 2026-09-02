import { redirect } from 'next/navigation'

// يبقى مسار App Router احتياطياً فقط؛ المسار العام يُعاد كتابته إلى app.html.
export default function Page() {
  redirect('/')
}
