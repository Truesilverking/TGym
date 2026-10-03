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
const selectSection=label=>act(()=>{const el=host.querySelectorAll('.progress-controls select')[1];el.value=[...el.options].find(o=>o.textContent===label).value;el.dispatchEvent(new Event('change',{bubbles:true}))})
const generate=async()=>{act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click());await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Generate and download')).click())}
const mount=()=>{act(()=>root.render(<MemoryRouter><ProgressReport/></MemoryRouter>));selectSection('Body Progress')}
it('uses daily activity and stable session origin in Progress and its export',async()=>{
 const d='2026-09-26',w={id:'planned',d,routineId:'r',sessionOrigin:{type:'planned',routineId:'r'},entries:['changed','added1','added2','added3'].map(id=>({id,sets:[{done:true,r:8,w:50}]}))}
 mock.S={trainingStartDate:d,routines:[{id:'r',name:'Routine',ex:[]}],week:{6:['r']},workouts:[w]}
 mount();selectSection('Training consistency')
 const tile=label=>[...host.querySelectorAll('.progress-summary>div')].find(el=>el.querySelector('span').textContent===label)?.querySelector('b').textContent
 expect(tile('Planned')).toBe('1');expect(tile('Extra')).toBe('0');expect(tile('Active days')).toBe('1');expect(tile('Completion')).toBe('100 %')
 mock.S={...mock.S,workouts:[w,{...w,id:'extra',routineId:null,sessionOrigin:{type:'extra',routineId:null}}]}
 act(()=>root.render(<MemoryRouter><ProgressReport/></MemoryRouter>))
 expect(tile('Extra')).toBe('1');expect(tile('Active days')).toBe('1');expect(tile('Completion')).toBe('100 %')
 await generate();expect(mock.build.mock.calls[0][0].summary).toMatchObject({activeDays:1,planned:1,extra:1,rate:1})
})
it('changes periods, renders sufficient/insufficient data and exports the selected range',async()=>{
 mount();expect(host.textContent).toContain('+5 cm');expect(host.textContent).toContain('+16.7%')
 act(()=>{const el=host.querySelector('select');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(host.textContent).toContain('More data needed');expect(host.textContent).not.toContain('+16.7%')
 const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:report'),click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
 await generate()
 expect(create).toHaveBeenCalledOnce();expect(host.textContent).toContain('TGym-Progress-Report-2026-08-26_2026-09-26.pdf');expect(mock.build.mock.calls[0][0].range.start).toBe('2026-08-26');expect(click).not.toHaveBeenCalled();await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Download').click());expect(mock.save).toHaveBeenCalledTimes(2)
})
it('shows an empty state without invented metrics for a new user',()=>{
 mock.S={workouts:[],measurements:[]};mount();expect(host.textContent).toContain('No comparable history in this period.');expect(host.querySelector('.progress-summary')).toBeNull()
})
it('includes a workout completed this afternoon in current-day duration totals',()=>{
 vi.setSystemTime(new Date('2026-09-26T18:00:00'))
 mock.S={workouts:[{id:'afternoon',d:'2026-09-26',start:new Date('2026-09-26T16:00:00').getTime(),end:new Date('2026-09-26T17:00:00').getTime(),entries:[]}],measurements:[]}
 mount();selectSection('Workout duration');const tile=[...host.querySelectorAll('.progress-summary>div')].find(el=>el.textContent.includes('Total time (min)'))
 expect(tile.querySelector('b').textContent).toBe('60')
})

it('recovers from generation failures without losing the report',async()=>{
 mock.build.mockRejectedValueOnce(new Error('Canvas unavailable'));mount()
 await generate()
 expect(host.querySelector('[role="alert"]').textContent).toContain('Could not export');expect(host.textContent).toContain('+5 cm')
 await generate()
 expect(host.querySelector('[role="alert"]')).toBeNull();expect(host.querySelector('.progress-file')).not.toBeNull()
})
it('keeps the generated file after save failure and lets the user retry',async()=>{
 mount();await generate()
 mock.save.mockRejectedValueOnce(new Error('Disk full'))
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Download').click())
 expect(host.querySelector('[role="alert"]')).not.toBeNull();expect(host.querySelector('.progress-file')).not.toBeNull()
 mock.save.mockRejectedValueOnce(Object.assign(new Error('Canceled'),{name:'AbortError'}))
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Download').click())
 expect(host.querySelector('[role="alert"]')).toBeNull()
})
it('invalidates the old download on period change and releases its object URL',async()=>{
 const revoke=vi.spyOn(URL,'revokeObjectURL');mount()
 await generate()
 act(()=>{const el=host.querySelector('select');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(host.querySelector('.progress-file')).toBeNull();expect(revoke).toHaveBeenCalledOnce()
})
it('prevents duplicate generation while a PDF is being built',async()=>{
 let resolve;mock.build.mockImplementation(()=>new Promise(r=>{resolve=r}));mount()
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 const button=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Generate and download'))
 act(()=>{button.click();button.click()});expect(mock.build).toHaveBeenCalledOnce();expect(host.querySelector('select').disabled).toBe(true)
 await act(async()=>resolve({name:'test.pdf',blob:new Blob(['pdf'])}))
 expect(host.querySelector('select').disabled).toBe(false)
})

it('treats Capacitor share cancellation as dismissal, not an export failure',async()=>{
 mount();await generate()
 mock.save.mockRejectedValueOnce(new Error('Share canceled'))
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Download').click())
 expect(host.querySelector('[role="alert"]')).toBeNull();expect(host.querySelector('.progress-file')).not.toBeNull()
})
it('discards a generated snapshot when persisted data changes during generation',async()=>{
 let resolve;mock.build.mockImplementation(()=>new Promise(r=>{resolve=r}));mount()
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click())
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Generate and download')).click())
 mock.S={...mock.S,measurements:[]};mount()
 await act(async()=>resolve({name:'outdated.pdf',blob:new Blob(['pdf'])}))
 expect(host.querySelector('.progress-file')).toBeNull()
})

it('shows body-only history without unrelated empty workout sections',()=>{
 mount();expect(host.textContent).toContain('Body Progress');expect(host.textContent).toContain('+5 cm')
 expect(host.querySelector('.body-stats')).not.toBeNull()
 for(const label of ['Exercise Progress','Training volume','Training consistency','Activity Progress','Personal Records'])expect([...host.querySelectorAll('summary')].some(el=>el.textContent===label)).toBe(false)
 expect(host.querySelectorAll('.progress-values time')).toHaveLength(2)
})

it('opens independent report sections instead of rendering every metric at once',()=>{
 act(()=>root.render(<MemoryRouter><ProgressReport/></MemoryRouter>))
 expect(host.querySelectorAll('.progress-controls select')[1].options).toHaveLength(8)
 expect(host.querySelector('.progress-metric')).toBeNull()
 selectSection('Body Progress');expect(host.textContent).toContain('+5 cm')
 selectSection('InBody history');expect(host.textContent).not.toContain('+5 cm');expect(host.textContent).toContain('No comparable history')
})

it('keeps recorded body data visible in the overview when there are no workouts',()=>{
 act(()=>root.render(<MemoryRouter><ProgressReport/></MemoryRouter>))
 expect(host.querySelector('.progress-panel').textContent).toContain('35 cm')
 expect(host.querySelector('.progress-panel').textContent).not.toContain('No comparable history')
})

it('requires export selection and passes only selected sections and body dates to generation',async()=>{
 mount();act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Export Progress Report')).click());expect(mock.build).not.toHaveBeenCalled()
 act(()=>host.querySelector('dialog input').click());expect([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Generate and download')).disabled).toBe(true)
 act(()=>host.querySelectorAll('dialog input')[6].click())
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Generate and download')).click())
 expect(mock.build.mock.calls[0][1].sections).toEqual(['body']);expect(mock.save).toHaveBeenCalledOnce()
})
it('preserves expanded charts when navigating sections',()=>{
 mount();act(()=>host.querySelector('.progress-fold-toggle').click())
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Expand chart').click())
 expect(host.querySelector('.progress-chart').dataset.expanded).toBe('true')
 selectSection('Your progress');selectSection('Body Progress')
 expect(host.querySelector('.progress-chart').dataset.expanded).toBe('true')
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Collapse chart').click())
 expect(host.querySelector('.progress-chart').dataset.expanded).toBe('false')
})
it('compares exact selected records and exports the same date selection',async()=>{
 mock.S.measurements.push({d:'2026-09-24',neck:40});mount()
 act(()=>{const el=host.querySelector('.body-dates select');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(host.querySelector('.body-detail').textContent).toContain('+5 cm')
 await generate();expect(mock.build.mock.calls[0][1].bodySelection).toEqual({before:'1',after:'2'})
})
