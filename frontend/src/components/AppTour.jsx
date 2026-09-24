import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import './AppTour.css'

export const TOUR_STEPS = [
  ['/home', 'calendar', 'Your training at a glance', 'Your streak rewards scheduled days. Open the calendar to plan and review.'],
  ['/plan', 'routine', 'Build your week', 'Combine strength, running and recovery in your routines and weekly plan.'],
  ['/home', 'start', 'Start or resume', 'Start today’s routine here. Your active workout stays available.'],
  ['/stats', 'progress', 'See your progress', 'Review strength and activity metrics, history and reports.'],
  ['/plan', 'pause', 'Take a training break', 'Pause for illness or travel. Protect your streak and resume when ready.'],
  ['/settings', 'health', 'Make TGym yours', 'Log other activities, connect supported health data and adjust your preferences.'],
]
export function replayAppTour() { useUI.setState({ appTourRequest: Date.now() }) }
export default function AppTour() {
  const nav = useNavigate(), location = useLocation(), originalPath = useRef(location.pathname)
  const S = useStore(s => s.S), requested = useUI(s => s.appTourRequest)
  const sheets = useUI(s => s.sheets.length)
  const [step, setStep] = useState(0), [rect, setRect] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const dialog = useRef(null)
  const [finishing, setFinishing] = useState(false)
  const active = finishing || !!requested || (S.hasCompletedOnboarding && !S.hasCompletedAppTour)
  useEffect(() => { if (requested) { originalPath.current = location.pathname; setStep(0) } }, [requested])
  useEffect(() => {
    if (!active || sheets) return
    nav(TOUR_STEPS[step][0])
  }, [active, step, sheets, nav])
  useEffect(() => {
    if (!active || sheets) return
    let target
    const refresh = () => {
      target = document.querySelector(`[data-tour="${TOUR_STEPS[step][1]}"]`)
      const bounds = target?.getBoundingClientRect()
      setRect(bounds ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height } : null)
    }
    const timer = setTimeout(() => { document.querySelector(`[data-tour="${TOUR_STEPS[step][1]}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' }); refresh(); dialog.current?.querySelector('button')?.focus() }, 60)
    window.addEventListener('resize', refresh); document.addEventListener('scroll', refresh, true)
    const before = document.activeElement
    const blocked = ['app', 'tabbar'].map(id => document.getElementById(id)).filter(Boolean)
    blocked.forEach(el => { el.inert = true })
    return () => { clearTimeout(timer); window.removeEventListener('resize', refresh); document.removeEventListener('scroll', refresh, true); blocked.forEach(el => { el.inert = false }); if (before?.isConnected) before.focus?.() }
  }, [active, step, location.pathname, sheets])
  if (!active || sheets) return null
  const finish = async () => {
    setFinishing(true); setBusy(true); setError('')
    try {
      useStore.getState().update(s => { s.hasCompletedAppTour = true })
      await useStore.getState().flushPersistence()
      useUI.setState({ appTourRequest: null })
      setFinishing(false); nav(originalPath.current)
    } catch { setError(t('Could not save. Check available storage and try again.')) }
    finally { setBusy(false) }
  }
  const keys = e => {
    if (e.key === 'Escape') { e.preventDefault(); if (!busy) void finish() }
    if (e.key === 'Tab') {
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled)')]
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus() }
      else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0]?.focus() }
    }
  }
  return <div className="app-tour" onKeyDown={keys}>
    {!rect && <div className="tour-shade" />}
    {rect && <div className="tour-focus" aria-hidden="true" style={{ top: rect.top - 5, left: rect.left - 5, width: rect.width + 10, height: rect.height + 10 }} />}
    <section ref={dialog} className={'tour-panel' + (rect && rect.top > window.innerHeight / 2 ? ' at-top' : '')} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-copy">
      <div className="tour-count">{t('App tour')} · {step + 1} / {TOUR_STEPS.length}</div>
      <h2 id="tour-title">{t(TOUR_STEPS[step][2])}</h2><p id="tour-copy">{t(TOUR_STEPS[step][3])}</p>
      <progress value={step + 1} max={TOUR_STEPS.length} aria-label={t('App tour')} />
      {error && <p role="alert">{error}</p>}
      <div className="tour-actions"><Button disabled={busy} onClick={finish}>{t('Skip')}</Button><Button disabled={busy || step === 0} onClick={() => setStep(s => s - 1)}>{t('Back')}</Button><Button variant="primary" disabled={busy} onClick={() => step === TOUR_STEPS.length - 1 ? finish() : setStep(s => s + 1)}>{t(step === TOUR_STEPS.length - 1 ? 'Done' : 'Next')}</Button></div>
    </section>
  </div>
}
