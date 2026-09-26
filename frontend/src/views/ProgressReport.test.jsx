// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import ProgressReport from './ProgressReport.jsx'
const mock=vi.hoisted(()=>({S:{}}))
vi.mock('../store/useStore.js',()=>({useStore:selector=>selector({S:mock.S})}))
vi.mock('../sheets.jsx',()=>({bwSheet:()=>{},measurementsSheet:()=>{},inBodySheet:()=>{},heightSheet:()=>{}}))
vi.mock('../components/LineChart.jsx',()=>({default:()=> <span>Chart</span>}))
vi.mock('../lib/i18n.js',()=>({t:(s,...args)=>s.replace(/\{(\d+)\}/g,(_,i)=>args[i]??''),exerciseNameFor:e=>e.n||e.id}))
let host,root
globalThis.IS_REACT_ACT_ENVIRONMENT=true
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-26T12:00:00'));mock.S={trainingStartDate:'2026-07-01',workouts:[],measurements:[{d:'2026-07-01',neck:30},{d:'2026-09-20',neck:35}]};host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.useRealTimers()})
const mount=()=>act(()=>root.render(<MemoryRouter><ProgressReport/></MemoryRouter>))
it('changes periods, renders sufficient/insufficient data and exports the selected range',async()=>{
 mount();expect(host.textContent).toContain('+5 cm');expect(host.textContent).toContain('+16.7%')
 act(()=>{const el=host.querySelector('select');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(host.textContent).toContain('More data needed');expect(host.textContent).not.toContain('+16.7%')
 const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:report'),click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Export Progress Report').click())
 expect(create).toHaveBeenCalledOnce();expect(click.mock.instances[0].download).toBe('TGym-progress-2026-08-26-2026-09-26.html')
})
it('shows an empty state without invented metrics for a new user',()=>{
 mock.S={workouts:[],measurements:[]};mount();expect(host.textContent).toContain('No comparable history in this period.');expect(host.querySelector('.progress-summary')).toBeNull()
})
