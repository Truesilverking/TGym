import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { swipeTarget } from '../lib/navigation-model.js'
import { beginSwipe, moveSwipe, swipeOffset, swipeStep } from '../lib/swipe-gesture.js'
import { t } from '../lib/i18n.js'
import './SwipeNavigation.css'

const interactive='input,textarea,select,button,a,label,summary,video,audio,iframe,[contenteditable]:not([contenteditable="false"]),[role=button],[role=checkbox],[role=switch],[role=radio],[role=tab],[role=combobox],[role=spinbutton],[role=slider],[draggable=true],dialog,[role=dialog],[aria-modal=true],[data-nodrag],.chart-i,.bodymap.tappable,.bodyweight-picker,.zoomcal,.stats-view-control,.swipe-content,[data-swipe-ignore]'
const motionQuery='(prefers-reduced-motion: reduce)'
const systemMotion=()=>!!window.matchMedia?.(motionQuery).matches
const subscribeMotion=callback=>{
  const query=window.matchMedia?.(motionQuery)
  query?.addEventListener?.('change',callback)
  return()=>query?.removeEventListener?.('change',callback)
}
const ENTER_MS=180,SETTLE_MS=180

export default function SwipeNavigation({children}) {
  const location=useLocation(),navigate=useNavigate()
  const region=useRef(null),content=useRef(null),gesture=useRef(null),transition=useRef(null)
  const frame=useRef(0),dragFrame=useRef(0),timer=useRef(0),clickTimer=useRef(0)
  const surfaceFrame=useRef(0)
  const generation=useRef(0)
  const pointers=useRef(new Set()),ignoreClick=useRef(false),mode=useRef('idle')
  const [direction,setDirection]=useState(0),[phase,setPhase]=useState('idle')
  const covered=useUI(s=>s.sheets.length>0||!!s.appTourWorkoutPreview||!!s.appTourRequest)
  const appReduced=useStore(s=>!!s.S.reduceMotion),systemReduced=useSyncExternalStore(subscribeMotion,systemMotion,()=>false)
  const available=!!swipeTarget(useStore.getState().S,location,1)
  const current=useRef(null)
  current.current={location,covered,reduced:appReduced||systemReduced}
  const blocked=()=>current.current.covered||!!document.querySelector('dialog[open],[aria-modal="true"]')
  const sizeSurface=()=>{
    if(!region.current)return
    const top=region.current.getBoundingClientRect().top
    const value=`${Math.max(0,(Number.isFinite(top)?top:0)+window.scrollY)}px`
    if(region.current.style.getPropertyValue('--swipe-surface-top')!==value)region.current.style.setProperty('--swipe-surface-top',value)
  }
  const paint=(offset=0,opacity=1)=>{
    if(!content.current)return
    content.current.style.transform=offset?`translate3d(${offset}px,0,0)`:''
    content.current.style.opacity=opacity===1?'':String(opacity)
  }
  const setMode=value=>{
    mode.current=value
    if(region.current)region.current.dataset.swipePhase=value
    setPhase(value)
  }
  const clearScheduled=()=>{
    generation.current++
    cancelAnimationFrame(frame.current);cancelAnimationFrame(dragFrame.current);clearTimeout(timer.current)
    frame.current=0;dragFrame.current=0;timer.current=0
  }
  const release=()=>{
    const g=gesture.current;gesture.current=null
    if(g)try{region.current?.releasePointerCapture(g.id)}catch{}
  }
  const reset=()=>{clearScheduled();release();transition.current=null;paint();setMode('idle')}
  const finish=()=>{clearScheduled();transition.current=null;paint();setMode('idle')}
  const suppressCompatClick=()=>{
    ignoreClick.current=true;clearTimeout(clickTimer.current)
    clickTimer.current=setTimeout(()=>{ignoreClick.current=false;clickTimer.current=0},400)
  }
  const settle=()=>{
    clearScheduled();release();transition.current=null
    if(current.current.reduced||!content.current?.style.transform){paint();setMode('idle');return}
    const token=generation.current
    setMode('settling');paint();timer.current=setTimeout(()=>{if(generation.current===token)finish()},SETTLE_MS+60)
  }
  const start=step=>{
    if(blocked())return false
    const target=swipeTarget(useStore.getState().S,current.current.location,step)
    if(!target)return false
    clearScheduled();release();setDirection(step)
    transition.current={target,direction:step,origin:current.current.location.key}
    // Commit immediately instead of waiting for a blank full-width exit.
    navigate(target)
    return true
  }

  useLayoutEffect(()=>{
    sizeSurface()
    release();clearScheduled()
    const next=transition.current
    if(!next||location.key===next.origin||location.pathname+location.search!==next.target||blocked()||current.current.reduced){reset();return}
    transition.current=null
    const width=region.current?.getBoundingClientRect().width||window.innerWidth
    setMode('preparing');paint(next.direction*Math.min(56,width*.12),.78)
    // Establish the entry before paint. No cloned pages or duplicate effects.
    content.current?.getBoundingClientRect()
    const token=generation.current
    timer.current=setTimeout(()=>{if(generation.current===token)finish()},ENTER_MS+60)
    frame.current=requestAnimationFrame(()=>{
      if(generation.current!==token||mode.current!=='preparing')return
      if(blocked()){reset();return}
      frame.current=0;setMode('entering');paint()
    })
    return clearScheduled
  },[location.key,location.pathname,location.search])
  useEffect(()=>{if(covered||appReduced||systemReduced)reset()},[covered,appReduced,systemReduced])
  useEffect(()=>{
    const down=event=>{
      pointers.current.add(event.pointerId)
      if(pointers.current.size>1){if(gesture.current?.state==='horizontal')suppressCompatClick();settle();return}
      if((gesture.current||mode.current!=='idle')&&!region.current?.contains(event.target))reset()
    }
    const up=event=>{
      pointers.current.delete(event.pointerId)
      if(gesture.current?.id===event.pointerId&&!region.current?.contains(event.target))settle()
    }
    const key=event=>{if(!region.current?.contains(event.target))reset()}
    const stop=()=>{pointers.current.clear();reset()}
    const resize=()=>{stop();sizeSurface()}
    const hidden=()=>{if(document.visibilityState==='hidden')stop();else sizeSurface()}
    const scroll=()=>{
      if(mode.current==='preparing'||mode.current==='entering'||gesture.current?.state==='horizontal')return
      if(gesture.current)reset()
    }
    document.addEventListener('pointerdown',down,true)
    document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true)
    document.addEventListener('keydown',key,true);document.addEventListener('scroll',scroll,{capture:true,passive:true})
    document.addEventListener('visibilitychange',hidden)
    window.addEventListener('blur',stop);window.addEventListener('resize',resize)
    const scheduleSurface=()=>{
      if(!surfaceFrame.current)surfaceFrame.current=requestAnimationFrame(()=>{surfaceFrame.current=0;sizeSurface()})
    }
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(scheduleSurface):null
    const app=region.current?.closest('#app')
    const observeLayout=()=>{
      observer?.disconnect()
      const nodes=new Set([region.current?.parentElement,app,...(app?.children||[])])
      for(const node of nodes)if(node)observer?.observe(node)
    }
    observeLayout()
    // Banners before the deck can move its top without resizing the deck.
    const structure=app&&typeof MutationObserver==='function'?new MutationObserver(()=>{observeLayout();scheduleSurface()}):null
    structure?.observe(app,{childList:true})
    const parent=region.current?.parentElement
    const animationEnd=event=>{if(event.target===parent)sizeSurface()}
    parent?.addEventListener('animationend',animationEnd)
    return()=>{
      clearScheduled();clearTimeout(clickTimer.current);transition.current=null;gesture.current=null
      document.removeEventListener('pointerdown',down,true)
      document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true)
      document.removeEventListener('keydown',key,true);document.removeEventListener('scroll',scroll,true)
      document.removeEventListener('visibilitychange',hidden)
      window.removeEventListener('blur',stop);window.removeEventListener('resize',resize)
      observer?.disconnect();structure?.disconnect();cancelAnimationFrame(surfaceFrame.current)
      parent?.removeEventListener('animationend',animationEnd)
    }
  },[])

  const down=event=>{
    if(event.button!==0||event.isPrimary===false||pointers.current.size>1)return
    ignoreClick.current=false;clearTimeout(clickTimer.current)
    if(mode.current!=='idle')reset()
    if(blocked()||gesture.current||event.defaultPrevented)return
    if(event.target.closest?.(interactive)||event.target.closest?.('[inert],[hidden],[data-app-pane][aria-hidden="true"]'))return
    if(document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]'))return
    const selection=window.getSelection?.()
    if(selection&&!selection.isCollapsed&&selection.toString()){
      for(let index=0;index<selection.rangeCount;index++){
        const boxes=selection.getRangeAt(index).getClientRects?.()||[]
        if([...boxes].some(box=>event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom))return
      }
    }
    for(let node=event.target;node&&node!==region.current;node=node.parentElement){
      if(node.clientWidth>0&&node.scrollWidth>node.clientWidth+2&&/(auto|scroll)/.test(getComputedStyle(node).overflowX))return
    }
    if(event.clientX<24||event.clientX>window.innerWidth-24)return
    if(!swipeTarget(useStore.getState().S,current.current.location,1))return
    const width=region.current?.getBoundingClientRect().width||window.innerWidth
    gesture.current={...beginSwipe(event.clientX,event.clientY,performance.now(),width),id:event.pointerId}
  }
  const move=event=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return
    if(blocked()||(event.pointerType==='mouse'&&event.buttons===0)){settle();return}
    const previous=g.state,state=moveSwipe(g,event.clientX,event.clientY,performance.now())
    if(state==='rejected'){if(previous==='horizontal')suppressCompatClick();settle();return}
    if(state!=='horizontal')return
    if(previous!=='horizontal'){
      setMode('dragging')
      const selection=window.getSelection?.()
      if(selection?.anchorNode&&region.current?.contains(selection.anchorNode))selection.removeAllRanges()
      try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
    }
    event.preventDefault()
    if(!dragFrame.current)dragFrame.current=requestAnimationFrame(()=>{
      dragFrame.current=0
      if(blocked()){reset();return}
      if(gesture.current===g&&g.state==='horizontal')paint(swipeOffset(g))
    })
  }
  const up=event=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return
    const step=blocked()?0:swipeStep(g,event.clientX,event.clientY,performance.now())
    const horizontal=g.state==='horizontal'||mode.current==='dragging'
    release();cancelAnimationFrame(dragFrame.current);dragFrame.current=0
    if(!horizontal)return
    suppressCompatClick();event.preventDefault()
    if(!step||!start(step))settle()
  }
  const cancel=event=>{
    if(!gesture.current||event.pointerId!==gesture.current.id)return
    if(gesture.current.state==='horizontal')suppressCompatClick()
    settle()
  }
  return <div ref={region} className="swipe-navigation" data-swipe-available={available||undefined} data-swipe-direction={direction>0?'next':direction<0?'previous':undefined} data-swipe-phase={phase}
    role="region" aria-label={t('Main navigation')} aria-busy={['preparing','entering'].includes(phase)||undefined} tabIndex={-1}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
    onContextMenu={()=>{if(gesture.current)settle()}}
    onDragStart={event=>{if(gesture.current?.state==='horizontal')event.preventDefault()}}
    onLostPointerCapture={event=>{if(event.target===event.currentTarget)cancel(event)}}
    onClickCapture={event=>{if(ignoreClick.current&&event.detail!==0){ignoreClick.current=false;clearTimeout(clickTimer.current);event.preventDefault();event.stopPropagation()}}}
    onKeyDown={event=>{if(event.target!==event.currentTarget||!['ArrowLeft','ArrowRight'].includes(event.key)||blocked())return;reset();event.preventDefault();start(event.key==='ArrowRight'?1:-1)}}>
    <div ref={content} className="swipe-navigation-content" onTransitionEnd={event=>{
      if(event.target===content.current&&event.propertyName==='transform'&&['entering','settling'].includes(mode.current))finish()
    }}>{children}</div>
  </div>
}
