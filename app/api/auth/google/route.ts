import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
const COOKIE = "teacher_google_state"
const SESSION = "teacher_google_session"
// Google OAuth requires the redirect_uri to match, byte-for-byte, an entry
// registered in Cloud Console's "Authorized redirect URIs" list. Deriving it
// from request headers is fragile (Vercel's proxy can report an internal
// http:// origin or a preview hostname that was never registered), so we
// pin it to the single canonical production domain instead. Only local dev
// (localhost/127.0.0.1) is allowed to use its own origin, since that's the
// second URI you register in Cloud Console for testing.
const CANONICAL_DOMAIN = "https://teacher-three-ashen.vercel.app"
function appOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1")
  return isLocalHost ? new URL(request.url).origin : CANONICAL_DOMAIN
}

function appPage(request: NextRequest) {
  return `${appOrigin(request)}/app.html`
}

function callbackUrl(request: NextRequest) {
  return `${appOrigin(request)}/api/auth/google`
}

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw new Error("Google OAuth غير مهيأ على الخادم")
  return { clientId, clientSecret }
}
function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url")
}
function sessionValue(email: string, name: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({ email, name, issuedAt: Date.now() })).toString("base64url")
  return `${payload}.${sign(payload, secret)}`
}
function verify(value: string, secret: string) {
  const [payload, signature] = value.split(".")
  if (!payload || !signature) return null
  const expected = sign(payload, secret)
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return typeof parsed.email === "string" ? parsed : null
  } catch { return null }
}
function redirectUri(request: NextRequest) { return callbackUrl(request) }

export async function GET(request: NextRequest) {
  const page = appPage(request)
  try {
    const { clientId, clientSecret } = config()
    const redirect = redirectUri(request)
    const url = new URL(request.url)
    // Older bookmarks may still start OAuth on teacher.vercel.app. Move the
    // browser to the canonical production origin before creating state/cookies.
    if (url.hostname === "teacher.vercel.app") {
      const canonical = new URL(`${redirect}${url.search}`)
      return NextResponse.redirect(canonical)
    }
    const code = url.searchParams.get("code")
    const error = url.searchParams.get("error")
    if (!code) {
      const state = randomBytes(24).toString("base64url")
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth")
      auth.searchParams.set("client_id", clientId)
      auth.searchParams.set("redirect_uri", redirect)
      auth.searchParams.set("response_type", "code")
      auth.searchParams.set("scope", "openid email profile")
      auth.searchParams.set("state", state)
      if (error) { const response = NextResponse.redirect(`${page}?google_error=cancelled`); response.cookies.delete(COOKIE); return response }
      const response = NextResponse.redirect(auth)
      response.cookies.set(COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 })
      return response
    }
    const state = request.cookies.get(COOKIE)?.value
    const returnedState = url.searchParams.get("state")
    if (!state || !returnedState || state !== returnedState) return NextResponse.redirect(`${page}?google_error=invalid_state`)
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }), cache: "no-store" })
    if (!tokenResponse.ok) return NextResponse.redirect(`${page}?google_error=token_exchange`)
    const tokens = await tokenResponse.json()
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" })
    if (!userResponse.ok) return NextResponse.redirect(`${page}?google_error=userinfo`)
    const user = await userResponse.json()
    if (typeof user.email !== "string" || user.email_verified !== true) return NextResponse.redirect(`${page}?google_error=email_not_verified`)
    const response = NextResponse.redirect(`${page}?google=success`)
    response.cookies.set(SESSION, sessionValue(user.email, typeof user.name === "string" ? user.name : "", clientSecret), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 })
    response.cookies.delete(COOKIE)
    return response
  } catch { return NextResponse.redirect(`${page}?google_error=not_configured`) }
}

export async function POST(request: NextRequest) {
  try {
    const { clientId } = config()
    return NextResponse.json({ configured: Boolean(clientId), redirectUri: redirectUri(request) }, { headers: { "cache-control": "no-store" } })
  } catch { return NextResponse.json({ configured: false }, { status: 503 }) }
}

export async function session(request: NextRequest) {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const value = request.cookies.get(SESSION)?.value
  return secret && value ? verify(value, secret) : null
}
