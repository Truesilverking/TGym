// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MeasurementBodyMap, { measurementLeaderPoints } from './MeasurementBodyMap.jsx'
import ProgressBody from './ProgressBody.jsx'
import { MEASURE_FIELDS } from '../lib/stats-insights.js'
import { measurementCalloutSlots } from '../lib/measurement-map.js'
import { measurementDeltaPresentation } from '../lib/measurement-display.js'
import { setLang } from '../lib/i18n.js'

vi.mock('../lib/body-geometry.js',()=>({loadBodyGeometry:async()=>({male:{front:{vb:'0 0 727 1280',p:{}}},female:{front:{vb:'0 0 650 1450',p:{}}}})}))
vi.mock('./LineChart.jsx',()=>({default:()=>null}))
let root,host
const metrics=MEASURE_FIELDS.map(([key,label],index)=>({key,label,first:40+index,last:40+index,delta:index%3===0?0:index%3===1?1:-1,unit:'cm'}))
beforeEach(async()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;await setLang('en');host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})

it('gives every measurement a unique exterior slot and hides arrows for zero or missing deltas',()=>{
 const layout=measurementCalloutSlots(metrics)
 expect(layout.slots).toHaveLength(MEASURE_FIELDS.length)
 expect(new Set(layout.slots.map(slot=>slot.side+slot.row)).size).toBe(MEASURE_FIELDS.length)
 expect(measurementDeltaPresentation({delta:0})).toEqual({arrow:'',value:0})
 expect(measurementDeltaPresentation({delta:null})).toEqual({arrow:'',value:null})
 expect(measurementDeltaPresentation({delta:-.04})).toEqual({arrow:'↓',value:-.04})
})
it('shows last values with inline deltas, keeping zone names and units accessible instead of visible',async()=>{
 const select=vi.fn(),before=structuredClone(metrics)
 await act(async()=>{root.render(<MeasurementBodyMap metrics={metrics} selected="neck" onSelect={select}/>);await Promise.resolve()})
 expect(host.querySelectorAll('[data-callout]')).toHaveLength(13)
 expect(host.querySelectorAll('circle')).toHaveLength(0)
 expect(host.querySelector('[data-callout="neck"] b').textContent).toBe('40')
 expect(host.querySelector('[data-callout="neck"] .measurement-callout-delta').textContent).toBe('=')
 expect(host.querySelector('[data-callout="neck"]').getAttribute('aria-label')).toContain('Change: 0 cm')
 expect(host.querySelector('[data-callout="neck"] .measurement-callout-delta').getAttribute('aria-hidden')).toBe('true')
 expect(host.querySelector('[data-callout="shoulders"] .measurement-callout-delta').textContent).toBe('↑1')
 expect(host.querySelector('[data-callout="chest"] .measurement-callout-delta').textContent).toBe('1↓')
 expect(host.querySelector('.measurement-callout-label')).toBeNull()
 for(const node of host.querySelectorAll('[data-callout]')){
  expect(node.textContent).not.toContain('cm')
  expect(node.getAttribute('aria-label')).toContain('cm')
  expect(node.title).toBe(node.getAttribute('aria-label'))
 }
 expect(host.querySelector('[data-callout="neck"]').getAttribute('aria-label')).toContain('Neck: 40 cm')
 for(const arrow of host.querySelectorAll('marker')){
  expect(arrow.getAttribute('markerWidth')).toBe('4')
  expect(arrow.getAttribute('markerHeight')).toBe('4')
  expect(arrow.getAttribute('markerUnits')).toBe('userSpaceOnUse')
 }
 await act(()=>host.querySelector('[data-callout="armLeft"]').click());expect(select).toHaveBeenCalledWith('armLeft')
 expect(metrics).toEqual(before)
})
it('preserves comparison IDs and exposes missing after values without copying an older measurement',async()=>{
 const records=[{id:'before',d:'2026-09-01',unit:'in',values:{neck:15,waist:34}},{id:'after',d:'2026-10-01',unit:'in',values:{neck:null,waist:33}}],onSelection=vi.fn(),before=structuredClone(records)
 await act(async()=>{root.render(<ProgressBody records={records} selection={{before:'before',after:'after'}} onSelection={onSelection}/>);await Promise.resolve()})
 expect(host.querySelector('[data-callout="neck"] b').textContent).toContain('—')
 expect(host.querySelector('[data-callout="neck"] small')).toBeNull()
 expect(host.querySelector('[data-callout="neck"]').getAttribute('aria-label')).toContain('Before: 15 in')
 await act(()=>host.querySelector('[data-callout="waist"]').click())
 expect(host.querySelector('[data-measurement-detail]').dataset.measurementDetail).toBe('waist')
 expect([...host.querySelectorAll('.body-dates select')].map(node=>node.value)).toEqual(['before','after'])
 expect(records).toEqual(before)
})
it('uses the newest record by default while retaining comparison dates and exact units in the detail',async()=>{
 const records=[{id:'before',d:'2026-09-01',unit:'in',values:{neck:15}},{id:'latest',d:'2026-10-01',unit:'in',values:{neck:15.5}}]
 await act(async()=>{root.render(<ProgressBody records={records} selection={{}} onSelection={()=>{}}/>);await Promise.resolve()})
 expect(host.querySelector('[data-callout="neck"] b').textContent).toBe('15.5')
 expect(host.querySelector('[data-callout="neck"] small').textContent).toBe('0.5↑')
 expect([...host.querySelectorAll('.body-dates select')].map(node=>node.value)).toEqual(['before','latest'])
 expect(host.querySelector('.body-detail').textContent).toContain('15.5 in')
 expect(host.querySelector('.body-detail').textContent).toContain('01/10/2026')
})
it('keeps compact date choices identifiable and preserves explicit comparison IDs when dates repeat',async()=>{
 const records=[{id:'morning',d:'2026-09-01',unit:'cm',values:{neck:40}},{id:'evening',d:'2026-09-01',unit:'cm',values:{neck:41}},{id:'latest',d:'2026-10-22',unit:'cm',values:{neck:42}}],before=structuredClone(records),onSelection=vi.fn()
 await act(async()=>{root.render(<ProgressBody records={records} selection={{before:'evening',after:'latest'}} onSelection={onSelection}/>);await Promise.resolve()})
 const [first,last]=host.querySelectorAll('.body-dates select')
 expect(first.value).toBe('evening');expect(last.value).toBe('latest')
 expect([...first.options].map(option=>option.textContent)).toEqual(['01/09/26 · 1','01/09/26 · 2','22/10/26'])
 expect(first.getAttribute('aria-label')).toMatch(/^Before: .*2026 · 2$/)
 expect(last.getAttribute('aria-label')).toMatch(/^After: .*2026 · 3$/)
 expect([...first.options].every(option=>option.getAttribute('aria-label').includes('2026'))).toBe(true)
 expect(first.title).toBe(first.getAttribute('aria-label'))
 await act(()=>{first.value='morning';first.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(onSelection).toHaveBeenCalledExactlyOnceWith({before:'morning',after:'latest'})
 expect(records).toEqual(before)
})
it('keeps an empty comparison empty without dates or a redundant measurement selector',async()=>{
 const onSelection=vi.fn()
 await act(async()=>root.render(<ProgressBody records={[]} selection={{}} onSelection={onSelection}/>))
 expect(host.textContent).toContain('No comparable history in this period.')
 expect(host.querySelector('select,[data-callout]')).toBeNull()
 expect(onSelection).not.toHaveBeenCalled()
})
it('retains single-record dates and direct access to all thirteen zones without a measurement dropdown',async()=>{
 const records=[{id:'only',d:'2026-10-22',unit:'cm',values:Object.fromEntries(MEASURE_FIELDS.map(([key],i)=>[key,40+i]))}],onSelection=vi.fn(),before=structuredClone(records)
 await act(async()=>{root.render(<ProgressBody records={records} selection={{}} onSelection={onSelection} disabled/>);await Promise.resolve()})
 expect(host.querySelector('.body-zone-select')).toBeNull()
 const dates=[...host.querySelectorAll('select')]
 expect(dates).toHaveLength(2)
 expect(dates.map(node=>node.value)).toEqual(['only','only'])
 expect(dates.every(node=>node.disabled)).toBe(true)
 const buttons=[...host.querySelectorAll('[data-callout]')]
 expect(buttons).toHaveLength(13)
 for(const button of buttons){
  button.focus();expect(document.activeElement).toBe(button)
  await act(()=>button.click())
  expect(host.querySelector('[data-measurement-detail]').dataset.measurementDetail).toBe(button.dataset.callout)
  expect(button.getAttribute('aria-pressed')).toBe('true')
 }
 expect(records).toEqual(before);expect(onSelection).not.toHaveBeenCalled()
 expect([...host.querySelectorAll('.measurement-callout-delta')].every(node=>node.textContent==='=')).toBe(true)
})
it.each([['left',100,20,20,40],['right',0,20,80,40]])('shortens a %s leader by 14% while retaining its outward endpoint and bend', (side,anchorX,anchorY,labelX,labelY)=>{
 const points=measurementLeaderPoints(anchorX,anchorY,labelX,labelY,side).split(' ').map(point=>point.split(',').map(Number))
 const bendX=labelX+(side==='left'?5:-5),original=Math.hypot(bendX-anchorX,labelY-anchorY)+5
 const length=Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1])+5
 expect(length/original).toBeCloseTo(.86,10)
 expect(points[1]).toEqual([bendX,labelY]);expect(points[2]).toEqual([labelX,labelY])
 expect(Math.hypot(points[0][0]-anchorX,points[0][1]-anchorY)).toBeCloseTo(original*.14,10)
})
it('defers geometry reads until the existing body enters the near viewport',async()=>{
 let intersect;const frames=[]
 vi.stubGlobal('IntersectionObserver',class{constructor(callback,options){intersect=callback;expect(options.rootMargin).toBe('200px')}observe(){}disconnect(){}})
 vi.stubGlobal('requestAnimationFrame',callback=>{frames.push(callback);return frames.length})
 vi.stubGlobal('cancelAnimationFrame',vi.fn())
 await act(async()=>{root.render(<MeasurementBodyMap metrics={metrics} selected="neck" onSelect={()=>{}}/>);await Promise.resolve()})
 const matrix=vi.fn(()=>({a:1,b:0,c:0,d:1,e:0,f:0}));host.querySelector('.bm-v').getScreenCTM=matrix
 expect(frames).toHaveLength(0);expect(matrix).not.toHaveBeenCalled()
 await act(()=>intersect([{isIntersecting:true}]));expect(frames).toHaveLength(1)
 await act(()=>frames.shift()());expect(matrix).toHaveBeenCalledOnce();expect(host.querySelectorAll('[data-measurement-line]')).toHaveLength(13)
 await act(()=>{intersect([{isIntersecting:false}]);window.dispatchEvent(new Event('resize'))})
 expect(matrix).toHaveBeenCalledOnce();expect(frames).toHaveLength(0)
})
