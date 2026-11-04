// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {measurementsSheet} from '../sheets.jsx'
vi.mock('./MetricFields.jsx',()=>({default:({values,onChange})=><button data-values={JSON.stringify(values)} onClick={()=>onChange({neck:'35'})}>Enter reading</button>}))
globalThis.IS_REACT_ACT_ENVIRONMENT=true
let host,root
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-26T12:00:00'));const S=structuredClone(DEF);S.lang='en';S.measurements=[{id:'first',d:'2026-09-26',t:Date.now()-3600000,neck:30}];useStore.setState({S,user:null});useUI.setState({sheets:[]});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers()})
function Sheets(){return useUI(s=>s.sheets).map(s=><div key={s.id}>{s.render(()=>useUI.getState().closeSheet(s.id))}</div>)}
it('opens the existing date explicitly for editing without accidental duplicates',async()=>{
 act(()=>{root.render(<Sheets/>);measurementsSheet()})
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Enter reading').click())
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Save').click())
 const S=useStore.getState().S;expect(S.measurements).toHaveLength(1);expect(S.measurements[0]).toMatchObject({id:'first',neck:35});expect(S.measurements[0].t).toBe(Date.now()-3600000)
})

it('edits a stamped inch record in centimeters without changing its identity or baseline',async()=>{
 const S=structuredClone(DEF);S.lang='en';S.measurementUnit='cm';S.measurements=[{id:'inch',d:'2026-09-25',t:123,unit:'in',neck:10}];useStore.setState({S,user:null})
 act(()=>{root.render(<Sheets/>);measurementsSheet(S.measurements[0])})
 expect(JSON.parse(host.querySelector('[data-values]').getAttribute('data-values')).neck).toBe(25.4)
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Save').click())
 expect(useStore.getState().S.measurements).toHaveLength(1)
 expect(useStore.getState().S.measurements[0]).toMatchObject({id:'inch',d:'2026-09-25',t:123,unit:'cm',neck:25.4})
})

it('records a selected past date, persists it and preserves the existing date',async()=>{
 act(()=>{root.render(<Sheets/>);measurementsSheet(undefined,undefined,'2026-08-01')});expect(host.querySelector('input[type=date]').value).toBe('2026-08-01');act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Enter reading').click());await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Save').click());expect(useStore.getState().S.measurements.map(r=>[r.d,r.neck])).toEqual([['2026-08-01',35],['2026-09-26',30]]);expect(JSON.parse(localStorage.getItem('gym_state_v1')).measurements).toHaveLength(2)
})
it('preserves other same-day readings when editing one',async()=>{
 const S=useStore.getState().S;S.measurements.push({id:'second',d:'2026-09-26',neck:40});act(()=>{root.render(<Sheets/>);measurementsSheet(S.measurements[0])});act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Enter reading').click());await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Save').click());expect(useStore.getState().S.measurements.map(r=>[r.id,r.neck])).toEqual([['first',35],['second',40]])
})
