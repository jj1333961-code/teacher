export type AntiCheatSeverity = 'NORMAL' | 'WARNING' | 'SUSPICIOUS' | 'CHEATING_DETECTED'

export type AntiCheatConfig = {
  enabled: boolean
  requireCamera: boolean
  facePresence: boolean
  multipleFaces: boolean
  gaze: boolean
  headPose: boolean
  eyeClosure: boolean
  focus: boolean
  fullscreen: boolean
  singleTouch: boolean
  warningThreshold: number
  suspiciousThreshold: number
  cheatingThreshold: number
  graceMs: number
  blockMs: number
  autoRestore: boolean
  analysisIntervalMs: number
  sensitivity: 'low' | 'medium' | 'high'
}

export const defaultAntiCheatConfig: AntiCheatConfig = {
  enabled: false, requireCamera: true, facePresence: true, multipleFaces: true, gaze: true,
  headPose: true, eyeClosure: true, focus: true, fullscreen: false, singleTouch: false,
  warningThreshold: 20, suspiciousThreshold: 45, cheatingThreshold: 75, graceMs: 2500,
  blockMs: 8000, autoRestore: true, analysisIntervalMs: 150, sensitivity: 'medium',
}

export type Signal = { type: string; active: boolean; durationMs?: number; weight?: number }
export function severityFor(score: number, config: AntiCheatConfig): AntiCheatSeverity {
  if (score >= config.cheatingThreshold) return 'CHEATING_DETECTED'
  if (score >= config.suspiciousThreshold) return 'SUSPICIOUS'
  if (score >= config.warningThreshold) return 'WARNING'
  return 'NORMAL'
}
export function calculateRiskScore(signals: Signal[], previous = 0) {
  const active = signals.filter((signal) => signal.active)
  const base = active.reduce((sum, signal) => sum + (signal.weight ?? 10) * Math.min(2, 1 + (signal.durationMs ?? 0) / 10000), 0)
  const distinct = new Set(active.map((signal) => signal.type)).size
  const combinationBonus = distinct >= 3 ? 20 : distinct >= 2 ? 8 : 0
  return Math.max(0, Math.min(100, Math.round(previous * 0.82 + base + combinationBonus)))
}
export function shouldRecord(signal: Signal, config: AntiCheatConfig) {
  return signal.active && (signal.durationMs ?? 0) >= config.graceMs
} 
export function isRecoverable(score: number, config: AntiCheatConfig) {
  return config.autoRestore && score < config.suspiciousThreshold
}
