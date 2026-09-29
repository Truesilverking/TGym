import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import './AppTour.css'

export const TOUR_STEPS = [
  ['/home','calendar','Your training at a glance','Your streak rewards scheduled days. Open the calendar to plan and review.'],
  ['/home','navigation','Move around TGym','Home, routines, training, stats and exercises stay one tap away.'],
  ['/plan','routine','Build your week','Create routines, assign training days and reorder with arrows or a short hold and drag.'],
  ['/home','start','Start or resume','Start today’s routine here. Your active workout stays available.'],
  ['/workout','sets','Log each set','Enter weight, reps and RIR, then check the set when completed. This preview saves nothing.'],
  ['/workout','set-types','Know your set types','Warm-up prepares you. Top sets are heavier; back-off sets reduce the load. Working sets count toward completion.'],
  ['/workout','supersets','Pair and recover','Pair with the previous or next exercise. Rest counts down between sets; adjust it or skip when ready.'],
  ['/stats','history','Review your sessions','Open History to review completed sessions. Statistics summarize your recorded training.'],
  ['/progress','report','Explore your progress','Choose a period and section. Expand details or download selected sections as a PDF.'],
  ['/stats','measurements','Track body measurements','Log a dated reading and compare body zones. Existing dates open for editing.'],
  ['/stats','inbody','Keep InBody history','Add dated InBody results to compare body composition over time.'],
  ['/settings','health','Make TGym yours','Choose your theme and preferences. Local tracking works offline once ready; reconnect to check for updates.'],
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
  useEffect(()=>{useUI.setState({appTourWorkoutPreview:active && TOUR_STEPS[step][0]==='/workout'});return()=>useUI.setState({appTourWorkoutPreview:false})},[active,step])
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
      setRect(bounds && bounds.width>0 ? { top:Math.max(8,bounds.top), left:Math.max(8,bounds.left), width:Math.min(bounds.width,window.innerWidth-16), height:Math.max(0,Math.min(bounds.height,window.innerHeight-Math.max(8,bounds.top)-8,Math.max(44,window.innerHeight-(dialog.current?.offsetHeight||280)-48))) } : null)
    }
    const timer = setTimeout(() => { document.querySelector(`[data-tour="${TOUR_STEPS[step][1]}"]`)?.scrollIntoView({ block: 'start', behavior: 'instant' }); refresh(); dialog.current?.querySelector('button')?.focus() }, 60)
    const observer=new MutationObserver(refresh);const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true})
    const reposition=()=>{document.querySelector(`[data-tour="${TOUR_STEPS[step][1]}"]`)?.scrollIntoView({block:'start',behavior:'instant'});refresh()}
    window.addEventListener('resize', reposition); document.addEventListener('scroll', refresh, true)
    const before = document.activeElement
    const blocked = ['app', 'tabbar'].map(id => document.getElementById(id)).filter(Boolean)
    blocked.forEach(el => { el.inert = true })
    return () => { observer.disconnect();clearTimeout(timer); window.removeEventListener('resize', reposition); document.removeEventListener('scroll', refresh, true); blocked.forEach(el => { el.inert = false }); if (before?.isConnected) before.focus?.() }
  }, [active, step, location.pathname, sheets])
  if (!active || sheets) return null
  const finish = async () => {
    setFinishing(true); setBusy(true); setError('')
    try {
      useStore.getState().update(s => { s.hasCompletedAppTour = true })
      await useStore.getState().flushPersistence()
      useUI.setState({ appTourRequest: null, appTourWorkoutPreview:false })
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
