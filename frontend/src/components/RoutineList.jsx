import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'
import { exCount } from '../lib/format.js'
import { glyphOf } from '../lib/glyphs.js'
import { vibrate } from '../lib/sound.js'
import { orderedRoutines } from '../lib/routine-order.js'

// A short, deliberate hold; tolerate finger jitter without stealing a scrolling gesture.
export const REORDER_HOLD_MS = 650
const MOVE_TOLERANCE = 12

export default function RoutineList({ S, onOpen, onDelete, onInfo, onReorder }) {
 const rows=orderedRoutines(S), list=useRef(null), gesture=useRef(null), suppress=useRef(false), latest=useRef(null)
 const [drag,setDrag]=useState(null)
 latest.current={S,onDelete,onReorder}
 const feedback=()=>{if(latest.current.S.vibration!==false)vibrate(35)}
 const targetAt=y=>{
  const boxes=[...list.current.querySelectorAll('[data-routine-id]')]
  return boxes.find(el=>y<el.getBoundingClientRect().bottom)?.dataset.routineId || boxes.at(-1)?.dataset.routineId
 }
 const refresh=()=>{const g=gesture.current;if(g?.reorder){g.target=targetAt(g.y);setDrag({id:g.id,target:g.target,reorder:true,y:g.y})}}
 const scroll=()=>{
  const g=gesture.current;if(!g?.reorder)return
  const edge=80,h=window.innerHeight
  if(g.y<edge)window.scrollBy(0,-Math.ceil((edge-g.y)/6))
  else if(g.y>h-edge)window.scrollBy(0,Math.ceil((g.y-h+edge)/6))
  refresh();g.frame=requestAnimationFrame(scroll)
 }
 const begin=(point,el)=>{
  if(gesture.current)return
  const g={id:el.dataset.routineId,startX:point.clientX,startY:point.clientY,y:point.clientY,width:el.getBoundingClientRect().width}
  suppress.current=false;gesture.current=g
  g.timer=setTimeout(()=>{if(gesture.current!==g)return;g.reorder=true;g.target=g.id;suppress.current=true;feedback();refresh();g.frame=requestAnimationFrame(scroll)},REORDER_HOLD_MS)
 }
 const move=point=>{
  const g=gesture.current;if(!g)return
  g.y=point.clientY
  if(g.reorder){refresh();return}
  const x=point.clientX-g.startX,y=point.clientY-g.startY
  if(Math.hypot(x,y)<=MOVE_TOLERANCE)return
  clearTimeout(g.timer)
  if(Math.abs(y)>Math.abs(x)){g.vertical=true;g.armed=false;suppress.current=true;setDrag(null);return}
  if(g.vertical||x>0)return
  const dx=Math.max(-g.width,x),armed=Math.abs(dx)>=Math.min(160,g.width*.5)
  if(armed&&!g.armed)feedback();g.armed=armed
  if(Math.abs(dx)>8)suppress.current=true
  setDrag({id:g.id,dx,armed})
 }
 const finish=cancel=>{
  const g=gesture.current;if(!g)return
  clearTimeout(g.timer);cancelAnimationFrame(g.frame);gesture.current=null;setDrag(null)
  if(cancel){suppress.current=true;return}
  if(g.reorder){if(g.target)latest.current.onReorder(g.id,g.target)}
  else if(!g.vertical&&g.armed){const row=latest.current.S.routines.find(r=>r.id===g.id);if(row)latest.current.onDelete(row)}
 }
 useEffect(()=>{
  const node=list.current
  const start=e=>{if(e.touches.length!==1){finish(true);return}const row=e.target.closest('[data-routine-id]');if(row&&!e.target.closest('button'))begin(e.touches[0],row)}
  const touchMove=e=>{if(gesture.current?.reorder)e.preventDefault();if(e.touches.length===1)move(e.touches[0]);else finish(true)}
  const end=e=>{if(gesture.current?.reorder && e.cancelable)e.preventDefault();finish(false)},cancel=()=>finish(true),context=e=>{if(gesture.current)e.preventDefault()}
  const pointerMove=e=>{if(e.pointerType!=='touch')move(e)},pointerEnd=e=>{if(e.pointerType!=='touch')finish(false)},pointerCancel=e=>{if(e.pointerType!=='touch')finish(true)}
  node.addEventListener('touchstart',start,{passive:true});node.addEventListener('contextmenu',context)
  document.addEventListener('touchmove',touchMove,{passive:false});document.addEventListener('touchend',end,{passive:false});document.addEventListener('touchcancel',cancel)
  document.addEventListener('pointermove',pointerMove);document.addEventListener('pointerup',pointerEnd);document.addEventListener('pointercancel',pointerCancel)
  window.addEventListener('blur',cancel)
  return()=>{cancel();node.removeEventListener('touchstart',start);node.removeEventListener('contextmenu',context);document.removeEventListener('touchmove',touchMove);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel);window.removeEventListener('blur',cancel);document.removeEventListener('pointermove',pointerMove);document.removeEventListener('pointerup',pointerEnd);document.removeEventListener('pointercancel',pointerCancel)}
 },[])
 const shift=(id,dir)=>{const index=rows.findIndex(r=>r.id===id),target=rows[index+dir];if(target)onReorder(id,target.id)}
 return <><div ref={list} className={'routine-list'+(drag?.reorder?' reordering':'')}>
 {rows.map((r,index)=><div key={r.id} data-routine-id={r.id} className={'swipe-routine'+(drag?.id===r.id&&drag.dx<0?' swiping':'')+(drag?.id===r.id&&drag.armed?' armed':'')+(drag?.id===r.id&&drag.reorder?' dragging':'')+(drag?.target===r.id&&drag.id!==r.id?' drop-target':'')} style={{'--swipe-x':`${drag?.id===r.id?drag.dx||0:0}px`}}>
 <div className="swipe-delete" aria-hidden="true"><Icon name="trash"/>{drag?.id===r.id&&drag.armed?t('Release to delete'):t('Swipe to delete')}</div>
 <div className="item swipe-content" onDragStart={e=>e.preventDefault()} onPointerDown={e=>{if(e.pointerType==='touch'||e.button!==0||e.target.closest('button'))return;e.preventDefault();begin(e,e.currentTarget.parentElement)}} onClick={()=>{if(suppress.current){suppress.current=false;return}onOpen(r.id)}}>
 <span className="lrow-i"><Icon name={glyphOf(r.emoji)}/></span><div className="grow"><div className="tt" title={r.name}>{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
 <div className="routine-row-actions">
 <button type="button" className="iconbtn" disabled={index===0} aria-label={t('Move up')+' · '+r.name} title={t('Move up')} onClick={e=>{e.stopPropagation();shift(r.id,-1)}}><Icon name="arrowUp"/></button>
 <button type="button" className="iconbtn" disabled={index===rows.length-1} aria-label={t('Move down')+' · '+r.name} title={t('Move down')} onClick={e=>{e.stopPropagation();shift(r.id,1)}}><Icon name="arrowDown"/></button>
 <button type="button" className="iconbtn" aria-label={t('Muscles trained')} onClick={e=>{e.stopPropagation();onInfo(r.id)}}><Icon name="info"/></button>
 </div>
 </div>

 </div>)}
 </div>{drag?.reorder&&<div className="routine-drag-preview" aria-hidden="true" style={{top:Math.max(48,Math.min(window.innerHeight-48,drag.y))}}><Icon name="list"/>{rows.find(r=>r.id===drag.id)?.name}</div>}<span className="sr-only" role="status">{drag?.reorder?t('Move the routine, then release to save.'):''}</span></>
}
