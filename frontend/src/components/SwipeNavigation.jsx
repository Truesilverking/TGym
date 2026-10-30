import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { swipeTarget } from '../lib/navigation-model.js'
import { t } from '../lib/i18n.js'
import './SwipeNavigation.css'

const interactive = 'input,textarea,select,button,a,[contenteditable=true],[role=slider],[data-nodrag],.chart-i,.bodyweight-picker,.zoomcal,.stats-view-control,[data-swipe-ignore]'
const motionQuery = '(prefers-reduced-motion: reduce)'
const systemMotion = () => !!window.matchMedia?.(motionQuery).matches
const subscribeMotion = callback => {
  const query=window.matchMedia?.(motionQuery)
  query?.addEventListener?.('change',callback)
  return()=>query?.removeEventListener?.('change',callback)
}
const EXIT_MS=140,ENTER_MS=180

export default function SwipeNavigation({ children }) {
  const location=useLocation(),navigate=useNavigate()
  const region=useRef(null),content=useRef(null),gesture=useRef(null),transition=useRef(null)
  const frame=useRef(0),timer=useRef(0),clickTimer=useRef(0),ignoreClick=useRef(false),mode=useRef('idle')
  const [offset,setOffset]=useState(0),[direction,setDirection]=useState(0),[phase,setPhase]=useState('idle')
  const covered=useUI(s=>s.sheets.length>0||!!s.appTourWorkoutPreview||!!s.appTourRequest)
  const appReduced=useStore(s=>!!s.S.reduceMotion),systemReduced=useSyncExternalStore(subscribeMotion,systemMotion,()=>false)
  const current=useRef({location,covered,reduced:appReduced||systemReduced})
  current.current={location,covered,reduced:appReduced||systemReduced}
  const setMode=value=>{mode.current=value;setPhase(value)}
  const clearScheduled=()=>{cancelAnimationFrame(frame.current);clearTimeout(timer.current);frame.current=0;timer.current=0}
  const reset=()=>{clearScheduled();transition.current=null;gesture.current=null;setOffset(0);setMode('idle')}
  const finish=()=>{clearScheduled();transition.current=null;setOffset(0);setMode('idle')}
  const suppressCompatClick=()=>{
    ignoreClick.current=true;clearTimeout(clickTimer.current)
    clickTimer.current=setTimeout(()=>{ignoreClick.current=false;clickTimer.current=0},400)
  }
  const commit=()=>{
    const next=transition.current,{location,covered}=current.current
    if(!next||next.committed)return
    if(covered||location.key!==next.origin){reset();return}
    clearScheduled();next.committed=true;navigate(next.target)
  }
  const start=step=>{
    const target=swipeTarget(useStore.getState().S,current.current.location,step)
    if(!target)return false
    setDirection(step)
    if(current.current.reduced){reset();navigate(target);return true}
    const width=region.current?.getBoundingClientRect().width||window.innerWidth
    transition.current={target,direction:step,width,origin:current.current.location.key,committed:false}
    setMode('leaving');setOffset(-step*width)
    // transitionend is primary; the bound also covers interrupted browser paints.
    timer.current=setTimeout(commit,EXIT_MS+60)
    return true
  }

  useLayoutEffect(()=>{
    gesture.current=null
    const next=transition.current
    clearScheduled()
    if(!next?.committed||location.key===next.origin||location.pathname+location.search!==next.target||current.current.covered||current.current.reduced){reset();return}
    // Position before paint without cloning an active module. React Activity
    // has already hidden the outgoing page and restored the incoming one.
    setOffset(next.direction*next.width);setMode('preparing')
    frame.current=requestAnimationFrame(()=>{
      frame.current=requestAnimationFrame(()=>{
        frame.current=0
        if(transition.current!==next)return
        setMode('entering');setOffset(0);timer.current=setTimeout(finish,ENTER_MS+60)
      })
    })
    return clearScheduled
  },[location.key,location.pathname,location.search])
  useEffect(()=>{
    if(covered){reset();return}
    if(current.current.reduced&&transition.current){
      const next=transition.current,shouldCommit=!next.committed&&current.current.location.key===next.origin
      reset();if(shouldCommit)navigate(next.target)
    }
  },[covered,appReduced,systemReduced])
  useEffect(()=>{
    const outside=event=>{if(mode.current!=='idle'&&!region.current?.contains(event.target))reset()}
    const hidden=()=>{if(document.visibilityState==='hidden')reset()}
    const blur=()=>reset()
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',outside,true)
    document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur)
    return()=>{
      clearScheduled();clearTimeout(clickTimer.current);transition.current=null;gesture.current=null
      document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',outside,true)
      document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur)
    }
  },[])

  const down=event=>{
    if(event.button!==0||event.isPrimary===false)return
    // A fresh deliberate press owns its click, including on an inner control.
    ignoreClick.current=false;clearTimeout(clickTimer.current)
    if(mode.current!=='idle'&&mode.current!=='dragging'){reset();return}
    if(covered||gesture.current||event.target.closest?.(interactive)||event.target.closest?.('[inert],[hidden],[data-app-pane][aria-hidden="true"]'))return
    if(event.clientX<24||event.clientX>window.innerWidth-24)return
    if(!swipeTarget(useStore.getState().S,location,1))return
    gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),horizontal:false,width:region.current?.getBoundingClientRect().width||window.innerWidth}
  }
  const move=event=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return
    const dx=event.clientX-g.x,dy=event.clientY-g.y
    if(!g.horizontal){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){reset();return}
      if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.3)return
      g.horizontal=true;setMode('dragging')
      // Confirmed navigation owns this horizontal movement, including mouse
      // input that began over text. Native text dragging would cancel pointers.
      const selection=window.getSelection?.()
      if(selection?.anchorNode&&region.current?.contains(selection.anchorNode))selection.removeAllRanges()
      try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
    }
    const distance=Math.abs(dx),limit=g.width*.75
    event.preventDefault();setOffset(Math.sign(dx)*Math.min(g.width*.9,distance<=limit?distance:limit+(distance-limit)*.18))
  }
  const up=event=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return
    const dx=event.clientX-g.x,elapsed=Math.max(1,performance.now()-g.at)
    gesture.current=null
    if(!g.horizontal)return
    try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}
    suppressCompatClick();event.preventDefault()
    if(Math.abs(dx)<Math.min(72,g.width*.19)&&!(Math.abs(dx)>36&&Math.abs(dx)/elapsed>.45)){reset();return}
    if(!start(dx<0?1:-1))reset()
  }
  const cancel=event=>{if(!gesture.current||event.pointerId===gesture.current.id)reset()}
  return <div ref={region} className="swipe-navigation" data-swipe-direction={direction>0?'next':direction<0?'previous':undefined} data-swipe-phase={phase}
    role="region" aria-label={t('Main navigation')} aria-busy={['leaving','preparing','entering'].includes(phase)||undefined} tabIndex={-1}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
    onDragStart={event=>{if(gesture.current)event.preventDefault()}}
    onLostPointerCapture={event=>{if(event.target===event.currentTarget&&gesture.current)cancel(event)}}
    onClickCapture={event=>{if(ignoreClick.current&&event.detail!==0){ignoreClick.current=false;clearTimeout(clickTimer.current);event.preventDefault();event.stopPropagation()}}}
    onKeyDown={event=>{if(event.target!==event.currentTarget||!['ArrowLeft','ArrowRight'].includes(event.key)||covered)return;if(mode.current!=='idle')reset();event.preventDefault();start(event.key==='ArrowRight'?1:-1)}}>
    <div ref={content} className="swipe-navigation-content" style={offset?{transform:`translate3d(${offset}px,0,0)`}:undefined}
      onTransitionEnd={event=>{if(event.target!==content.current||event.propertyName!=='transform')return;if(mode.current==='leaving')commit();else if(mode.current==='entering')finish()}}>{children}</div>
  </div>
}
