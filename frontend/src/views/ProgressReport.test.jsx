// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import ProgressReport from './ProgressReport.jsx'
const mock=vi.hoisted(()=>({S:{},build:vi.fn(),save:vi.fn()}))
vi.mock('../lib/progress-file.js',()=>({buildProgressFile:(...args)=>mock.build(...args),saveProgressFile:(...args)=>mock.save(...args)}))
vi.mock('../store/useStore.js',()=>({useStore:selector=>selector({S:mock.S})}))
vi.mock('../sheets.jsx',()=>({bwSheet:()=>{},measurementsSheet:()=>{},inBodySheet:()=>{},heightSheet:()=>{}}))
vi.mock('../components/LineChart.jsx',()=>({default:()=> <span>Chart</span>}))
vi.mock('../lib/i18n.js',()=>({t:(s,...args)=>s.replace(/\{(\d+)\}/g,(_,i)=>args[i]??''),exerciseNameFor:e=>e.n||e.id}))
let host,root
globalThis.IS_REACT_ACT_ENVIRONMENT=true
beforeEach(()=>{mock.build.mockReset().mockImplementation(async report=>({name:`TGym-Progress-Report-${report.range.start}_${report.range.end}.pdf`,blob:new Blob(['%PDF-1.3'])}));mock.save.mockReset().mockResolvedValue(undefined);vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-26T12:00:00'));mock.S={trainingStartDate:'2026-07-01',workouts:[],measurements:[{d:'2026-07-01',neck:30},{d:'2026-09-20',neck:35}]};host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.useRealTimers()})
const mount=()=>act(()=>root.render(<MemoryRouter><ProgressReport/></MemoryRouter>))
it('changes periods, renders sufficient/insufficient data and exports the selected range',async()=>{
 mount();expect(host.textContent).toContain('+5 cm');expect(host.textContent).toContain('+16.7%')
 act(()=>{const el=host.querySelector('select');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(host.textContent).toContain('More data needed');expect(host.textContent).not.toContain('+16.7%')
 const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:report'),click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 expect(create).toHaveBeenCalledOnce();expect(host.textContent).toContain('TGym-Progress-Report-2026-08-26_2026-09-26.pdf');expect(mock.build.mock.calls[0][0].range.start).toBe('2026-08-26');expect(click).not.toHaveBeenCalled();await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Download').click());expect(mock.save).toHaveBeenCalledOnce()
})
it('shows an empty state without invented metrics for a new user',()=>{
 mock.S={workouts:[],measurements:[]};mount();expect(host.textContent).toContain('No comparable history in this period.');expect(host.querySelector('.progress-summary')).toBeNull()
})
it('includes a workout completed this afternoon in current-day duration totals',()=>{
 vi.setSystemTime(new Date('2026-09-26T18:00:00'))
 mock.S={workouts:[{id:'afternoon',d:'2026-09-26',start:new Date('2026-09-26T16:00:00').getTime(),end:new Date('2026-09-26T17:00:00').getTime(),entries:[]}],measurements:[]}
 mount();const tile=[...host.querySelectorAll('.progress-summary>div')].find(el=>el.textContent.includes('Total time (min)'))
 expect(tile.querySelector('b').textContent).toBe('60')
})

it('recovers from generation failures without losing the report',async()=>{
 mock.build.mockRejectedValueOnce(new Error('Canvas unavailable'));mount()
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 expect(host.querySelector('[role="alert"]').textContent).toContain('Could not export');expect(host.textContent).toContain('+5 cm')
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 expect(host.querySelector('[role="alert"]')).toBeNull();expect(host.querySelector('.progress-file')).not.toBeNull()
})
it('keeps the generated file after save failure and lets the user retry',async()=>{
 mount();await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 mock.save.mockRejectedValueOnce(new Error('Disk full'))
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Download').click())
 expect(host.querySelector('[role="alert"]')).not.toBeNull();expect(host.querySelector('.progress-file')).not.toBeNull()
 mock.save.mockRejectedValueOnce(Object.assign(new Error('Canceled'),{name:'AbortError'}))
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Download').click())
 expect(host.querySelector('[role="alert"]')).toBeNull()
})
it('invalidates the old download on period change and releases its object URL',async()=>{
 const revoke=vi.spyOn(URL,'revokeObjectURL');mount()
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 act(()=>{const el=host.querySelector('select');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(host.querySelector('.progress-file')).toBeNull();expect(revoke).toHaveBeenCalledOnce()
})
it('prevents duplicate generation while a PDF is being built',async()=>{
 let resolve;mock.build.mockImplementation(()=>new Promise(r=>{resolve=r}));mount()
 const button=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report'))
 act(()=>{button.click();button.click()});expect(mock.build).toHaveBeenCalledOnce();expect(host.querySelector('select').disabled).toBe(true)
 await act(async()=>resolve({name:'test.pdf',blob:new Blob(['pdf'])}))
 expect(host.querySelector('select').disabled).toBe(false)
})

it('treats Capacitor share cancellation as dismissal, not an export failure',async()=>{
 mount();await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 mock.save.mockRejectedValueOnce(new Error('Share canceled'))
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Download').click())
 expect(host.querySelector('[role="alert"]')).toBeNull();expect(host.querySelector('.progress-file')).not.toBeNull()
})
it('discards a generated snapshot when persisted data changes during generation',async()=>{
 let resolve;mock.build.mockImplementation(()=>new Promise(r=>{resolve=r}));mount()
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 mock.S={...mock.S,measurements:[]};mount()
 await act(async()=>resolve({name:'outdated.pdf',blob:new Blob(['pdf'])}))
 expect(host.querySelector('.progress-file')).toBeNull()
})
