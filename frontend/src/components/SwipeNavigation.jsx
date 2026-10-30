import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { swipeTarget } from '../lib/navigation-model.js'
import { t } from '../lib/i18n.js'
import './SwipeNavigation.css'

const interactive = 'input,textarea,select,button,a,[contenteditable=true],[role=slider],[data-nodrag],.chart-i,.bodyweight-picker,.zoomcal,.stats-view-control,[data-swipe-ignore]'
export default function SwipeNavigation({ children }) {
  const location=useLocation(),navigate=useNavigate(),gesture=useRef(null),ignoreClick=useRef(false)
  const [offset,setOffset]=useState(0),[direction,setDirection]=useState(0)
  const covered=useUI(s=>s.sheets.length>0||!!s.appTourWorkoutPreview||!!s.appTourRequest)
  const reset=()=>{gesture.current=null;setOffset(0)}
  useEffect(()=>{reset()},[location.pathname,location.search,covered])
  const down=event=>{
    if(covered||event.button!==0||event.isPrimary===false||gesture.current||event.target.closest(interactive))return
    // Preserve Android/iOS edge-back gestures and the vertical page scroll.
    if(event.clientX<24||event.clientX>window.innerWidth-24)return
    if(!swipeTarget(useStore.getState().S,location,1))return
    ignoreClick.current=false;gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),horizontal:false}
  }
  const move=event=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return
    const dx=event.clientX-g.x,dy=event.clientY-g.y
    if(!g.horizontal){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){reset();return}
      if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.3)return
      g.horizontal=true;try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
    }
    event.preventDefault();setOffset(Math.max(-140,Math.min(140,dx))*.65)
  }
  const up=event=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return
    const dx=event.clientX-g.x,elapsed=Math.max(1,performance.now()-g.at)
    gesture.current=null;setOffset(0)
    if(!g.horizontal)return
    try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}
    ignoreClick.current=true;setTimeout(()=>{ignoreClick.current=false},0);event.preventDefault()
    if(Math.abs(dx)<Math.min(72,window.innerWidth*.19)&&!(Math.abs(dx)>36&&Math.abs(dx)/elapsed>.45))return
    const step=dx<0?1:-1,target=swipeTarget(useStore.getState().S,location,step)
    if(target){setDirection(step);navigate(target)}
  }
  const cancel=event=>{if(!gesture.current||event.pointerId===gesture.current.id)reset()}
  return <div className="swipe-navigation" data-swipe-direction={direction>0?'next':direction<0?'previous':undefined}
    role="region" aria-label={t('Main navigation')} tabIndex={-1}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
    onLostPointerCapture={event=>{if(event.target===event.currentTarget)cancel(event)}}
    onClickCapture={event=>{if(ignoreClick.current&&event.detail!==0){ignoreClick.current=false;event.preventDefault();event.stopPropagation()}}}
    onKeyDown={event=>{if(event.target!==event.currentTarget||!['ArrowLeft','ArrowRight'].includes(event.key)||covered)return;const step=event.key==='ArrowRight'?1:-1,target=swipeTarget(useStore.getState().S,location,step);if(target){event.preventDefault();setDirection(step);navigate(target)}}}>
    <div className="swipe-navigation-content" style={offset?{transform:`translate3d(${offset}px,0,0)`}:undefined}>{children}</div>
  </div>
}
