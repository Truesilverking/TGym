import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { moduleForPath, swipeTarget } from '../lib/navigation-model.js'
import { beginSwipe, moveSwipe, swipeOffset, swipeStep } from '../lib/swipe-gesture.js'
import { horizontalGestureOwner, isSwipeEditingTarget } from '../lib/swipe-owner.js'
import { motionSnapshot } from '../lib/motion-snapshot.js'
import { t } from '../lib/i18n.js'
import './SwipeNavigation.css'

const motionQuery='(prefers-reduced-motion: reduce)'
const systemMotion=()=>!!window.matchMedia?.(motionQuery).matches
const subscribeMotion=callback=>{
  const query=window.matchMedia?.(motionQuery)
  query?.addEventListener?.('change',callback)
  return()=>query?.removeEventListener?.('change',callback)
}
const ENTER_MS=280,SETTLE_MS=180

export default function SwipeNavigation({children}) {
  const location=useLocation(),navigate=useNavigate()
  const region=useRef(null),content=useRef(null),gesture=useRef(null),transition=useRef(null)
  const motionNode=useRef(null),picture=useRef(null),pictureLayer=useRef(null),minHeight=useRef('')
  const frame=useRef(0),dragFrame=useRef(0),timer=useRef(0),clickTimer=useRef(0)
  const surfaceFrame=useRef(0)
  const generation=useRef(0)
  const pointers=useRef(new Set()),ignoreClick=useRef(false),mode=useRef('idle')
  const suppressedPointer=useRef(null)
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
  const paint=(offset=0,opacity=1,scale=1)=>{
    const node=motionNode.current||content.current
    if(!node)return
    node.style.transform=offset||scale!==1?`translate3d(${offset}px,0,0)${scale!==1?` scale(${scale})`:''}`:''
    node.style.opacity=opacity===1?'':String(opacity)
  }
  const clearPicture=()=>{pictureLayer.current?.replaceChildren();picture.current=null}
  const clearMotion=()=>{
    const node=motionNode.current
    if(node){node.style.transform='';node.style.opacity='';node.style.minHeight=minHeight.current;delete node.dataset.pageMotion}
    motionNode.current=null;minHeight.current='';clearPicture()
  }
  const internalStats=target=>moduleForPath(current.current.location.pathname)==='stats'&&moduleForPath(target.split('?')[0])==='stats'
  const chooseMotion=target=>{
    const stats=internalStats(target),node=stats?content.current?.querySelector('[data-stats-motion]'):content.current
    const selected=node||content.current
    if(motionNode.current!==selected){clearMotion();motionNode.current=selected;minHeight.current=selected?.style.minHeight||''}
    if(selected)selected.dataset.pageMotion=stats?'depth':'cover'
    return stats?'depth':'cover'
  }
  const capture=kind=>{
    const node=motionNode.current||content.current;if(!node)return null
    const transform=node.style.transform
    try{
      node.style.transform=''
      const bounds=node.getBoundingClientRect(),copy=motionSnapshot(node)
      if(!copy)return null
      copy.style.transform=transform;copy.style.transition='none';copy.style.margin='0'
      copy.style.position='relative';copy.style.width=`${bounds.width||window.innerWidth}px`
      const top=Math.max(0,bounds.top||0)
      copy.style.top=`${(bounds.top||0)-top}px`
      return {copy,kind,top,left:bounds.left||0,width:bounds.width||window.innerWidth,height:Math.max(0,window.innerHeight-top)}
    }catch{return null}finally{node.style.transform=transform}
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
    if(g&&(g.claimed||g.state==='horizontal')){suppressedPointer.current=g.id;suppressCompatClick()}
    if(g)try{region.current?.releasePointerCapture(g.id)}catch{}
  }
  const reset=()=>{clearScheduled();release();transition.current=null;paint();clearMotion();setMode('idle')}
  const finish=()=>{clearScheduled();transition.current=null;paint();clearMotion();setMode('idle')}
  const suppressCompatClick=()=>{
    ignoreClick.current=true;clearTimeout(clickTimer.current)
    clickTimer.current=setTimeout(()=>{ignoreClick.current=false;clickTimer.current=0},400)
  }
  const settle=()=>{
    clearScheduled();release();transition.current=null
    if(current.current.reduced||!(motionNode.current||content.current)?.style.transform){finish();return}
    const token=generation.current
    setMode('settling');paint();timer.current=setTimeout(()=>{if(generation.current===token)finish()},SETTLE_MS+60)
  }
  const start=step=>{
    if(blocked())return false
    const target=swipeTarget(useStore.getState().S,current.current.location,step)
    if(!target)return false
    clearScheduled();release();setDirection(step)
    const kind=chooseMotion(target),snapshot=current.current.reduced?null:capture(kind)
    transition.current={target,direction:step,origin:current.current.location.key,kind,snapshot}
    // Commit once on release. The old page survives only as an inert picture.
    navigate(target)
    return true
  }

  useLayoutEffect(()=>{
    sizeSurface()
    release();clearScheduled()
    const next=transition.current
    if(!next||!next.snapshot||location.key===next.origin||location.pathname+location.search!==next.target||blocked()||current.current.reduced){reset();return}
    transition.current=null
    const node=next.kind==='depth'?content.current?.querySelector('[data-stats-motion]')||content.current:content.current
    if(motionNode.current!==node){clearMotion();motionNode.current=node;minHeight.current=node?.style.minHeight||''}
    if(node)node.dataset.pageMotion=next.kind
    const width=region.current?.getBoundingClientRect().width||window.innerWidth
    if(next.snapshot&&pictureLayer.current){
      const {copy,top,left,width:pictureWidth,height}=next.snapshot
      Object.assign(pictureLayer.current.style,{top:`${top}px`,left:`${left}px`,width:`${pictureWidth}px`,height:`${height}px`})
      pictureLayer.current.replaceChildren(copy);picture.current=copy
    }
    if(node){const top=node.getBoundingClientRect().top||0;node.style.minHeight=`${Math.max(node.offsetHeight,window.innerHeight-Math.max(0,top))}px`}
    const depth=next.kind==='depth'
    setMode('preparing');paint(next.direction*width*(depth ? .28 : 1),depth ? .2 : 1,depth ? .96 : 1)
    node?.getBoundingClientRect()
    const token=generation.current
    timer.current=setTimeout(()=>{if(generation.current===token)finish()},ENTER_MS+60)
    frame.current=requestAnimationFrame(()=>{
      if(generation.current!==token||mode.current!=='preparing')return
      if(blocked()){reset();return}
      frame.current=0;setMode('entering');paint()
      if(picture.current){
        picture.current.style.transition=`transform ${ENTER_MS}ms cubic-bezier(.2,.75,.25,1),opacity ${ENTER_MS}ms ease`
        picture.current.style.transform=next.kind==='depth'?`translate3d(${-next.direction*width*.18}px,0,0) scale(.94)`:''
        picture.current.style.opacity=next.kind==='depth'?'0':'1'
      }
    })
    return clearScheduled
  },[location.key,location.pathname,location.search])
  useEffect(()=>{if(covered||appReduced||systemReduced)reset()},[covered,appReduced,systemReduced])
  useEffect(()=>{
    const down=event=>{
      if(event.isPrimary!==false)suppressedPointer.current=null
      pointers.current.add(event.pointerId)
      if(pointers.current.size>1){if(gesture.current?.state==='horizontal')suppressCompatClick();settle();return}
      if((gesture.current||mode.current!=='idle')&&!region.current?.contains(event.target))reset()
    }
    const up=event=>{
      pointers.current.delete(event.pointerId)
      // Interruptions may release capture long before the finger lifts. The
      // compatibility-click window starts again at that actual release.
      if(suppressedPointer.current===event.pointerId){suppressedPointer.current=null;suppressCompatClick()}
      if(gesture.current?.id===event.pointerId&&!region.current?.contains(event.target))settle()
    }
    const key=event=>{if(!region.current?.contains(event.target))reset()}
    const stop=()=>{pointers.current.clear();reset()}
    const resize=()=>{stop();sizeSurface()}
    const hidden=()=>{if(document.visibilityState==='hidden')stop();else sizeSurface()}
    document.addEventListener('pointerdown',down,true)
    document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true)
    document.addEventListener('keydown',key,true)
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
      clearScheduled();clearMotion();clearTimeout(clickTimer.current);transition.current=null;gesture.current=null
      document.removeEventListener('pointerdown',down,true)
      document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true)
      document.removeEventListener('keydown',key,true)
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
    if(blocked()||gesture.current)return
    if(horizontalGestureOwner(event.target,region.current))return
    if(isSwipeEditingTarget(document.activeElement))return
    const selection=window.getSelection?.()
    if(selection&&!selection.isCollapsed&&selection.toString()){
      for(let index=0;index<selection.rangeCount;index++){
        const boxes=selection.getRangeAt(index).getClientRects?.()||[]
        if([...boxes].some(box=>event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom))return
      }
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
    g.claimed=true
    if(previous!=='horizontal'){
      setMode('dragging')
      const selection=window.getSelection?.()
      if(selection?.anchorNode&&region.current?.contains(selection.anchorNode))selection.removeAllRanges()
      try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
    }
    const target=swipeTarget(useStore.getState().S,current.current.location,g.dx<0?1:-1)
    if(target)chooseMotion(target)
    event.preventDefault()
    if(current.current.reduced)return
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
    onDragStart={event=>{
      // Browsers can start dragging an image/link before delivering enough
      // pointer movement to lock intent. Keep that incidental drag from
      // swallowing navigation; explicitly draggable widgets never start here.
      if(gesture.current&&(gesture.current.state==='horizontal'||event.target.closest?.('img,a')))event.preventDefault()
    }}
    onLostPointerCapture={event=>{if(event.target===event.currentTarget)cancel(event)}}
    onClickCapture={event=>{if(ignoreClick.current&&event.detail!==0){ignoreClick.current=false;clearTimeout(clickTimer.current);event.preventDefault();event.stopPropagation()}}}
    onKeyDown={event=>{if(event.target!==event.currentTarget||!['ArrowLeft','ArrowRight'].includes(event.key)||blocked())return;reset();event.preventDefault();start(event.key==='ArrowRight'?1:-1)}}>
    <div ref={content} className="swipe-navigation-content" onTransitionEnd={event=>{
      if(event.target===(motionNode.current||content.current)&&event.propertyName==='transform'&&['entering','settling'].includes(mode.current))finish()
    }}>{children}</div>
    <div ref={pictureLayer} className="swipe-navigation-picture" aria-hidden="true" inert/>
  </div>
}
