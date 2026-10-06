// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import ReportsExport from './ReportsExport.jsx'
import { STATS_SECTIONS } from '../lib/stats-sections.js'
const mock=vi.hoisted(()=>({build:vi.fn(),save:vi.fn()}))
vi.mock('../lib/report-exports.js',async original=>({...await original(),buildSelectedReports:(...args)=>mock.build(...args),saveSelectedReports:(...args)=>mock.save(...args)}))
vi.mock('../lib/i18n.js',()=>({t:s=>s,exerciseNameFor:e=>e.id,getLang:()=> 'en',dateLocale:()=> 'en'}))
let host,root
const S={routines:[],workouts:[]},button=name=>[...host.querySelectorAll('button')].find(b=>b.textContent===name)
const checkbox=title=>[...host.querySelectorAll('.report-choice')].find(l=>l.textContent.startsWith(title)).querySelector('input')
const render=(state=S,props={})=>act(()=>root.render(<ReportsExport S={state} close={()=>{}} {...props}/>))
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-05T12:00:00'))
 mock.build.mockReset().mockImplementation(async(s,ids,settings,options)=>options?.combinePDF?[{id:'reports',reportIds:ids,name:'dashboards.pdf',blob:new Blob([ids.join(',')])}]:ids.map(id=>({id,name:id+'.pdf',blob:new Blob([id])})))
 mock.save.mockReset().mockImplementation(async(files,ids)=>files.filter(file=>file.reportIds?file.reportIds.every(id=>ids.includes(id)):ids.includes(file.id)).map(file=>({id:file.id,status:'saved'})))
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers()})
it('defaults only to Streak and downloads exactly the chosen independent files',async()=>{
 render();expect(checkbox('Streak Report').checked).toBe(true);expect(checkbox('Consistency Report').checked).toBe(false)
 act(()=>checkbox('Workout history').click())
 await act(async()=>button('Download Selected').click())
 expect(mock.build.mock.calls[0][1]).toEqual(['streak','history']);expect(mock.save.mock.calls[0][1]).toEqual(['streak','history'])
 expect(host.querySelectorAll('.report-results li')).toHaveLength(2)
 expect(host.textContent).not.toContain('consistency.pdf')
})
it('supports Select All, clearing selection and explicit Download All',async()=>{
 render();act(()=>checkbox('Select All').click());expect(host.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(8)
 act(()=>checkbox('Select All').click());expect(button('Download Selected').disabled).toBe(true)
 await act(async()=>button('Download All').click())
 expect(mock.build.mock.calls[0][1]).toHaveLength(7);expect(mock.save.mock.calls[0][1]).toContain('consistency')
})
it('rejects invalid Custom Range and forwards valid inclusive dates',async()=>{
 render();const select=host.querySelector('.report-date-controls select')
 act(()=>{select.value='custom';select.dispatchEvent(new Event('change',{bubbles:true}))})
 const dates=host.querySelectorAll('input[type="date"]')
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(dates[0],'2026-10-06');dates[0].dispatchEvent(new Event('change',{bubbles:true}))})
 expect(button('Download Selected').disabled).toBe(true);expect(host.querySelector('[role="alert"]').textContent).toBe('Choose a valid date range.')
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(dates[0],'2026-10-01');dates[0].dispatchEvent(new Event('change',{bubbles:true}))})
 await act(async()=>button('Download Selected').click())
 expect(mock.build.mock.calls[0][2].streak).toMatchObject({period:'custom',from:'2026-10-01',to:'2026-10-05'})
})
it('reveals invalid hidden filters on Download All before generating any file',()=>{
 render();act(()=>{const select=host.querySelector('select');select.value='custom';select.dispatchEvent(new Event('change',{bubbles:true}))})
 const input=host.querySelector('input[type="date"]')
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('change',{bubbles:true}))})
 act(()=>checkbox('Streak Report').click());act(()=>button('Download All').click())
 expect(checkbox('Streak Report').checked).toBe(true);expect(host.querySelector('[role="alert"]')).not.toBeNull();expect(mock.build).not.toHaveBeenCalled()
})
it('retains files for individual retry and invalidates them when source changes',async()=>{
 mock.save.mockResolvedValueOnce([{id:'streak',status:'failed'}]);render()
 await act(async()=>button('Download Selected').click());expect(host.textContent).toContain('Export failed. Please try again.')
 await act(async()=>button('Download').click());expect(mock.save.mock.calls[1][1]).toEqual(['streak'])
 render({...S,bodyweight:[]});expect(host.querySelectorAll('.report-results li')).toHaveLength(0)
})
it('blocks double generation and discards stale results',async()=>{
 let resolve;mock.build.mockImplementation(()=>new Promise(r=>{resolve=r}));render()
 act(()=>{const b=button('Download Selected');b.click();b.click()})
 expect(mock.build).toHaveBeenCalledOnce();render({...S,workouts:[]})
 await act(async()=>resolve([{id:'streak',name:'old.pdf',blob:new Blob(['x'])}]))
 expect(mock.save).not.toHaveBeenCalled();expect(host.textContent).not.toContain('old.pdf')
})

