import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'
import { exCount } from '../lib/format.js'
import { glyphOf } from '../lib/glyphs.js'
import { vibrate } from '../lib/sound.js'
import { orderedRoutines } from '../lib/routine-order.js'

export default function RoutineList({ S, onOpen, onDelete, onInfo, onReorder }) {
 const rows=orderedRoutines(S), list=useRef(null), gesture=useRef(null), suppress=useRef(false), latest=useRef(null)
 const [drag,setDrag]=useState(null),[moving,setMoving]=useState(null)
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
  suppress.current=false;gesture.current=g;setMoving(null)
  g.timer=setTimeout(()=>{if(gesture.current!==g)return;g.reorder=true;g.target=g.id;suppress.current=true;feedback();refresh();g.frame=requestAnimationFrame(scroll)},2500)
 }
 const move=point=>{
  const g=gesture.current;if(!g)return
  g.y=point.clientY
  if(g.reorder){refresh();return}
  const x=point.clientX-g.startX,y=point.clientY-g.startY
  if(Math.hypot(x,y)>8)clearTimeout(g.timer)
  if(Math.abs(y)>Math.abs(x)&&Math.abs(y)>8){g.vertical=true;return}
  if(g.vertical||x>0)return
  const dx=Math.max(-g.width,x),armed=Math.abs(dx)>=g.width*.72
  if(armed&&!g.armed)feedback();g.armed=armed
  if(Math.abs(dx)>8)suppress.current=true
  setDrag({id:g.id,dx,armed})
 }
 const finish=cancel=>{
  const g=gesture.current;if(!g)return
  clearTimeout(g.timer);cancelAnimationFrame(g.frame);gesture.current=null;setDrag(null)
  if(cancel)return
  if(g.reorder){if(g.target)latest.current.onReorder(g.id,g.target)}
  else if(!g.vertical&&g.armed){const row=latest.current.S.routines.find(r=>r.id===g.id);if(row)latest.current.onDelete(row)}
 }
 useEffect(()=>{
  const node=list.current
  const start=e=>{if(e.touches.length!==1){finish(true);return}const row=e.target.closest('[data-routine-id]');if(row&&!e.target.closest('button'))begin(e.touches[0],row)}
  const touchMove=e=>{if(gesture.current?.reorder)e.preventDefault();if(e.touches.length===1)move(e.touches[0]);else finish(true)}
  const end=()=>finish(false),cancel=()=>finish(true),context=e=>{if(gesture.current||drag?.reorder)e.preventDefault()}
  node.addEventListener('touchstart',start,{passive:true});node.addEventListener('contextmenu',context)
  document.addEventListener('touchmove',touchMove,{passive:false});document.addEventListener('touchend',end);document.addEventListener('touchcancel',cancel)
  window.addEventListener('blur',cancel)
  return()=>{cancel();node.removeEventListener('touchstart',start);node.removeEventListener('contextmenu',context);document.removeEventListener('touchmove',touchMove);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel);window.removeEventListener('blur',cancel)}
 },[])
 const shift=(id,dir)=>{const index=rows.findIndex(r=>r.id===id),target=rows[index+dir];if(target)onReorder(id,target.id)}
 return <><p className="small muted routine-order-hint">{t('Hold a routine for 2.5 seconds to reorder.')}</p><div ref={list} className={'routine-list'+(drag?.reorder?' reordering':'')}>
 {rows.map((r,index)=><div key={r.id} data-routine-id={r.id} className={'swipe-routine'+(moving===r.id?' ordering':'')+(drag?.id===r.id&&drag.armed?' armed':'')+(drag?.id===r.id&&drag.reorder?' dragging':'')+(drag?.target===r.id&&drag.id!==r.id?' drop-target':'')} style={{'--swipe-x':`${drag?.id===r.id?drag.dx||0:0}px`}}>
 <div className="swipe-delete" aria-hidden="true"><Icon name="trash"/>{drag?.id===r.id&&drag.armed?t('Release to delete'):t('Swipe to delete')}</div>
 <div className="item swipe-content" onPointerDown={e=>{if(e.pointerType==='touch'||e.button!==0||e.target.closest('button'))return;begin(e,e.currentTarget.parentElement);e.currentTarget.setPointerCapture?.(e.pointerId)}} onPointerMove={e=>{if(e.pointerType!=='touch')move(e)}} onPointerUp={e=>{if(e.pointerType!=='touch')finish(false)}} onPointerCancel={e=>{if(e.pointerType!=='touch')finish(true)}} onClick={()=>{if(suppress.current){suppress.current=false;return}onOpen(r.id)}}>
 <span className="lrow-i"><Icon name={glyphOf(r.emoji)}/></span><div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
 <button className="iconbtn" aria-label={t('Reorder routine')+' · '+r.name} aria-expanded={moving===r.id} onClick={e=>{e.stopPropagation();setMoving(moving===r.id?null:r.id)}}><Icon name="list"/></button>
 <button className="iconbtn" aria-label={t('Muscles trained')} onClick={e=>{e.stopPropagation();onInfo(r.id)}}><Icon name="info"/></button>
 </div>
 {moving===r.id&&<div className="routine-order-actions"><button className="btn sm" disabled={index===0} onClick={()=>shift(r.id,-1)}><Icon name="arrowUp"/>{t('Move up')}</button><button className="btn sm" disabled={index===rows.length-1} onClick={()=>shift(r.id,1)}><Icon name="arrowDown"/>{t('Move down')}</button><button className="btn sm" onClick={()=>setMoving(null)}>{t('Done')}</button></div>}
 </div>)}
 </div>{drag?.reorder&&<div className="routine-drag-preview" aria-hidden="true" style={{top:Math.max(48,Math.min(window.innerHeight-48,drag.y))}}><Icon name="list"/>{rows.find(r=>r.id===drag.id)?.name}</div>}<span className="sr-only" role="status">{drag?.reorder?t('Move the routine, then release to save.'):''}</span></>
}
