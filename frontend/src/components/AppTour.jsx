import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import './AppTour.css'

export const TOUR_STEPS = [
  ['/home','navigation','Your training at a glance','Swipe between sections. Open a bottom menu to jump directly; the center button stays fixed.','Training'],
  ['/home','start','Start or resume','Start planned or freestyle training. Active sessions remain available here.','Training'],
  ['/workout','sets','Log each set','Record load, reps, time, cardio and effort; distinguish warm-up, top and back-off sets.','Training'],
  ['/workout','supersets','Pair and recover','Pair exercises, rest, substitute, pause or finish. This preview saves nothing.','Training'],
  ['/plan','routine','Build your routines','Create, edit or choose guided routines; configure progression and intensity techniques.','Planning'],
  ['/plan','schedule','Plan your week','Order daily routines, plan activities and date exceptions, or pause training.','Planning'],
  ['/plan','routine-transfer','Take your routines with you','Transfer selected routines using JSON, Excel or PDF; review before importing.','Planning'],
  ['/home','streak','Explore your streak calendar','Week opens first. Switch to Month or Year, export, or expand recent workouts.','Tracking'],
  ['/home','consistency','Review consistency and session times','Times shows three recent sessions; Show more reveals the rest.','Tracking'],
  ['/stats?section=history','stats-view','Choose your Stats view','Swipe through Stats. Use this arrow to open a section or change its order.','Tracking'],
  ['/stats?section=history','stats-actions','Review and export your records','Open History, InBody or reports; compare weight, measurements, muscles and routine duration.','Tracking'],
  ['/progress','report','Explore your progress','Compare periods, routines and exercises; export chosen sections as PDF.','Tracking'],
  ['/library','exercises','Find and personalize exercises','Search names, muscles or equipment; inspect instructions and GIFs, edit aliases or create exercises.','Exercises'],
  ['/settings','profile','Your local profile','Edit name, photo and personal measurements; everything stays available locally.','Settings / Profile'],
  ['/settings','reminders','Know what comes next','Choose what, frequency and time; check switches, next dates and alert status.','Settings / Profile'],
  ['/settings','health','Track activities and recovery','Record activities; manage health connections, deload cycles and equipment profiles.','Settings / Profile'],
  ['/settings','preferences','Make TGym yours','Set language, units, appearance, rest, sounds, vibration and screen behavior.','Settings / Profile'],
  ['/settings','privacy','Protect this device','Configure PIN and available biometrics; keep your recovery key private.','Settings / Profile'],
  ['/settings','data','Keep your data available','Back up, restore and optionally synchronize; check updates and offline readiness. Replay from Help.','Settings / Profile'],
]

export function visibleTourTarget(key) {
  return [...document.querySelectorAll(`[data-tour="${key}"]`)].find(node => {
    if (node.closest('[hidden], [aria-hidden="true"]')) return false
    for (let el=node; el; el=el.parentElement) {
      // The tour itself makes the whole app/tab bar inert. Other inert
      // ancestors identify retained, inactive panes and must not be spotlighted.
      if ((el.inert || el.hasAttribute('inert')) && el.id!=='app' && el.id!=='tabbar') return false
      const style=getComputedStyle(el)
      if (style.display==='none' || style.visibility==='hidden' || style.opacity==='0' || style.contentVisibility==='hidden') return false
    }
    const bounds=node.getBoundingClientRect()
    return bounds.width>0 && bounds.height>0
  }) || null
}

export function tourViewport(win = window) {
  const viewport = win.visualViewport
  return {left:viewport?.offsetLeft || 0,top:viewport?.offsetTop || 0,width:viewport?.width || win.innerWidth,height:viewport?.height || win.innerHeight}
}

