'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Eye, Fingerprint, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { AntiCheatConfig } from './anti-cheat-settings'

type MonitorState = 'idle' | 'loading' | 'focused' | 'away' | 'no-face' | 'blocked' | 'unsupported'

const stateCopy: Record<MonitorState, string> = {
  idle: 'جاهز لبدء الفحص',
  loading: 'جاري تهيئة التعرّف الدقيق…',
  focused: 'النظر داخل نطاق الشاشة',
  away: 'النظر بعيد عن الشاشة',
  'no-face': 'الوجه غير ظاهر بالكامل',
  blocked: 'تعذّر الوصول إلى الكاميرا',
  unsupported: 'المتصفح لا يدعم الكاميرا',
}

export function StudentProctor({ config }: { config: AntiCheatConfig }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const warningStartedAt = useRef<number | null>(null)
  const [monitorState, setMonitorState] = useState<MonitorState>('idle')
  const [touches, setTouches] = useState(0)
  const [warnings, setWarnings] = useState(0)
  const [warning, setWarning] = useState('')
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    setIsTouchDevice(navigator.maxTouchPoints > 0)
  }, [])

  useEffect(() => {
    if (!config.enabled || !config.eyeTracking) {
      setMonitorState('idle')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMonitorState('unsupported')
      return
    }

    let active = true
    let stream: MediaStream | undefined
    let animationFrame = 0
    let landmarker: import('@mediapipe/tasks-vision').FaceLandmarker | undefined
    let lastDetectionAt = 0

    const issueWarning = (message: string) => {
      if (!warningStartedAt.current) warningStartedAt.current = performance.now()
      const delay = config.sensitivity === 'high' ? 700 : config.sensitivity === 'low' ? 2200 : 1300
      if (performance.now() - warningStartedAt.current < delay) return
      warningStartedAt.current = performance.now() + 3000
      setWarning(message)
      setWarnings((value) => value + 1)
    }

    async function startMonitoring() {
      try {
        setMonitorState('loading')
        const vision = await import('@mediapipe/tasks-vision')
        const fileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm',
        )
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.65,
          minTrackingConfidence: 0.65,
        })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        if (!active || !videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        const detect = () => {
          if (!active || !videoRef.current || !landmarker) return
          const now = performance.now()
          if (videoRef.current.readyState >= 2 && now - lastDetectionAt > 100) {
            lastDetectionAt = now
            const result = landmarker.detectForVideo(videoRef.current, now)
            const landmarks = result.faceLandmarks[0]
            const canvas = canvasRef.current
            const context = canvas?.getContext('2d')
            if (canvas && context) {
              canvas.width = videoRef.current.videoWidth
              canvas.height = videoRef.current.videoHeight
              context.clearRect(0, 0, canvas.width, canvas.height)
            }

            if (!landmarks) {
              setMonitorState('no-face')
              issueWarning('لم يعد الوجه ظاهرًا أمام الشاشة. أعد توجيه وجهك للكاميرا.')
            } else {
              const leftIris = landmarks[468]
              const rightIris = landmarks[473]
              const leftOuter = landmarks[33]
              const leftInner = landmarks[133]
              const rightInner = landmarks[362]
              const rightOuter = landmarks[263]
              const leftRatio = (leftIris.x - leftOuter.x) / Math.max(leftInner.x - leftOuter.x, 0.001)
              const rightRatio = (rightIris.x - rightInner.x) / Math.max(rightOuter.x - rightInner.x, 0.001)
              const gazeRatio = (leftRatio + rightRatio) / 2
              const nose = landmarks[1]
              const faceLeft = landmarks[234]
              const faceRight = landmarks[454]
              const headRatio = (nose.x - faceLeft.x) / Math.max(faceRight.x - faceLeft.x, 0.001)
              const threshold = config.sensitivity === 'high' ? 0.12 : config.sensitivity === 'low' ? 0.22 : 0.17
              const lookingAway = Math.abs(gazeRatio - 0.5) > threshold || Math.abs(headRatio - 0.5) > threshold + 0.08

              if (canvas && context) {
                context.fillStyle = lookingAway ? 'rgb(239 68 68)' : 'rgb(34 197 94)'
                for (const iris of [leftIris, rightIris]) {
                  context.beginPath()
                  context.arc(iris.x * canvas.width, iris.y * canvas.height, 4, 0, Math.PI * 2)
                  context.fill()
                }
              }

              if (lookingAway) {
                setMonitorState('away')
                issueWarning('تم رصد ابتعاد النظر عن الشاشة. ركّز نظرك داخل نطاق الاختبار.')
              } else {
                warningStartedAt.current = null
                setMonitorState('focused')
              }
            }
          }
          animationFrame = requestAnimationFrame(detect)
        }
        detect()
      } catch {
        if (active) setMonitorState('blocked')
      }
    }

    startMonitoring()
    return () => {
      active = false
      cancelAnimationFrame(animationFrame)
      stream?.getTracks().forEach((track) => track.stop())
      landmarker?.close()
    }
  }, [config.enabled, config.eyeTracking, config.sensitivity])

  useEffect(() => {
    if (!config.enabled || !config.singleTouch || !isTouchDevice) return
    const onTouch = (event: TouchEvent) => {
      setTouches(event.touches.length)
      if (event.touches.length > 1) {
        setWarning('استخدم إصبعًا واحدًا فقط. تم رصد أكثر من نقطة لمس.')
        setWarnings((value) => value + 1)
      }
    }
    const onEnd = (event: TouchEvent) => setTouches(event.touches.length)
    window.addEventListener('touchstart', onTouch, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchend', onEnd)
    }
  }, [config.enabled, config.singleTouch, isTouchDevice])

  if (!config.enabled) return null

  const isSafe = monitorState === 'focused'
  return (
    <section aria-labelledby="student-monitor-title" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-wider text-primary">وضع الطالب</p>
          <h2 id="student-monitor-title" className="mt-1 text-lg font-bold">المراقبة الذكية للتسميع</h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
          <CheckCircle2 aria-hidden="true" /> معالجة محلية
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl bg-secondary">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full scale-x-[-1] object-cover" aria-label="معاينة كاميرا الطالب" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full scale-x-[-1]" aria-hidden="true" />
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg bg-background/90 px-3 py-2 text-xs backdrop-blur">
            {isSafe ? <Eye className="text-primary" aria-hidden="true" /> : <Camera className="text-destructive" aria-hidden="true" />}
            {stateCopy[monitorState]}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Eye className={isSafe ? 'text-primary' : 'text-destructive'} aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">تحليل بؤبؤ العين واتجاه الرأس</p>
              <p className="text-xs leading-5 text-muted-foreground">يرصد الابتعاد المستمر، وليس الحركة الطبيعية السريعة.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Fingerprint className="text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{isTouchDevice ? `نقاط اللمس الحالية: ${touches}` : 'جهاز بدون لمس'}</p>
              <p className="text-xs leading-5 text-muted-foreground">يمكن لمس أي جزء واستخدام الموقع طبيعيًا، بإصبع واحد فقط.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
            <ShieldAlert className="text-primary" aria-hidden="true" />
            <p className="text-sm">التنبيهات المسجلة في هذه الجلسة: <strong>{warnings}</strong></p>
          </div>
        </div>
      </div>

      {warning && config.warnOnAway && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <TriangleAlert aria-hidden="true" />
          <span>{warning}</span>
          <button type="button" onClick={() => setWarning('')} className="mr-auto shrink-0 underline underline-offset-4">فهمت</button>
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">هذا فحص سلوكي مساعد وليس دليلًا قطعيًا على الغش. لا تُرفع صور أو فيديو إلى الخادم.</p>
    </section>
  )
}
