// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import DailyPlan,{ScheduleEditor} from './DailyPlan.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {beginWorkout,startFlow,doFinishWorkout} from '../sheets.jsx'
import {dailyPlan,nextDailyRoutine} from '../lib/daily-plan.js'
import {workoutElapsedMs,inactivityState} from '../lib/workout-time.js'
vi.mock('../lib/sound.js',()=>({playAppSound:vi.fn(),vibrate:vi.fn()}))
vi.mock('../lib/api.js',()=>({api:vi.fn(async()=>({}))}))
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const date='2026-09-25',state=()=>useStore.getState().S
let root,host
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date(date+'T10:00:00'));localStorage.clear();useUI.setState({sheets:[],timer:null,work:null})
 const S=structuredClone(DEF);Object.assign(S,{lang:'en',scheduleStarted:date,trainingStartDate:date,week:{5:['a','b','c']},dayPlan:{},reminder:{on:true,time:'18:00'},routines:['a','b','c'].map(id=>({id,name:'Routine '+id,ex:[{id:'0025',mode:'reps',sets:1,reps:8,weight:20}]})),workouts:[],active:null});useStore.setState({S,user:null})
 host=document.createElement('div');document.body.appendChild(host);root=createRoot(host)
})
afterEach(()=>{act(()=>root.unmount());host.remove();useUI.getState().stopRest();useUI.getState().stopWork();vi.clearAllTimers();vi.useRealTimers()})
const mount=node=>act(()=>root.render(<MemoryRouter>{node}</MemoryRouter>))
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)
const click=b=>act(()=>b.click())
const reopen=()=>act(()=>useStore.getState().replaceState(JSON.parse(localStorage.getItem('gym_state_v1'))))
function Sheets(){const sheets=useUI(s=>s.sheets);return sheets.map(s=><div key={s.id}>{s.render(()=>useUI.getState().closeSheet(s.id))}</div>)}
it('reorders, removes and adds assignments, preserves times and reloads the saved order',()=>{
 mount(<ScheduleEditor day={5} close={()=>{}}/>);click(host.querySelectorAll('[aria-label="Move down"]')[0]);expect(state().week[5]).toEqual(['b','a','c'])
 click(host.querySelectorAll('[aria-label="Remove routine"]')[1]);expect(state().week[5]).toEqual(['b','c']);click(button('Routine a'));expect(state().week[5]).toEqual(['b','c','a'])
 expect(host.querySelector('input[type="time"]').value).toBe('18:00');reopen();expect([...host.querySelectorAll('.daily-plan-name')].map(n=>n.textContent)).toEqual(['Routine bEdit','Routine cEdit','Routine aEdit'])
})
it('persists an empty date override and can return to the weekly schedule',()=>{
 mount(<ScheduleEditor iso={date} close={()=>{}}/>);for(let n=0;n<3;n++)click(host.querySelector('[aria-label="Remove routine"]'))
 reopen();expect(dailyPlan(state(),date).total).toBe(0);expect(host.textContent).toContain('Rest day');click(button('Back to weekly plan'));expect(dailyPlan(state(),date).total).toBe(3)
})
it('skip/undo changes pending selection without creating history and hides starts during an active session',()=>{
 mount(<DailyPlan date={date} onStart={vi.fn()}/>);click(host.querySelector('[aria-label="Skip today"]'));reopen();expect(nextDailyRoutine(state(),date).id).toBe('b');expect(state().workouts).toHaveLength(0);click(button('Undo'));expect(nextDailyRoutine(state(),date).id).toBe('a')
 act(()=>beginWorkout('a'));expect(button('Start')).toBeUndefined()
})
it('runs three sessions through Later, reopen and Continue with independent clocks, IDs and history',()=>{
 mount(<Sheets/>);act(()=>startFlow());click(button('Start without weighing in'));expect(state().active.routineId).toBe('a');const first=state().active.id
 act(()=>beginWorkout('b'));expect(state().active.id).toBe(first)
 vi.setSystemTime(new Date(date+'T10:02:00'));act(()=>useStore.getState().update(s=>{s.active.entries[0].sets.forEach(row=>row.done=true)}));act(()=>doFinishWorkout());expect(host.textContent).toContain('Routine b');click(button('Later'));expect(state().active).toBeNull();reopen();expect(nextDailyRoutine(state(),date).id).toBe('b')
 vi.setSystemTime(new Date(date+'T11:00:00'));act(()=>startFlow());click(button('Start without weighing in'));expect(state().active.routineId).toBe('b');expect(state().active.id).not.toBe(first);expect(workoutElapsedMs(state().active)).toBe(0)
 vi.setSystemTime(new Date(date+'T11:03:00'));act(()=>useStore.getState().update(s=>{s.active.entries[0].sets.forEach(row=>row.done=true)}));act(()=>doFinishWorkout());expect(dailyPlan(state(),date).completed).toBe(2);click(button('Continue'));click(button('Start without weighing in'));expect(state().active.routineId).toBe('c');expect(workoutElapsedMs(state().active)).toBe(0)
 vi.setSystemTime(new Date(date+'T11:04:00'));act(()=>useStore.getState().update(s=>{s.active.entries[0].sets.forEach(row=>row.done=true)}));act(()=>doFinishWorkout());reopen();expect(dailyPlan(state(),date)).toMatchObject({completed:3,total:3});expect(new Set(state().workouts.map(w=>w.id)).size).toBe(3);expect(state().workouts.map(w=>workoutElapsedMs(w))).toEqual([120000,180000,60000]);expect(button('Continue')).toBeUndefined()
})

it('keeps incomplete sessions open and resolves stale history before starting the next workout',()=>{
 act(()=>beginWorkout('a'));vi.setSystemTime(new Date(date+'T10:05:00'));act(()=>useStore.getState().update(s=>{s.active.entries[0].sets.forEach(row=>row.done=true)}));act(()=>doFinishWorkout());vi.setSystemTime(new Date(date+'T11:00:00'));act(()=>beginWorkout('b'))
 const second=state().active;expect(inactivityState(second,Date.now()+30*60000)).toBe('none')
 vi.setSystemTime(new Date(date+'T11:05:00'));act(()=>useStore.getState().update(s=>{s.active.entries[0].sets[0].r=9}))
 vi.setSystemTime(new Date(date+'T16:00:00'));act(()=>beginWorkout('c'));const third=state().active.id
 act(()=>beginWorkout('c'));reopen();expect(state().active.id).toBe(third);expect(state().workouts).toHaveLength(2)
 expect(state().workouts[1]).toMatchObject({routineId:'b',finishReason:'abandoned'});expect(workoutElapsedMs(state().workouts[1])).toBe(300000);expect(state().active.routineId).toBe('c')
})