export function tourHighlightRect(bounds,width,height,panelHeight,{left=0,top=0,insetTop=18,insetBottom=18}={}) {
  if(!bounds)return null
  const area=atTop=>({top:atTop?top+insetTop+panelHeight+18:top+8,bottom:atTop?top+height-8:top+height-insetBottom-panelHeight-18})
  const available=atTop=>Math.max(0,Math.min(bounds.bottom,area(atTop).bottom)-Math.max(bounds.top,area(atTop).top))
  const above=available(true),below=available(false)
  const atTop=above===below ? (bounds.top+bounds.bottom)/2>top+height/2 : above>below
  const free=area(atTop),y=Math.max(bounds.top,free.top),x=Math.max(left+8,bounds.left),bottom=Math.min(bounds.bottom,free.bottom),right=Math.min(bounds.right,left+width-8)
  return bottom>y && right>x ? {top:y,left:x,width:right-x,height:bottom-y,atTop} : null
}
export function replayAppTour() { useUI.setState({ appTourRequest: Date.now() }) }
export default function AppTour() {
  const nav = useNavigate(), location = useLocation(), currentPath=location.pathname+location.search+location.hash, originalPath = useRef(currentPath)
  const S = useStore(s => s.S), requested = useUI(s => s.appTourRequest)
  const sheets = useUI(s => s.sheets.length)
  const [step, setStep] = useState(0), [rect, setRect] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [viewport,setViewport] = useState(tourViewport), [missing,setMissing] = useState(false)
  const overlay = useRef(null), dialog = useRef(null), completionPending = useRef(false), finishingRequest = useRef(false)
  const originalScroll = useRef(window.scrollY), originalFocus = useRef(null), returnFrame = useRef(0)
  const [finishing, setFinishing] = useState(false), [returning,setReturning] = useState(false)
  const active = finishing || !!requested || (S.hasCompletedOnboarding && !S.hasCompletedAppTour)
  useEffect(() => { if (requested) {
    originalPath.current = currentPath; originalScroll.current = window.scrollY
    originalFocus.current = document.activeElement?.closest?.('.tour-replay') ? '.tour-replay' : null
    setStep(0);setError('')
  } }, [requested])
  // Hold the practice view for the whole tour. A per-step cleanup could briefly
  // mount the real session while the router is committing its next location.
  useEffect(()=>{useUI.setState({appTourWorkoutPreview:active})},[active])
  useEffect(()=>()=>{cancelAnimationFrame(returnFrame.current);useUI.setState({appTourWorkoutPreview:false})},[])
  useEffect(() => {
    if (!active || sheets || returning) return
    if (currentPath!==TOUR_STEPS[step][0]) nav(TOUR_STEPS[step][0], { replace:true })
  }, [active, step, sheets, returning, nav, currentPath])
  useEffect(()=>{
    if(!returning || currentPath!==originalPath.current)return
    // Release the preview only after the return page has mounted. If the user
    // began on Workout, its real session can now resume behind the closed tour.
    useUI.setState({appTourRequest:null,appTourWorkoutPreview:false})
    setReturning(false);setFinishing(false);finishingRequest.current=false
    // The shell resets scroll on route changes. Restore the launch position in
    // the following rendering frame, after that reset, without focusing a form.
    cancelAnimationFrame(returnFrame.current)
    returnFrame.current=requestAnimationFrame(()=>{
      window.scrollTo({top:originalScroll.current,behavior:'instant'})
      if(originalFocus.current)document.querySelector(originalFocus.current)?.focus({preventScroll:true})
    })
  },[returning,currentPath])
  useEffect(() => {
    if (!active || sheets) return
    let target, frame=0, committed=false
    const resize=window.ResizeObserver ? new ResizeObserver(()=>schedule()) : null
    const refresh = () => {
      frame=0
      if(!committed)return
      const nextViewport=tourViewport()
      setViewport(previous=>Object.keys(nextViewport).every(key=>previous[key]===nextViewport[key])?previous:nextViewport)
      if(currentPath!==TOUR_STEPS[step][0])return
      const nextTarget=visibleTourTarget(TOUR_STEPS[step][1])
      const rootStyle=getComputedStyle(document.documentElement)
      const insets={...nextViewport,insetTop:Math.max(18,parseFloat(rootStyle.getPropertyValue('--sat'))||0),insetBottom:Math.max(18,parseFloat(rootStyle.getPropertyValue('--sab'))||0)}
      const geometryOf=node=>tourHighlightRect(node?.getBoundingClientRect(),nextViewport.width,nextViewport.height,dialog.current?.offsetHeight||280,insets)
      const visibleBounds=nextTarget && geometryOf(nextTarget)
      // The shell resets scroll after a route commits; media can also change
      // geometry. Re-reveal a cached target when it no longer has visible space.
      if (nextTarget && (nextTarget!==target || !visibleBounds)) nextTarget.scrollIntoView({block:'start',behavior:'instant'})
      if(nextTarget!==target){if(target)resize?.unobserve(target);if(nextTarget)resize?.observe(nextTarget)}
      target=nextTarget
      const geometry=geometryOf(target)
      const next=geometry ? {...geometry,target:TOUR_STEPS[step][1]} : null
      setRect(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next)
      setMissing(!geometry)
    }
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(refresh)}
    // Wait for the route's layout effects (including its scroll reset) to finish
    // before publishing a rectangle. This is one rendering frame, never a delay.
    setRect(null);setMissing(false)
    frame=requestAnimationFrame(()=>{
      committed=true;refresh()
      // Repeated Enter/Space on Next must keep advancing. Moving focus to Skip
      // after every step made a keyboard tour exit on its second activation.
      if(!dialog.current?.contains(document.activeElement) || document.activeElement?.disabled)dialog.current?.querySelector('[data-tour-action="next"]')?.focus({preventScroll:true})
    })
    resize?.observe(dialog.current)
    const observer=new MutationObserver(schedule);const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','inert','class','style']})
    const reposition=()=>{target=null;schedule()}
    window.addEventListener('resize', reposition); document.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize',reposition);window.visualViewport?.addEventListener('scroll',schedule)
    return () => { observer.disconnect();resize?.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize', reposition);document.removeEventListener('scroll', schedule, true);window.visualViewport?.removeEventListener('resize',reposition);window.visualViewport?.removeEventListener('scroll',schedule) }
  }, [active, step, currentPath, sheets])
  useEffect(()=>{
    if (!active || sheets) return
    const before = document.activeElement
    const blocked = ['app', 'tabbar'].map(id => document.getElementById(id)).filter(Boolean)
    const original=blocked.map(el=>el.inert)
    blocked.forEach(el => { el.inert = true })
    const preventBackgroundScroll=event=>{
      const body=event.target?.closest?.('.tour-body')
      if(!body || body.scrollHeight<=body.clientHeight)event.preventDefault()
    }
    const layer=overlay.current
    layer?.addEventListener('wheel',preventBackgroundScroll,{passive:false})
    layer?.addEventListener('touchmove',preventBackgroundScroll,{passive:false})
    return () => { layer?.removeEventListener('wheel',preventBackgroundScroll);layer?.removeEventListener('touchmove',preventBackgroundScroll);blocked.forEach((el,i) => { el.inert = original[i] }); if (before?.isConnected) before.focus?.({preventScroll:true}) }
  },[active,sheets])
  if (!active || sheets) return null
  const highlight=rect?.target===TOUR_STEPS[step][1] && currentPath===TOUR_STEPS[step][0] ? rect : null
  const finish = async () => {
    if(finishingRequest.current || returning)return
    finishingRequest.current=true
    setFinishing(true); setBusy(true); setError('')
    try {
      // Replaying an already completed tour needs no profile write or reminder
      // reconciliation. A failed first completion can still retry its mirror.
      if(!useStore.getState().S.hasCompletedAppTour){
        useStore.getState().update(s => { s.hasCompletedAppTour = true },true,false)
        completionPending.current=true
      }
      if(completionPending.current){await useStore.getState().flushPersistence();completionPending.current=false}
      setReturning(true);nav(originalPath.current,{replace:true})
    } catch { finishingRequest.current=false;setError(t('Could not save. Check available storage and try again.')) }
    finally { setBusy(false) }
  }
  const keys = e => {
    if (e.key === 'Escape') { e.preventDefault(); if (!busy&&!returning) void finish() }
    if (e.key === 'Tab') {
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled)')]
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus() }
      else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0]?.focus() }
    }
    if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key)){
      e.preventDefault()
      const body=dialog.current.querySelector('.tour-body')
      const delta=e.key==='Home'?-body.scrollHeight:e.key==='End'?body.scrollHeight:(e.key==='ArrowDown'?40:e.key==='ArrowUp'?-40:e.key==='PageDown'?body.clientHeight:-body.clientHeight)
      body.scrollBy({top:delta,behavior:'instant'})
    }
  }
  return <div ref={overlay} className="app-tour" onKeyDown={keys} style={{top:viewport.top,left:viewport.left,width:viewport.width,height:viewport.height}}>
    {!highlight && <div className="tour-shade" />}
    {highlight && <div className="tour-focus" data-tour-target={highlight.target} aria-hidden="true" style={{ top: highlight.top - 5, left: highlight.left - 5, width: highlight.width + 10, height: highlight.height + 10 }} />}
    <section ref={dialog} className={'tour-panel' + (highlight?.atTop ? ' at-top' : '')} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-copy">
      <div className="tour-body" aria-live="polite" aria-atomic="true">
      <div className="tour-count"><span>{t('App tour')} · {step + 1} / {TOUR_STEPS.length}</span><span>{t(TOUR_STEPS[step][4])}</span></div>
      {step===0 && <p className="tour-duration">60–90 s · {t('You can skip at any time.')}</p>}
      <h2 id="tour-title">{t(TOUR_STEPS[step][2])}</h2><p id="tour-copy">{t(TOUR_STEPS[step][3])}{TOUR_STEPS[step][1]==='stats-view'&&<> {t('Drag or use arrow keys to move this control.')}</>}</p>
      <progress value={step + 1} max={TOUR_STEPS.length} aria-label={t('App tour')} />
      {error && <p role="alert">{error}</p>}
      {missing && currentPath===TOUR_STEPS[step][0] && <p className="tour-unavailable" role="status">{t('This control is not available here. You can continue the tour.')}</p>}
      </div>
      <div className="tour-actions"><Button disabled={busy||returning} onClick={finish}>{t('Skip')}</Button><Button disabled={busy||returning||step === 0} onClick={() => setStep(s => s - 1)}>{t('Back')}</Button><Button data-tour-action="next" variant="primary" disabled={busy||returning} onClick={() => step === TOUR_STEPS.length - 1 ? finish() : setStep(s => s + 1)}>{t(step === TOUR_STEPS.length - 1 ? 'Finish' : 'Next')}</Button></div>
    </section>
  </div>
}
