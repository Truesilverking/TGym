import {useEffect,useId,useRef,useState} from 'react'
import {useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {t} from '../lib/i18n.js'
import {statsSelectionOrder} from '../lib/stats-sections.js'
import {syncStatsGestureExclusion} from '../lib/system-appearance.js'
import {Button,Check} from './ui.jsx'
import Icon from './Icon.jsx'
import { nav } from '../lib/nav.js'
import { STATS_PAGES, STATS_EXTRA_PAGES, statsPageOrder, statsPageTarget } from '../lib/navigation-model.js'
import '../views/Stats.css'

const SIZE=44,GAP=8
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value))
export function normalizeStatsControlPosition(value){
 return {side:value?.side==='left'?'left':'right',y:Number.isFinite(value?.y)?clamp(value.y,0,1):.5}
}
export function statsControlPlacement(position,bounds){
 return {x:position.side==='left'?bounds.left:bounds.right,y:bounds.top+position.y*(bounds.bottom-bounds.top)}
}

function readBounds(){
 const viewport=window.visualViewport,style=getComputedStyle(document.documentElement)
 const inset=key=>parseFloat(style.getPropertyValue(key))||0
 const view={left:viewport?.offsetLeft||0,top:viewport?.offsetTop||0,width:viewport?.width||window.innerWidth,height:viewport?.height||window.innerHeight}
 const app=document.getElementById('app')?.getBoundingClientRect()
 const safeLeft=view.left+inset('--sal'),safeRight=view.left+view.width-inset('--sar')
 const left=clamp(app?.width?app.left:safeLeft,safeLeft,Math.max(safeLeft,safeRight-SIZE))
 const right=Math.max(left,Math.min(app?.width?app.right:safeRight,safeRight)-SIZE)
 const top=view.top+Math.max(GAP,inset('--sat'))
 let lower=view.top+view.height-Math.max(GAP,inset('--sab'))
 for(const id of ['tabbar','timer']){
  const node=document.getElementById(id),rect=node?.getBoundingClientRect()
  if(node&&rect.height>0&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden')lower=Math.min(lower,rect.top-GAP)
 }
 return {left,right,top,bottom:Math.max(top,lower-SIZE),viewLeft:view.left+Math.max(GAP,inset('--sal')),viewRight:view.left+view.width-Math.max(GAP,inset('--sar'))}
}

function useControlBounds(hasTimer){
 const [bounds,setBounds]=useState(readBounds)
 useEffect(()=>{
  let frame=0
  const refresh=()=>{frame=0;const next=readBounds();setBounds(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next)}
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(refresh)}
  const observer=window.ResizeObserver?new ResizeObserver(schedule):null
  for(const id of ['app','tabbar','timer']){const node=document.getElementById(id);if(node)observer?.observe(node)}
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);schedule()
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule)}
 },[hasTimer])
 return bounds
}

