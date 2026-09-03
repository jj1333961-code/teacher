import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SERVICE_VARIABLES = {
  core: ["DATABASE_URL"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  ai: ["GEMINI_API_KEY", "GROQ_API_KEY"],
  github: [
    "GITHUB_TOKEN",
    "GITHUB_OWNER",
    "GITHUB_REPO",
    "GITHUB_BRANCH",
    "GITHUB_PUBLISHER_EMAILS",
    "DEV_ASSISTANT_AUTO_APPLY",
  ],
  optional: [
    "BLOB_READ_WRITE_TOKEN",
    "SPEAKER_VERIFICATION_API_KEY",
    "SPEAKER_VERIFICATION_URL",
    "VERCEL_DEPLOY_HOOK_URL",
  ],
} as const

function status(name: string) {
  return { name, configured: Boolean(process.env[name]?.trim()) }
}

export async function GET() {
  const services = Object.fromEntries(
    Object.entries(SERVICE_VARIABLES).map(([service, variables]) => [service, variables.map(status)]),
  )

  return NextResponse.json(
    {
      serverSide: true,
      services,
      notes: {
        coreRequiredForApp: ["DATABASE_URL"],
        googleAiGithubAreFeatureScoped: true,
      },
      secretsNeverReturned: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
