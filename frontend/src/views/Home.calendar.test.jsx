// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {it,expect,beforeEach,afterEach,vi} from 'vitest'
import Home from './Home.jsx'
import {ZoomCalendar,dayOverrideSheet} from '../sheets.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
vi.mock('../sheets.jsx',async original=>({...await original(),dayOverrideSheet:vi.fn()}))
let root,host,S
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-28T12:00:00'));localStorage.clear();S={...structuredClone(DEF),lang:'en',trainingStartDate:'2026-07-15',routines:[{id:'upper',name:'Upper A',ex:[]},{id:'lower',name:'Lower A',ex:[]}],week:{1:['upper'],2:['lower']}};useStore.setState({S,user:null});useUI.setState({sheets:[]});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();vi.clearAllMocks()})
const mount=()=>act(()=>root.render(<MemoryRouter><Home/></MemoryRouter>))
it('reflects today activity and the daily streak without marking added exercises as extras',()=>{
 S.trainingStartDate='2026-09-28';S.workouts=[{id:'planned',d:'2026-09-28',routineId:'upper',sessionOrigin:{type:'planned',routineId:'upper'},entries:['replaced','added1','added2','added3'].map(id=>({id,sets:[{done:true,r:8,w:50}]}))}];useStore.setState({S});mount()
 const metric=label=>[...host.querySelectorAll('dt')].find(el=>el.textContent===label)?.nextElementSibling.textContent
 expect(metric('Planned')).toBe('1');expect(metric('Extra')).toBe('0');expect(metric('Active days')).toBe('1');expect(metric('Completion')).toBe('100%');expect(host.querySelector('.header-streak b').textContent).toBe('1')
 act(()=>useStore.getState().update(s=>s.workouts.push({...s.workouts[0],id:'extra',routineId:null,sessionOrigin:{type:'extra',routineId:null}})))
 expect(metric('Extra')).toBe('1');expect(metric('Active days')).toBe('1');expect(host.querySelector('.header-streak b').textContent).toBe('1')
})
it('advances today to tomorrow on matching completion, and opens its date without starting early',()=>{
 mount();expect(host.querySelector('.today-row').textContent).toContain('Today');expect(host.querySelector('.today-row').textContent).toContain('Upper A');act(()=>useStore.getState().update(s=>s.workouts.push({id:'done',routineId:'upper',d:'2026-09-28',entries:[{id:'exercise',sets:[{done:true,r:8}]}]})));const row=host.querySelector('.today-row');expect(row.textContent).toContain('Tomorrow');expect(row.textContent).toContain('Lower A');act(()=>row.click());expect(dayOverrideSheet).toHaveBeenCalledWith('2026-09-29');expect(useStore.getState().S.active).toBeNull()
})
it('skips rest overrides and handles no upcoming workouts',()=>{
 S.workouts=[{id:'done',routineId:'upper',d:'2026-09-28',entries:[{id:'exercise',sets:[{done:true,r:8}]}]}];S.dayPlan={'2026-09-29':[],'2026-10-01':['lower']};useStore.setState({S});mount();expect(host.querySelector('.today-row').textContent).toContain('Lower A');expect(host.querySelector('.today-row').textContent).not.toContain('Tomorrow');act(()=>useStore.getState().update(s=>{s.week={};s.dayPlan={}}));expect(host.querySelector('.today-row').textContent).toContain('No upcoming workout')
})
it('does not count an active or canceled session as today completed',()=>{
 S.workouts=[{id:'cancel',cancelled:true,d:'2026-09-28',routineId:'upper',entries:[{id:'exercise',sets:[{done:true,r:8}]}]}];useStore.setState({S});mount();expect(host.querySelector('.today-row').textContent).toContain('Upper A');act(()=>useStore.getState().update(s=>{s.active={id:'live',name:'Upper A',routineId:'upper',start:Date.now(),d:'2026-09-28',entries:[{id:'exercise',sets:[{done:true,r:8}]}]}}));expect(host.querySelector('.today-row').textContent).toContain('in progress');expect(host.querySelector('.today-row').textContent).toContain('Today')
})
it.each([2026,2024])('renders every day and all twelve months of %i before and after tracking starts',year=>{
 S.trainingStartDate=year+'-07-15';act(()=>root.render(<MemoryRouter><ZoomCalendar S={S} initialLevel="months" initialAnchor={new Date(year,6,15)}/></MemoryRouter>));const months=host.querySelectorAll('.zoomcal-mini-month');expect(months).toHaveLength(12);expect(host.querySelectorAll('.zoomcal-mini-month i:not(.placeholder)')).toHaveLength(year===2024?366:365);expect(months[0].querySelectorAll('.untracked')).toHaveLength(31);expect(months[6].querySelectorAll('.untracked')).toHaveLength(14);expect(months[11].querySelectorAll('i:not(.placeholder)')).toHaveLength(31)
})