it('keeps the confirmed naming preferences for generation and discards the file if preferences change meanwhile',async()=>{
 let resolve;mock.build.mockImplementation(()=>new Promise(r=>{resolve=r}))
 const exercise={id:'report-name-test',n:'Original report exercise'},state={...S,exerciseAliases:{[exercise.id]:'My report nickname'}}
 render(state,{pdf:true});act(()=>button('Download Selected').click())
 const name=mock.build.mock.calls[0][3].name
 expect(name(exercise)).toBe('My report nickname')
 render({...state,exerciseNameMode:'original',exerciseAliases:{[exercise.id]:'Edited nickname'}},{pdf:true})
 expect(name(exercise)).toBe('My report nickname')
 await act(async()=>resolve([{id:'reports',reportIds:['streak'],name:'stale.pdf',blob:new Blob(['pdf'])}]))
 expect(mock.save).not.toHaveBeenCalled();expect(host.textContent).not.toContain('stale.pdf')
})

const statsCheckbox=id=>{
 const label=STATS_SECTIONS.find(([value])=>value===id)[1],scope=host.querySelector('[data-report="stats"] .report-settings')
 return [...scope.querySelectorAll('input[type="checkbox"], [role="checkbox"]')].find(node=>node.getAttribute('aria-label')===label||node.closest('label')?.textContent.trim()===label)
}
const checked=node=>node.matches('input')?node.checked:node.getAttribute('aria-checked')==='true'
const confirm=()=>host.querySelector('.report-actions button.primary')

it('offers only the four PDF dashboards and cancels without generating or saving',async()=>{
 const close=vi.fn(),state={...S,statsSections:['bodyweight']},before=JSON.stringify(state)
 render(state,{pdf:true,close})
 expect([...host.querySelectorAll('[data-report]')].map(node=>node.dataset.report)).toEqual(['streak','consistency','progress','stats'])
 for(const id of ['history','plan','backup'])expect(host.querySelector(`[data-report="${id}"]`)).toBeNull()
 expect(mock.build).not.toHaveBeenCalled();expect(mock.save).not.toHaveBeenCalled()
 await act(async()=>button('Cancel').click())
 expect(close).toHaveBeenCalledOnce();expect(mock.build).not.toHaveBeenCalled();expect(mock.save).not.toHaveBeenCalled()
 expect(JSON.stringify(state)).toBe(before)
})