export function StatsCustomizationPanel({close,sheet=false,onSelect,activeId}){
 const S=useStore(s=>s.S),update=useStore(s=>s.update),selected=statsSelectionOrder(S.statsSections,S.statsSectionOrder)
 const [currentPage,setCurrentPage]=useState(activeId)
 useEffect(()=>setCurrentPage(activeId),[activeId])
 const order=statsPageOrder(S),fixed=new Set(STATS_EXTRA_PAGES.map(([id])=>id))
 const persistPreference=mutator=>{try{update(mutator);return true}catch{useUI.getState().toast(t('Could not save changes. Try again.'));return false}}
 const navigateTo=id=>{setCurrentPage(id);(onSelect||((id)=>nav(statsPageTarget(id))))(id)}
 const choose=id=>{
  if(!fixed.has(id)&&!selected.includes(id)&&!persistPreference(s=>{const next=[...statsSelectionOrder(s.statsSections,s.statsSectionOrder),id];s.statsSections=next;s.statsSectionOrder=[...next]}))return
  close();navigateTo(id)
 }
 const move=(id,direction)=>persistPreference(s=>{
  const next=statsPageOrder(s),index=next.indexOf(id),target=index+direction
  if(index<0||target<0||target>=next.length)return
  ;[next[index],next[target]]=[next[target],next[index]];s.statsPageOrder=next
  const selectedNow=statsSelectionOrder(s.statsSections,s.statsSectionOrder),analytics=next.filter(id=>selectedNow.includes(id))
  s.statsSections=analytics;s.statsSectionOrder=[...analytics]
 })
 const toggle=id=>{
  if(selected.includes(id)&&selected.length===1)return
  let next
  if(!persistPreference(s=>{const current=statsSelectionOrder(s.statsSections,s.statsSectionOrder);if(current.includes(id)&&current.length===1)return;next=current.includes(id)?current.filter(value=>value!==id):[...current,id];s.statsSections=next;s.statsSectionOrder=[...next]}))return
  if(id===currentPage&&next&&!next.includes(id))navigateTo(next[0])
 }
 return <div id="stats-sections-menu" className={'stats-customization-panel'+(sheet?' stats-customization-sheet':'')} role={sheet?'group':'dialog'} aria-label={t('Stats view settings')}>
  <div className="stats-customization-heading"><div><h3>{t('Sections')}</h3><p className="small muted">{t('{0} sections selected',selected.length+fixed.size)}</p></div>{!sheet&&<button type="button" className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark"/></button>}</div>
  <p id="stats-sections-hint" className="small muted">{t('Tap a section to open it. Use the arrows to change its order.')} {t('Select at least one section.')}</p>
  <div className="stats-customization-options" role="group" aria-label={t('Sections')} data-nodrag>{order.map((id,index)=>{const label=STATS_PAGES.find(row=>row[0]===id)[1];return <div key={id} className={'stats-customization-option'+(selected.includes(id)||fixed.has(id)?' selected':'')} data-stats-option={id}>
   {fixed.has(id)?<span className="stats-page-fixed" aria-hidden="true"><Icon name={id==='records'?'trophy':id==='report'?'chart':'history'}/></span>:<Check id={'stats-section-'+id} checked={selected.includes(id)} onChange={()=>toggle(id)} size={44} aria-label={t(label)} aria-describedby="stats-sections-hint"/>}
   <button type="button" className="stats-section-jump" aria-current={currentPage===id?'page':undefined} onClick={()=>choose(id)}>{t(label)}</button>
   <div className="stats-order-actions"><button type="button" disabled={index===0} onClick={()=>move(id,-1)} aria-label={t('Move {0} up',t(label))}><Icon name="chevronUp"/></button><button type="button" disabled={index===order.length-1} onClick={()=>move(id,1)} aria-label={t('Move {0} down',t(label))}><Icon name="chevronDown"/></button></div>
  </div>})}</div>
  <div className="stats-customization-footer"><Button onClick={close}>{t('Done')}</Button></div>
 </div>
}

export default function StatsSections({activeId,onSelect}){
 const stored=useStore(s=>s.S.statsControlPosition),update=useStore(s=>s.update),saved=normalizeStatsControlPosition(stored)
 const hasTimer=useUI(s=>!!s.timer||!!s.work),bounds=useControlBounds(hasTimer)
 const covered=useUI(s=>s.sheets.length>0||!!s.appTourWorkoutPreview)
 const [open,setOpen]=useState(false),[sheet,setSheet]=useState(false),[dragging,setDragging]=useState(null),[panelHeight,setPanelHeight]=useState(620)
 const container=useRef(null),trigger=useRef(null),popover=useRef(null),mobileSheet=useRef(null),gesture=useRef(null),suppressClick=useRef(false)
 const hintId=useId(),placement=dragging||statsControlPlacement(saved,bounds),side=dragging?(placement.x<(bounds.left+bounds.right)/2?'left':'right'):saved.side
 useEffect(()=>{
  const button=trigger.current
  if(open||covered||!button||button.closest('[inert],[hidden]'))syncStatsGestureExclusion(null)
  else syncStatsGestureExclusion(button.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight})
  // The persisted placement and safe bounds own this region. Ephemeral drag
  // frames never call the bridge or chase the pointer with an OS exclusion.
 },[saved.side,saved.y,bounds.left,bounds.right,bounds.top,bounds.bottom,open,covered])
 useEffect(()=>()=>{syncStatsGestureExclusion(null)},[])
 const close=()=>{mobileSheet.current?.close();mobileSheet.current=null;setOpen(false);trigger.current?.focus({preventScroll:true})}
 const toggle=()=>{
  if(open){close();return}
  const mobile=window.matchMedia('(max-width: 639px)').matches;setSheet(mobile);setOpen(true)
  if(mobile)mobileSheet.current=useUI.getState().openSheet(sheetClose=><StatsCustomizationPanel close={sheetClose} sheet activeId={activeId} onSelect={onSelect}/>,{onClose:()=>{mobileSheet.current=null;setOpen(false);trigger.current?.focus({preventScroll:true})}})
 }
 const release=g=>{try{trigger.current?.releasePointerCapture?.(g.id)}catch{}}
 const cancel=()=>{const g=gesture.current;if(!g)return;gesture.current=null;suppressClick.current=true;release(g);setDragging(null)}
 const save=position=>{try{update(s=>{s.statsControlPosition=position})}catch{useUI.getState().toast(t('Could not save changes. Try again.'))}}
 const point=(event,g)=>({x:clamp(g.x+event.clientX-g.startX,bounds.left,bounds.right),y:clamp(g.y+event.clientY-g.startY,bounds.top,bounds.bottom)})
 const pointerDown=event=>{
  if(event.button!==0||event.isPrimary===false||gesture.current)return
  suppressClick.current=false;gesture.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:placement.x,y:placement.y,bounds,moved:false}
  try{event.currentTarget.setPointerCapture?.(event.pointerId)}catch{}
 }
 const pointerMove=event=>{
  const g=gesture.current;if(!g||g.id!==event.pointerId)return
  if(!g.moved&&Math.hypot(event.clientX-g.startX,event.clientY-g.startY)<=8)return
  if(!g.moved&&open)close();g.moved=true;setDragging(point(event,g));event.preventDefault()
 }
 const pointerUp=event=>{
  const g=gesture.current;if(!g||g.id!==event.pointerId)return
  gesture.current=null;release(g)
  if(!g.moved&&Math.hypot(event.clientX-g.startX,event.clientY-g.startY)<=8)return
  const final=point(event,g);suppressClick.current=true;event.preventDefault();event.stopPropagation();setDragging(null)
  save({side:final.x<(bounds.left+bounds.right)/2?'left':'right',y:bounds.bottom>bounds.top?clamp((final.y-bounds.top)/(bounds.bottom-bounds.top),0,1):saved.y})
 }
 const keyboard=event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return
  event.preventDefault();event.stopPropagation();if(event.repeat)return;cancel();if(open)close()
  const direction=event.key
  try{update(s=>{const current=normalizeStatsControlPosition(s.statsControlPosition);s.statsControlPosition={side:direction==='ArrowLeft'?'left':direction==='ArrowRight'?'right':current.side,y:Math.round(clamp(current.y+(direction==='ArrowUp'?-.05:direction==='ArrowDown'?.05:0),0,1)*1e6)/1e6}})}catch{useUI.getState().toast(t('Could not save changes. Try again.'))}
 }
 useEffect(()=>{
  const g=gesture.current
  // A pending effect from an earlier layout must not cancel a gesture started
  // against the newly rendered bounds. Real changes during that gesture still do.
  if(g&&['left','right','top','bottom'].some(key=>g.bounds[key]!==bounds[key]))cancel()
 },[bounds.left,bounds.right,bounds.top,bounds.bottom])
 useEffect(()=>{
  const escape=event=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();cancel()}}
  window.addEventListener('keydown',escape,true)
  return()=>{window.removeEventListener('keydown',escape,true);const g=gesture.current;gesture.current=null;if(g)release(g);mobileSheet.current?.close()}
 },[])
 useEffect(()=>{
  if(!open||sheet)return
  const outside=event=>{if(!container.current?.contains(event.target))close()},escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}},focus=event=>{if(!container.current?.contains(event.target))setOpen(false)}
  container.current?.querySelector('[role="checkbox"]')?.focus({preventScroll:true})
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);document.addEventListener('focusin',focus)
  const resize=window.ResizeObserver?new ResizeObserver(()=>{const height=popover.current?.getBoundingClientRect().height;if(height)setPanelHeight(previous=>previous===height?previous:height)}):null
  if(popover.current){resize?.observe(popover.current);const height=popover.current.getBoundingClientRect().height;if(height)setPanelHeight(height)}
  return()=>{resize?.disconnect();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);document.removeEventListener('focusin',focus)}
 },[open,sheet])
 const availableHeight=Math.max(0,bounds.bottom-bounds.top+SIZE),width=Math.min(400,Math.max(0,bounds.viewRight-bounds.viewLeft-SIZE-GAP))
 const popupLeft=clamp(side==='left'?placement.x+SIZE+GAP:placement.x-GAP-width,bounds.viewLeft,Math.max(bounds.viewLeft,bounds.viewRight-width))
 const popupTop=clamp(placement.y+SIZE/2-Math.min(panelHeight,availableHeight)/2,bounds.top,Math.max(bounds.top,bounds.bottom+SIZE-Math.min(panelHeight,availableHeight)))
 const hint=t('Drag or use arrow keys to move this control.')
 return <div className="stats-view-control draggable" ref={container} data-side={side} data-dragging={!!dragging||undefined} style={{left:placement.x,top:placement.y,right:'auto'}}>
  <button ref={trigger} id="stats-sections-trigger" type="button" className={'iconbtn stats-sections-trigger'+(open?' on-ss':'')} data-tour="stats-view" aria-label={t('Stats view settings')} title={t('Stats view settings')+'. '+hint} aria-describedby={hintId} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown" aria-expanded={open} aria-haspopup="dialog" aria-controls="stats-sections-menu"
   onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={keyboard} onContextMenu={event=>event.preventDefault()}
   onClick={event=>{const skip=suppressClick.current&&event.detail!==0;suppressClick.current=false;if(skip){event.preventDefault();return}toggle()}}>
   <Icon name={(side==='right')===open?'chevronRight':'chevronLeft'}/>
  </button>
  <span id={hintId} className="stats-control-hint">{hint}</span>
  {open&&!sheet&&<div ref={popover} className="stats-customization-popover" style={{left:popupLeft-placement.x,right:'auto',top:popupTop-placement.y,transform:'none',width,'--stats-popover-max-height':Math.max(0,bounds.bottom+SIZE-popupTop-2)+'px'}}><StatsCustomizationPanel close={close} activeId={activeId} onSelect={onSelect}/></div>}
 </div>
}
