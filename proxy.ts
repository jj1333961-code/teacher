import { NextRequest, NextResponse } from "next/server"

const OLD_HOST = "teacher.vercel.app"
const CANONICAL_ORIGIN = "https://teacher-three-ashen.vercel.app"

export function proxy(request: NextRequest) {
  const legacyRoutes: Record<string, string> = {
    "/index.html": "/login",
    "/app.html": "/login",
    "/admin.html": "/admin",
    "/student.html": "/student",
    "/parent.html": "/parent",
  }
  const cleanPath = legacyRoutes[request.nextUrl.pathname]
  if (cleanPath) {
    const target = request.nextUrl.clone()
    target.pathname = cleanPath
    const legacyPage = target.searchParams.get("page")
    if (legacyPage) target.searchParams.delete("page")
    return NextResponse.redirect(target, 308)
  }
  if (request.nextUrl.hostname !== OLD_HOST) return NextResponse.next()

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN)
  return NextResponse.redirect(target, 308)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