it('exports only Stats with the chosen subsection and its retained dashboard filters into one PDF',async()=>{
 const filters={range:30,exId:'1254',exMetric:'top'},state={...S,statsSections:['bodyweight']},before=JSON.stringify(state)
 render(state,{pdf:true,statsFilters:filters})
 act(()=>{checkbox('Streak Report').click();checkbox('Stats').click()})
 for(const [id] of STATS_SECTIONS)expect(checked(statsCheckbox(id))).toBe(true)
 for(const [id] of STATS_SECTIONS)if(id!=='exercise')act(()=>statsCheckbox(id).click())
 expect(checked(statsCheckbox('exercise'))).toBe(true)
 expect(mock.build).not.toHaveBeenCalled()
 await act(async()=>confirm().click())
 expect(mock.build).toHaveBeenCalledOnce()
 expect(mock.build.mock.calls[0][0]).toBe(state)
 expect(mock.build.mock.calls[0][1]).toEqual(['stats'])
 expect(mock.build.mock.calls[0][2].stats).toMatchObject({sections:['exercise'],filters})
 expect(mock.build.mock.calls[0][3]).toMatchObject({combinePDF:true})
 expect(mock.save).toHaveBeenCalledOnce();expect(mock.save.mock.calls[0][1]).toEqual(['stats'])
 expect(host.querySelectorAll('.report-results li')).toHaveLength(1)
 expect(host.textContent).toContain('dashboards.pdf')
 expect(JSON.stringify(state)).toBe(before)
})

it('selects every PDF dashboard with all Stats subsections independently of screen visibility',async()=>{
 const state={...S,statsSections:['bodyweight']},before=JSON.stringify(state)
 render(state,{pdf:true})
 act(()=>checkbox('Select All').click())
 expect([...host.querySelectorAll('[data-report] > .report-choice input')].every(node=>node.checked)).toBe(true)
 for(const [id] of STATS_SECTIONS)expect(checked(statsCheckbox(id))).toBe(true)
 await act(async()=>confirm().click())
 expect(mock.build.mock.calls[0][1]).toEqual(['streak','consistency','progress','stats'])
 expect(mock.build.mock.calls[0][2].stats.sections).toEqual(STATS_SECTIONS.map(([id])=>id))
 expect(mock.build.mock.calls[0][3]).toMatchObject({combinePDF:true})
 expect(mock.save.mock.calls[0][0]).toHaveLength(1)
 expect(mock.save.mock.calls[0][0][0].reportIds).toEqual(['streak','consistency','progress','stats'])
 expect(host.querySelectorAll('.report-results li')).toHaveLength(1)
 expect(JSON.stringify(state)).toBe(before)
})

it('disables PDF confirmation when no dashboard report is selected',()=>{
 render(S,{pdf:true})
 act(()=>checkbox('Streak Report').click())
 expect(confirm().disabled).toBe(true)
 expect(mock.build).not.toHaveBeenCalled();expect(mock.save).not.toHaveBeenCalled()
})

it('blocks both selected and all-dashboard generation when Stats has no chosen subsection',()=>{
 render(S,{pdf:true})
 act(()=>{checkbox('Streak Report').click();checkbox('Stats').click()})
 for(const [id] of STATS_SECTIONS)act(()=>statsCheckbox(id).click())
 expect(confirm().disabled).toBe(true)
 expect(host.querySelector('[role="alert"]').textContent).toBe('Select at least one section.')
 act(()=>button('Download All').click())
 expect(mock.build).not.toHaveBeenCalled();expect(mock.save).not.toHaveBeenCalled()
 for(const [id] of STATS_SECTIONS)expect(checked(statsCheckbox(id))).toBe(false)
})

it('retries the combined PDF with its original report IDs',async()=>{
 mock.save.mockResolvedValueOnce([{id:'reports',status:'failed'}])
 render(S,{pdf:true})
 act(()=>checkbox('Stats').click())
 await act(async()=>confirm().click())
 expect(host.textContent).toContain('Export failed. Please try again.')
 await act(async()=>button('Download').click())
 expect(mock.save.mock.calls[1][1]).toEqual(['streak','stats'])
 expect(mock.save.mock.calls[1][0]).toHaveLength(1)
 expect(mock.build).toHaveBeenCalledOnce()
})
