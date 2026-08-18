'use client'

import { useState } from 'react'
import { Eye, Fingerprint, ShieldCheck, SlidersHorizontal, TimerReset } from 'lucide-react'

export type AntiCheatConfig = {
  enabled: boolean
  eyeTracking: boolean
  singleTouch: boolean
  warnOnAway: boolean
  sensitivity: 'low' | 'medium' | 'high'
}

export const defaultAntiCheatConfig: AntiCheatConfig = {
  enabled: true,
  eyeTracking: true,
  singleTouch: true,
  warnOnAway: true,
  sensitivity: 'medium',
}

export function AntiCheatSettings({ value, onChange }: { value: AntiCheatConfig; onChange: (value: AntiCheatConfig) => void }) {
  const [saved, setSaved] = useState(false)
  const update = (patch: Partial<AntiCheatConfig>) => { setSaved(false); onChange({ ...value, ...patch }) }
  const save = () => { setSaved(true); window.setTimeout(() => setSaved(false), 2200) }
  const rows = [
    { key: 'eyeTracking', icon: Eye, title: 'متابعة اتجاه النظر', description: 'يراقب وجود الوجه واتجاه العينين محليًا أثناء التسميع.' },
    { key: 'singleTouch', icon: Fingerprint, title: 'لمسة إصبع واحدة', description: 'يسمح باللمس الطبيعي في أي مكان، وينبه عند غياب اللمسة أو تعددها.' },
    { key: 'warnOnAway', icon: TimerReset, title: 'تنبيه عند الابتعاد', description: 'يظهر تنبيهًا واضحًا عند الابتعاد عن الشاشة أو فقدان التوافق.' },
  ] as const
  return <section aria-labelledby="anti-cheat-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="flex gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShieldCheck /></div><div><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">تسميع / حماية الاختبار</p><h2 id="anti-cheat-title" className="mt-1 text-xl font-bold">إعدادات فحص الغش</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">تُطبّق هذه الإعدادات على جميع عناصر التسميع والأسئلة دون استثناء.</p></div></div>
      <button type="button" aria-pressed={value.enabled} onClick={() => update({ enabled: !value.enabled })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${value.enabled ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-1 size-5 rounded-full bg-background transition ${value.enabled ? 'right-1' : 'right-6'}`} /></button>
    </div>
    <div className={`mt-5 flex flex-col gap-3 ${!value.enabled ? 'opacity-50' : ''}`}>
      {rows.map(({ key, icon: Icon, title, description }) => <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/80 p-3.5 transition hover:bg-secondary/60"><span className="flex items-center gap-3"><Icon className="text-primary" /><span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span></span></span><input type="checkbox" checked={value[key]} disabled={!value.enabled} onChange={(event) => update({ [key]: event.target.checked })} className="size-4 accent-primary" /></label>)}
    </div>
    <div className="mt-4 flex flex-col gap-3 rounded-xl bg-secondary/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm font-medium"><SlidersHorizontal className="text-primary" /> حساسية التنبيه</div><div className="flex rounded-lg border border-border bg-background p-1" role="group" aria-label="حساسية التنبيه">{(['low', 'medium', 'high'] as const).map((level) => <button key={level} type="button" onClick={() => update({ sensitivity: level })} disabled={!value.enabled} className={`rounded-md px-3 py-1.5 text-xs transition ${value.sensitivity === level ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{level === 'low' ? 'هادئة' : level === 'medium' ? 'متوسطة' : 'مشددة'}</button>)}</div></div>
    <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs leading-5 text-muted-foreground">المعالجة تجريبية داخل المتصفح ولا يتم رفع صور أو فيديو.</p><button type="button" onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{saved ? 'تم الحفظ' : 'حفظ الإعدادات'}</button></div>
  </section>
}

export function AntiCheatSummary({ config }: { config: AntiCheatConfig }) { return <div className="rounded-xl border border-border bg-secondary/50 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="text-primary" /> الحماية مفعّلة <span className="mr-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{config.sensitivity === 'high' ? 'مشددة' : config.sensitivity === 'low' ? 'هادئة' : 'متوسطة'}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">العين واللمس وتغيّر التركيز تُطبّق على كل الأسئلة.</p></div> }
