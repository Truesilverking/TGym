// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TotalTimeMetric, { totalTimePresentation } from './TotalTimeMetric.jsx'
import { useUI } from '../store/useUI.js'
import { setLang } from '../lib/i18n.js'

let host, root
function Sheets() { return useUI(s=>s.sheets).map(sheet=><div key={sheet.id} data-picker>{sheet.render(sheet.close || (()=>useUI.getState().closeSheet(sheet.id)))}</div>) }
const render = async minutes => act(()=>root.render(<><TotalTimeMetric minutes={minutes}/><Sheets/></>))
const metric = () => host.querySelector('.total-time-metric')
const pointer = async (type, options={}) => act(()=>metric().dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,isPrimary:true,clientX:20,clientY:20,...options})))
beforeEach(async()=>{vi.useFakeTimers();globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();useUI.setState({sheets:[]});await setLang('en');host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.useRealTimers()})

it('changes automatic display units only at the hour and day boundaries',()=>{
 expect(totalTimePresentation(59)).toEqual({unit:'minutes',value:59})
 expect(totalTimePresentation(60)).toEqual({unit:'hours',value:1})
 expect(totalTimePresentation(1439).unit).toBe('hours')
 expect(totalTimePresentation(1440)).toEqual({unit:'days',value:1})
 expect(totalTimePresentation(2880,'minutes')).toEqual({unit:'minutes',value:2880})
 expect(totalTimePresentation(NaN)).toEqual({unit:'minutes',value:0})
})
it('opens after a complete three-second hold and keeps a manual unit in component state only',async()=>{
 await render(2880);expect(metric().dataset.timeUnit).toBe('days')
 await pointer('pointerdown');await act(()=>vi.advanceTimersByTime(2999));expect(useUI.getState().sheets).toHaveLength(0)
 await act(()=>vi.advanceTimersByTime(1));expect(useUI.getState().sheets).toHaveLength(1)
 const minutes=[...host.querySelectorAll('[data-picker] button')].find(node=>node.textContent==='Minutes')
 await act(()=>minutes.click());expect(metric().dataset.timeUnit).toBe('minutes')
 await render(60);expect(metric().dataset.timeUnit).toBe('minutes');expect(localStorage.length).toBe(0)
})
it.each(['pointermove','pointercancel','touchcancel','scroll'])('cancels a hold on %s',async type=>{
 await render(60);await pointer('pointerdown');await act(()=>vi.advanceTimersByTime(2200))
 if(type==='scroll')await act(()=>document.dispatchEvent(new Event('scroll')))
 else if(type==='touchcancel')await act(()=>metric().dispatchEvent(new Event('touchcancel',{bubbles:true})))
 else await pointer(type,{clientX:40})
 await act(()=>vi.advanceTimersByTime(1000));expect(useUI.getState().sheets).toHaveLength(0)
})
it('exposes an immediate keyboard alternative and never rounds a positive manual value to zero',async()=>{
 await render(1)
 await act(()=>metric().dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0})))
 const days=[...host.querySelectorAll('[data-picker] button')].find(node=>node.textContent==='Days')
 await act(()=>days.click());expect(metric().dataset.timeUnit).toBe('days');expect(metric().querySelector('b').textContent).not.toBe('0')
 expect(localStorage.length).toBe(0)
})
