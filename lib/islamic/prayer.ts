// حسابات فلكية مبسطة لمواقيت الصلاة واتجاه القبلة بالاعتماد على خط العرض وخط الطول فقط.
// الموقع الافتراضي عند تعذر الوصول للموقع الجغرافي: القاهرة.
export const FALLBACK_LOCATION = { lat: 30.0444, lon: 31.2357, label: "القاهرة (افتراضي)" }
export const KAABA = { lat: 21.4225, lon: 39.8262 }

export type PrayerName = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha"

export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI
}

function julianDay(date: Date) {
  return date.getTime() / 86400000 - date.getTimezoneOffset() / 1440 + 2440587.5
}

function sunDeclination(dayOfYear: number) {
  return -23.44 * Math.cos(toRad((360 / 365) * (dayOfYear + 10)))
}

function hourAngle(lat: number, decl: number, angleBelowHorizon: number) {
  const cosValue =
    (Math.sin(toRad(-angleBelowHorizon)) - Math.sin(toRad(lat)) * Math.sin(toRad(decl))) /
    (Math.cos(toRad(lat)) * Math.cos(toRad(decl)))
  const clamped = Math.max(-1, Math.min(1, cosValue))
  return toDeg(Math.acos(clamped)) / 15
}

function minutesToLabel(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = Math.round(normalized % 60)
  const period = h >= 12 ? "م" : "ص"
  const displayHour = h % 12 === 0 ? 12 : h % 12
  return `${String(displayHour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`
}

export type PrayerTimeEntry = { name: PrayerName; label: string; minutes: number; time: string }

export function calculatePrayerTimes(date: Date, lat: number, lon: number): PrayerTimeEntry[] {
  const jd = julianDay(date)
  const dayOfYear = Math.floor(jd - julianDay(new Date(date.getFullYear(), 0, 0)))
  const decl = sunDeclination(dayOfYear)
  const timezoneOffsetHours = -date.getTimezoneOffset() / 60
  const solarNoon = 12 - lon / 15 + timezoneOffsetHours

  const sunriseAngle = hourAngle(lat, decl, 0.833)
  const fajrAngle = hourAngle(lat, decl, 18)
  const ishaAngle = hourAngle(lat, decl, 17)
  const asrShadowFactor = 1
  const asrAltitude = toDeg(
    Math.atan(1 / (asrShadowFactor + Math.tan(toRad(Math.abs(lat - decl))))),
  )
  const asrAngle = hourAngle(lat, decl, 90 - asrAltitude)

  const raw: { name: PrayerName; minutes: number }[] = [
    { name: "fajr", minutes: (solarNoon - fajrAngle) * 60 },
    { name: "sunrise", minutes: (solarNoon - sunriseAngle) * 60 },
    { name: "dhuhr", minutes: solarNoon * 60 },
    { name: "asr", minutes: (solarNoon + asrAngle) * 60 },
    { name: "maghrib", minutes: (solarNoon + sunriseAngle) * 60 },
    { name: "isha", minutes: (solarNoon + ishaAngle) * 60 },
  ]

  return raw.map((entry) => ({
    ...entry,
    label: PRAYER_LABELS[entry.name],
    time: minutesToLabel(entry.minutes),
  }))
}

export function nextPrayer(entries: PrayerTimeEntry[], date: Date) {
  const nowMinutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
  const upcoming = entries
    .filter((e) => e.name !== "sunrise")
    .find((e) => e.minutes > nowMinutes)
  return upcoming ?? entries.filter((e) => e.name !== "sunrise")[0]
}

export function qiblaBearing(lat: number, lon: number) {
  const phiK = toRad(KAABA.lat)
  const lambdaK = toRad(KAABA.lon)
  const phi = toRad(lat)
  const lambda = toRad(lon)
  const y = Math.sin(lambdaK - lambda)
  const x = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda)
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360
  return bearing
}

export function distanceToKaabaKm(lat: number, lon: number) {
  const R = 6371
  const phi1 = toRad(lat)
  const phi2 = toRad(KAABA.lat)
  const dPhi = toRad(KAABA.lat - lat)
  const dLambda = toRad(KAABA.lon - lon)
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}
