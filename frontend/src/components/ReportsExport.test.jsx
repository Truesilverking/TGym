// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import ReportsExport from './ReportsExport.jsx'
const mock=vi.hoisted(()=>({build:vi.fn(),save:vi.fn()}))
vi.mock('../lib/report-exports.js',async original=>({...await original(),buildSelectedReports:(...args)=>mock.build(...args),saveSelectedReports:(...args)=>mock.save(...args)}))
vi.mock('../lib/i18n.js',()=>({t:s=>s,exerciseNameFor:e=>e.id,getLang:()=> 'en',dateLocale:()=> 'en'}))
let host,root
const S={routines:[],workouts:[]},button=name=>[...host.querySelectorAll('button')].find(b=>b.textContent===name)
const checkbox=title=>[...host.querySelectorAll('.report-choice')].find(l=>l.textContent.startsWith(title)).querySelector('input')
const render=(state=S)=>act(()=>root.render(<ReportsExport S={state} close={()=>{}}/>))
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-05T12:00:00'))
 mock.build.mockReset().mockImplementation(async(s,ids)=>ids.map(id=>({id,name:id+'.pdf',blob:new Blob([id])})))
 mock.save.mockReset().mockImplementation(async(files,ids)=>ids.map(id=>({id,status:'saved'})))
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
