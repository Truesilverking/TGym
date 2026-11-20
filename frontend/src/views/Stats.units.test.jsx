// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import Stats from './Stats.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {bindUI} from '../components/ui.jsx'
import {setLang} from '../lib/i18n.js'
import {LB_PER_KG} from '../lib/weight-units.js'

const spies=vi.hoisted(()=>({measurement:vi.fn()}))
vi.mock('../sheets.jsx',()=>({bwSheet:()=>{},goalSheet:()=>{},measurementsSheet:spies.measurement,heightSheet:()=>{},sessionTimingSheet:()=>{},inBodySheet:()=>{},confirmSheet:()=>{},workoutDetailSheet:()=>{},WorkoutRow:()=>null,bwDeltaColor:()=> 'inherit'}))
vi.mock('../components/LineChart.jsx',()=>({default:({points,unit})=><div data-chart-unit={unit} data-chart-points={JSON.stringify(points)}/>}))
vi.mock('../components/MeasurementBodyMap.jsx',()=>({default:()=>null}))
vi.mock('../components/BodyMap.jsx',()=>({default:()=>null,BodyMapLegend:()=>null}))
let host,root,previous,stored
const fixture=()=>({...structuredClone(DEF),lang:'en',unit:'kg',heightCm:180,measurementUnit:'cm',hasCompletedOnboarding:true,hasCompletedAppTour:true,trainingStartDate:'2026-10-01',statsSections:['exercise','bodyweight','bmi','measurements'],statsSectionOrder:['exercise','bodyweight','bmi','measurements'],routines:[{id:'routine',name:'Saved routine',ex:[]}],workouts:[{id:'pound-history',d:'2026-11-02',name:'Saved routine',routineId:'routine',unit:'lb',vol:800,start:+new Date('2026-11-02T10:00:00'),end:+new Date('2026-11-02T11:00:00'),entries:[{id:'0025',target:{mode:'reps'},sets:[{w:80,r:10,done:true}]}]}],bodyweight:[{d:'2026-11-02',t:+new Date('2026-11-02T10:00:00'),w:154.12345678,unit:'lb',samples:[{w:154.12345678}]}],measurements:[{id:'raw-measurement',d:'2026-11-02',unit:'in',waist:34}],inbody:[{d:'2026-11-02',weight:70}]})
beforeEach(async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-03T12:00:00'));await setLang('en');bindUI(useUI)
  previous=useStore.getState().S;stored=localStorage.getItem('gym_state_v1')
  const S=fixture();useStore.setState({S,user:null,ready:true});localStorage.setItem('gym_state_v1',JSON.stringify(S));useUI.setState({sheets:[]})
  host=document.createElement('div');document.body.append(host);root=createRoot(host);spies.measurement.mockClear()
})
afterEach(()=>{act(()=>root.unmount());host.remove();useStore.setState({S:previous});if(stored==null)localStorage.removeItem('gym_state_v1');else localStorage.setItem('gym_state_v1',stored);vi.clearAllTimers();vi.useRealTimers()})
const mount=async section=>act(async()=>root.render(<MemoryRouter initialEntries={['/stats?section='+section]}><Stats/></MemoryRouter>))
const card=section=>host.querySelector('[data-stats-section="'+section+'"]')
it('labels and charts the historical lb exercise as kg without rewriting the profile',async()=>{
  const before=structuredClone(useStore.getState().S),bytes=localStorage.getItem('gym_state_v1');await mount('exercise')
  expect(card('exercise').querySelector('b.accent').textContent).toBe('36 kg')
  const top=card('exercise').querySelector('[data-chart-unit="kg"]')
  expect(JSON.parse(top.dataset.chartPoints)[0].y).toBeCloseTo(80/LB_PER_KG,12)
  await act(()=>[...card('exercise').querySelectorAll('button')].find(button=>button.textContent==='Est. 1RM').click())
  expect(card('exercise').querySelector('b.accent').textContent).toBe('48 kg')
  expect(JSON.parse(card('exercise').querySelector('[data-chart-unit="kg"]').dataset.chartPoints)[0].y).toBe(48.4)
  expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(bytes)
})
it.each(['bodyweight','bmi'])('projects stamped bodyweight for the %s card while retaining exact source samples',async section=>{
  const before=structuredClone(useStore.getState().S),bytes=localStorage.getItem('gym_state_v1');await mount(section)
  if(section==='bodyweight'){
    const chart=card(section).querySelector('[data-chart-unit="kg"]')
    expect(JSON.parse(chart.dataset.chartPoints)[0].y).toBeCloseTo(154.12345678/LB_PER_KG,12)
  }else{
    expect(card(section).querySelector('.big').textContent).toBe('21.6')
    expect(card(section).textContent).toContain('Calculated from 70 kg and 180 cm.')
  }
  expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(bytes)
})
it('keeps measurement editing bound to the original record rather than a projected mass snapshot',async()=>{
  const source=useStore.getState().S,measurement=source.measurements[0];await mount('measurements')
  await act(()=>card('measurements').querySelector('button[aria-label="Edit"]').click())
  expect(spies.measurement).toHaveBeenCalledWith(measurement)
  expect(spies.measurement.mock.calls[0][0]).toBe(measurement);expect(useStore.getState().S).toBe(source)
})
