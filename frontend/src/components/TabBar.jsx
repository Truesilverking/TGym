import { nextDailyRoutine } from '../lib/daily-plan.js'
import { isTrainingPaused } from '../lib/training-pause.js'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { registerNavigationBack } from '../lib/back.js'
import './NavigationDock.css'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const onboarding = useStore(s => s.needsMobileOnboarding)
  const [open,setOpen]=useState(false),[progress,setProgress]=useState(null)
  const dock=useRef(null),toggle=useRef(null),backdrop=useRef(null),gesture=useRef(null),suppressClick=useRef(false)
  const covered=useUI(s=>s.sheets.length>0||!!s.appTourRequest||!!s.appTourWorkoutPreview)
  const available=!!(user||isGuest)&&!onboarding
  const close=restoreFocus=>{gesture.current=null;setProgress(null);setOpen(false);if(restoreFocus||document.activeElement?.closest('.navigation-dock-slot'))toggle.current?.focus({preventScroll:true})}
  useEffect(()=>{close(false)},[loc.pathname,loc.search,available,covered])
  useEffect(()=>{
    if(!open)return
    const unregister=registerNavigationBack(()=>close(true)),pop=()=>close(false),hidden=()=>{if(document.visibilityState==='hidden')close(false)}
    window.addEventListener('popstate',pop)
    window.addEventListener('blur',pop);document.addEventListener('visibilitychange',hidden)
    return()=>{unregister();window.removeEventListener('popstate',pop);window.removeEventListener('blur',pop);document.removeEventListener('visibilitychange',hidden)}
  },[open])
  useEffect(()=>{
    if(!open)return
    const focusable=()=>[...dock.current.querySelectorAll('button:not([disabled]):not([tabindex="-1"])')]
    const first=dock.current.querySelector('.navigation-dock-tab[aria-current="page"]')||dock.current.querySelector('.navigation-dock-tab')
    first?.focus({preventScroll:true})
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return}
      if(event.key!=='Tab')return
      const buttons=focusable(),index=buttons.indexOf(document.activeElement)
      if(!buttons.length)return
      event.preventDefault();buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus({preventScroll:true})
    }
    const block=event=>event.preventDefault(),surface=backdrop.current
    document.addEventListener('keydown',key)
    surface?.addEventListener('wheel',block,{passive:false})
    return()=>{document.removeEventListener('keydown',key);surface?.removeEventListener('wheel',block)}
  },[open])
  // First-run setup is a full-screen flow: the rail would offer exits into empty screens.
  if (!available) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  // Each module owns its sub-screens: Exercises live under Plan, History/Report under Progress.
  const owner = { history: 'stats', progress: 'stats', body: 'stats', records: 'stats', library: 'plan', settings: 'home', admin: 'home' }
  const on = k => (owner[cur] || cur) === k

  const startWorkout = () => {
    close(false)
    if (!S.active) {
      if(isTrainingPaused(S,todayISO())) { onStart(); return }
      const r = nextDailyRoutine(S, todayISO())
      if (r && r.ex.length) { onStart(r.id); return }
    }
    nav('/workout')
  }
  // Render buttons directly: an inline component type remounts during the activity
  // capture handler, removing the pointer target before its click can navigate.
  const tab = (k, icon, to, label) => (
    <div className="navigation-dock-slot" inert={!open} aria-hidden={!open}>
      <button type="button" tabIndex={open?0:-1} aria-current={on(k) ? 'page' : undefined} className={'navigation-dock-tab'+(on(k)?' on':'')} onClick={() => {close(false);nav(to)}}>
        <Icon name={icon} /><span className="tab-label">{label}</span>
      </button>
    </div>
  )
  const down=event=>{
    if(event.button!==0||event.isPrimary===false||gesture.current||covered)return
    const button=event.target.closest('button')
    if(button&&button!==toggle.current)return
    suppressClick.current=false
    gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),open,moved:false}
  }
  const move=event=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return
    const dx=event.clientX-g.x,dy=event.clientY-g.y
    if(!g.moved){
      if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)){suppressClick.current=true;gesture.current=null;return}
      if(Math.abs(dy)<8||Math.abs(dy)<Math.abs(dx)*1.2)return
      g.moved=true;try{dock.current.setPointerCapture(g.id)}catch{}
    }
    event.preventDefault();setProgress(Math.max(0,Math.min(1,(g.open?1:0)-dy/88)))
  }
  const up=event=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return
    gesture.current=null;setProgress(null)
    if(!g.moved)return
    try{dock.current.releasePointerCapture(g.id)}catch{}
    suppressClick.current=true;event.preventDefault()
    const dy=event.clientY-g.y,elapsed=Math.max(1,performance.now()-g.at)
    if(Math.abs(dy)>=48||(Math.abs(dy)>=18&&Math.abs(dy)/elapsed>.45))setOpen(dy<0)
  }
  const cancel=event=>{if(!gesture.current||gesture.current.id===event.pointerId){if(gesture.current?.moved)suppressClick.current=true;gesture.current=null;setProgress(null)}}

  return (
    <>
    {open&&<div ref={backdrop} className="navigation-dock-backdrop" aria-hidden="true" onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.preventDefault();event.stopPropagation();close(true)}}/>}
    <nav id="tabbar" ref={dock} className="navigation-dock" aria-label={t('Main navigation')} data-open={open} data-dragging={progress!==null?true:undefined}
      style={{'--dock-progress':progress??(open?1:0)}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
      onLostPointerCapture={event=>{if(event.target===event.currentTarget)cancel(event)}}
      onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();if(gesture.current?.moved)suppressClick.current=true;close(true)}}}>
      <div className="navigation-dock-surface" aria-hidden="true"/>
      <div id="navigation-dock-modules" className="navigation-dock-modules">
        {tab('home', 'house', '/home', t('Today'))}
        {tab('plan', 'calendar', '/plan', t('Routine'))}
        <button type="button" data-tour="start" className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
          <span className="cir"><Icon name={S.active ? 'play' : 'dumbbell'} /></span>
          <span>{S.active ? t('Resume') : t('Start')}</span>
        </button>
        {tab('nutrition', 'fork', '/nutrition', t('Nutrition'))}
        {tab('stats', 'chart', '/stats', t('Stats'))}
      </div>
      <button type="button" id="navigation-dock-toggle" ref={toggle} className="navigation-dock-toggle" data-tour="navigation"
        aria-label={t(open?'Close navigation':'Open navigation')} aria-expanded={open} aria-controls="navigation-dock-modules"
        onClick={event=>{if(suppressClick.current&&event.detail!==0){suppressClick.current=false;return}suppressClick.current=false;setOpen(value=>!value)}}
        onKeyDown={event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();setOpen(event.key==='ArrowUp')}}}>
        <span aria-hidden="true"/>
      </button>
    </nav>
    </>
  )
}
