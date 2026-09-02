import { NextRequest, NextResponse } from "next/server"

const CANONICAL_ORIGIN = "https://teacher-three-ashen.vercel.app"
const CANONICAL_HOST = "teacher-three-ashen.vercel.app"
const OLD_HOSTS = ["teacher.vercel.app", "teacher-nine-blush.vercel.app"]
const LEGACY_PAGE_ROUTES: Record<string, string> = {
  lockScreen: "/login",
  accountRecoveryPage: "/forgot-password",
  signupStep1: "/signup",
  signupStep2: "/signup/details",
  adminLogin: "/login/admin",
  adminDashboard: "/admin",
  adminAIPage: "/admin/ai",
  devAssistantPage: "/admin/developer",
  githubSyncPage: "/admin/github",
  notificationsPage: "/admin/notifications",
  adminsPage: "/admin/admins",
  adminSettings: "/admin/settings",
  addStudent: "/admin/students/new",
  editStudent: "/admin/students/edit",
  recordSession: "/admin/records/new",
  studentHistory: "/admin/students/history",
  studentsList: "/admin/students",
  messagesPage: "/admin/messages",
  subjectsPage: "/admin/subjects",
  filesPage: "/admin/files",
  studentLogin: "/login/student",
  studentDashboard: "/student",
  studentExamPage: "/student/exams/current",
  studentRecordsPage: "/student/records",
  studentFilesPage: "/student/files",
  studentInbox: "/student/messages",
  studentAIChat: "/student/ai",
  studentSettings: "/student/settings",
  parentLogin: "/login/parent",
  parentDashboard: "/parent",
  parentFilesPage: "/parent/files",
  parentInbox: "/parent/messages",
  parentAIChat: "/parent/ai",
  parentRecordsPage: "/parent/records",
  parentPendingTasksPage: "/parent/tasks",
  parentChartPage: "/parent/chart",
  quranReaderPage: "/quran-reader",
  tuhfatPage: "/tuhfat",
}

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
    if (legacyPage) {
      target.searchParams.delete("page")
      const mappedRoute = LEGACY_PAGE_ROUTES[legacyPage]
      if (mappedRoute) target.pathname = mappedRoute
    }
    return NextResponse.redirect(target, 308)
  }
  if (request.nextUrl.hostname !== CANONICAL_HOST && OLD_HOSTS.includes(request.nextUrl.hostname)) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN)
    return NextResponse.redirect(target, 308)
  }

  // Route-to-shell mapping belongs in next.config.mjs. Keeping proxy focused
  // on canonical redirects prevents two rewrite systems from competing and
  // makes direct requests resolve through one deterministic Next.js pipeline.
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
