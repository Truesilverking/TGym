import { useEffect, useId, useRef, useState } from 'react'
import BodyMap from './BodyMap.jsx'
import { CHANGE_STYLES, measurementChange, measurementPosition, measurementCalloutSlots } from '../lib/measurement-map.js'
import { t } from '../lib/i18n.js'
import { measurementNumber, measurementDeltaPresentation } from '../lib/measurement-display.js'
import './BodyComparison.css'

export function measurementLeaderPoints(anchorX,anchorY,labelX,labelY,side) {
  const bendX=labelX+(side==='left'?5:-5),dx=bendX-anchorX,dy=labelY-anchorY,length=Math.hypot(dx,dy)
  // Trim 14% from the body end along the existing path. The bend, endpoint and
  // outward arrow tip stay in place beside the value, including after resize.
  const trim=length?Math.min(1,(length+5)*.14/length):0
  return `${anchorX+dx*trim},${anchorY+dy*trim} ${bendX},${labelY} ${labelX},${labelY}`
}

export default function MeasurementBodyMap({metrics,selected,onSelect,body='male'}) {
  const stage=useRef(null), marker=useId().replace(/:/g,''), [lines,setLines]=useState([])
  const {rows,slots}=measurementCalloutSlots(metrics)
  const signature=metrics.map(m=>[m.key,m.first,m.last,m.delta,m.unit].join(':')).join('|')
  useEffect(()=>{
    let frame=0,visible=!window.IntersectionObserver
    const measure=()=>{
      frame=0
      if(!visible)return
      const root=stage.current, svg=root?.querySelector('.bm-v'), matrix=svg?.getScreenCTM?.()
      if(!root || !matrix)return
      const bounds=root.getBoundingClientRect()
      const next=[...root.querySelectorAll('[data-measurement-anchor]')].flatMap(anchor=>{
        const button=root.querySelector(`[data-callout="${anchor.dataset.measurementAnchor}"]`)
        if(!button)return []
        const rect=button.getBoundingClientRect(),side=button.dataset.side,x=Number(anchor.dataset.x),y=Number(anchor.dataset.y)
        const targetX=matrix.a*x+matrix.c*y+matrix.e-bounds.left,targetY=matrix.b*x+matrix.d*y+matrix.f-bounds.top
        const labelX=(side==='left'?rect.right+2:rect.left-2)-bounds.left,labelY=(rect.top+rect.bottom)/2-bounds.top
        return [{key:anchor.dataset.measurementAnchor,points:measurementLeaderPoints(targetX,targetY,labelX,labelY,side)}]
      })
      setLines(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next)
    }
    const schedule=()=>{if(visible&&!frame)frame=requestAnimationFrame(measure)}
    const resize=window.ResizeObserver?new ResizeObserver(schedule):null
    resize?.observe(stage.current)
    stage.current?.querySelectorAll('[data-callout]').forEach(node=>resize?.observe(node))
    const anatomy=stage.current?.querySelector('.measurement-anatomy'),mutation=new MutationObserver(schedule)
    if(anatomy)mutation.observe(anatomy,{childList:true,subtree:true})
    const intersection=window.IntersectionObserver?new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);if(visible)schedule();else{cancelAnimationFrame(frame);frame=0}},{rootMargin:'200px'}):null
    if(stage.current)intersection?.observe(stage.current)
    window.addEventListener('resize',schedule);schedule()
    return()=>{cancelAnimationFrame(frame);intersection?.disconnect();resize?.disconnect();mutation.disconnect();window.removeEventListener('resize',schedule)}
  },[signature,body])
  return <div className="measurement-map measurement-callout-map">
    <div ref={stage} className="measurement-callouts" style={{'--callout-rows':rows}}>
      <div className="measurement-anatomy"><BodyMap body={body} frontOnly label={t('Body measurements')} renderOverlay={view=>slots.map(({metric:m})=>{
        const [x,y]=measurementPosition(m.key,view.vb,body)
        return <g key={m.key} data-measurement-anchor={m.key} data-x={x} data-y={y}/>
      })}/></div>
      <svg className="measurement-leaders" aria-hidden="true"><defs>
        <marker id={marker+'-normal'} markerWidth="4" markerHeight="4" markerUnits="userSpaceOnUse" refX="3.6" refY="2" orient="auto"><path d="M0 0 4 2 0 4Z" fill="var(--label-3)"/></marker>
        <marker id={marker+'-active'} markerWidth="4" markerHeight="4" markerUnits="userSpaceOnUse" refX="3.6" refY="2" orient="auto"><path d="M0 0 4 2 0 4Z" fill="var(--acc)"/></marker>
      </defs>{lines.map(line=><polyline key={line.key} data-measurement-line={line.key} points={line.points} className={line.key===selected?'selected':''} markerEnd={`url(#${marker+(line.key===selected?'-active':'-normal')})`}/>)}</svg>
      {slots.map(({metric:m,side,row})=>{
        const style=CHANGE_STYLES[measurementChange(m)],delta=measurementDeltaPresentation(m),value=m.last
        const description=`${t(m.label)}: ${measurementNumber(value)} ${t(m.unit)}. ${t('Before')}: ${measurementNumber(m.first)} ${t(m.unit)}. ${t('After')}: ${measurementNumber(m.last)} ${t(m.unit)}. ${t('Change')}: ${delta.value==null?t('More data needed'):(delta.arrow?delta.arrow+' ':'')+measurementNumber(Math.abs(delta.value))+' '+t(m.unit)}.`
        return <button type="button" key={m.key} data-callout={m.key} data-side={side} aria-pressed={selected===m.key}
          className="measurement-callout" style={{gridColumn:side==='left'?1:3,gridRow:row,'--change-color':style.color}}
          aria-label={description} title={description}
          onClick={()=>onSelect(m.key)}>
          <b>{measurementNumber(value)}</b>
          {m.last!=null&&delta.value!=null&&<small className="measurement-callout-delta" aria-hidden="true">{delta.value===0?'=':side==='left'
            ? <>{measurementNumber(Math.abs(delta.value))}<span>{delta.arrow}</span></>
            : <><span>{delta.arrow}</span>{measurementNumber(Math.abs(delta.value))}</>}</small>}
        </button>
      })}
    </div>
  </div>
}
