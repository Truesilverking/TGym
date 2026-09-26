// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {measurementsSheet} from '../sheets.jsx'
import {buildProgressReport} from '../lib/progress-report.js'
vi.mock('./MetricFields.jsx',()=>({default:({onChange})=><button onClick={()=>onChange({neck:'35'})}>Enter reading</button>}))
globalThis.IS_REACT_ACT_ENVIRONMENT=true
let host,root
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-26T12:00:00'));const S=structuredClone(DEF);S.lang='en';S.measurements=[{id:'first',d:'2026-09-26',t:Date.now()-3600000,neck:30}];useStore.setState({S,user:null});useUI.setState({sheets:[]});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers()})
function Sheets(){return useUI(s=>s.sheets).map(s=><div key={s.id}>{s.render(()=>useUI.getState().closeSheet(s.id))}</div>)}
it('adds a second same-day measurement with its own timestamp and preserves the baseline',async()=>{
 act(()=>{root.render(<Sheets/>);measurementsSheet()})
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Enter reading').click())
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Save').click())
 const S=useStore.getState().S;expect(S.measurements).toHaveLength(2);expect(S.measurements[0].neck).toBe(30);expect(S.measurements[1].t).toBe(Date.now())
 expect(S.measurements[1].id).not.toBe('first');expect(buildProgressReport(S).body.find(m=>m.key==='neck').delta).toBe(5)
})
