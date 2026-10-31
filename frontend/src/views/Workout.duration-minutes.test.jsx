// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import RestTimer from '../components/RestTimer.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { registerCustom } from '../lib/exercises.js'
import { doFinishWorkout } from '../sheets.jsx'
import { _setLangState } from '../lib/i18n-core.js'
import es from '../locales/es.js'

vi.mock('../lib/sound.js',()=>({playAppSound:vi.fn(),vibrate:vi.fn()}))
vi.mock('../lib/api.js',()=>({api:vi.fn(async()=>({}))}))
vi.mock('../components/Media.jsx',()=>({default:()=>null}))

let root, host
const state=()=>useStore.getState().S
const row=()=>state().active.entries[0].sets[0]
const duration=label=>host.querySelector(`input[aria-label="${label}"]`)
const type=(input,value)=>act(()=>{
  input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value)
  input.dispatchEvent(new Event('input',{bubbles:true}))
})
const render=()=>act(()=>root.render(<MemoryRouter><Workout/><RestTimer/></MemoryRouter>))
function mount({id='3666',target={},exercise,customEx=[],sets=[{sec:1200,w:0,done:false}]}={}) {
  const S={...structuredClone(DEF),lang:'en',restSec:0,customEx,workouts:[]}
  S.active={id:'minute-display',d:'2026-10-22',start:Date.now(),name:'Duration display test',cur:0,
    entries:[{id,exercise,target:{mode:'time',bodyweight:true,prog:'off',sec:1200,...target},sets}]}
  registerCustom(customEx); useStore.setState({S,user:null}); render()
}
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-22T12:00:00-04:00'));_setLangState('en')
  useUI.getState().closeAll();useUI.getState().stopRest();useUI.getState().stopWork();localStorage.clear()
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host)
})
afterEach(()=>{
  act(()=>{useUI.getState().stopWork();useUI.getState().stopRest();useUI.getState().closeAll();root.unmount()})
  host.remove();registerCustom([]);_setLangState('en');vi.clearAllTimers();vi.useRealTimers()
})

it.each([
  {id:'3666'},
  {id:'local-treadmill',customEx:[{id:'local-treadmill',n:'Local treadmill',bp:'cardio',custom:true}]},
  {id:'legacy-treadmill',exercise:{id:'legacy-treadmill',n:'Legacy treadmill',bp:'cardio'}},
  {id:'legacy-walk',target:{activityType:'walking'}},
])('shows stored 1200 seconds as 20 minutes for timed cardio metadata %j without writing data', options=>{
  mount(options);const before=JSON.stringify(state()),stored=localStorage.getItem('gym_state_v1')
  expect(duration('Minutes')?.value).toBe('20');expect(duration('Seconds')).toBeNull()
  expect(row()).toMatchObject({sec:1200,w:0,done:false})
  expect(state().active.entries[0].target.mode).toBe('time')
  expect(JSON.stringify(state())).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBe(stored)
})

it('edits decimal minutes, steps by one minute, validates positive time and restores without converting storage',()=>{
  mount();type(duration('Minutes'),'21,5');expect(row().sec).toBe(1290);expect(row().manualFields.sec).toBe(true)
  const stepper=()=>duration('Minutes').closest('.stp')
  act(()=>stepper().querySelector('[aria-label="Increase"]').click());expect(row().sec).toBe(1350);expect(duration('Minutes').value).toBe('22.5')
  act(()=>stepper().querySelector('[aria-label="Decrease"]').click());expect(row().sec).toBe(1290)
  type(duration('Minutes'),'0');expect(row().sec).toBe(1290);expect(duration('Minutes').getAttribute('aria-invalid')).toBe('true')
  type(duration('Minutes'),'0,5');expect(row().sec).toBe(30)
  const saved=JSON.parse(localStorage.getItem('gym_state_v1'));expect(saved.active.entries[0].sets[0].sec).toBe(30)
  act(()=>{root.unmount();root=createRoot(host);useStore.getState().replaceState(saved)});render()
  expect(duration('Minutes').value).toBe('0.5');expect(row().sec).toBe(30)
  expect(state().active.entries[0].target.sec).toBe(1200)
})

it('starts a 1200-second countdown, records actual seconds and preserves them through summary, undo and history',()=>{
  mount();act(()=>host.querySelector('[aria-label="Start set"]').click())
  expect(useUI.getState().work.total).toBe(1200);expect(host.querySelector('#timer .t').textContent).toBe('20:00')
  act(()=>vi.advanceTimersByTime(90000));expect(host.querySelector('#timer .t').textContent).toBe('18:30')
  act(()=>useUI.getState().finishWorkEarly());expect(row()).toMatchObject({sec:90,done:true})
  expect(host.querySelector('.set-summary-values').textContent).toContain('Minutes1.5')
  act(()=>host.querySelector('.set-undo').click());expect(duration('Minutes').value).toBe('1.5');expect(row().sec).toBe(90)
  act(()=>host.querySelector('[role="checkbox"]').click());act(()=>doFinishWorkout())
  expect(state().workouts[0].entries[0]).toMatchObject({target:{mode:'time',sec:1200},sets:[{sec:90,done:true}]})
  expect(state().workouts[0].entries[0].sets[0].min).toBeUndefined()
})

it('keeps held durations in seconds and regular cardio duration in minutes',()=>{
  mount({id:'0025',sets:[{sec:45,w:0,done:false}],target:{sec:45}})
  expect(duration('Seconds').value).toBe('45');expect(duration('Minutes')).toBeNull()
  act(()=>host.querySelector('[aria-label="Start set"]').click());expect(useUI.getState().work.total).toBe(45)
  act(()=>useUI.getState().stopWork())
  act(()=>{root.unmount();root=createRoot(host)})
  mount({target:{mode:'cardio',min:20},sets:[{min:20,speed:8,done:false}]})
  expect(duration('Duration (min)').value).toBe('20');expect(row().sec).toBeUndefined()
  act(()=>host.querySelector('[aria-label="Start cardio timer"]').click());expect(useUI.getState().work.total).toBe(1200)
})

it('uses the existing Spanish Minutes label and decimal comma without changing second storage',()=>{
  _setLangState('es',es);mount();expect(duration('Minutos').value).toBe('20')
  type(duration('Minutos'),'20,5');expect(row().sec).toBe(1230)
})

it('preserves legacy blank effort fields while adapting only cardio second durations',()=>{
  mount({id:'0025',target:{mode:'reps',bodyweight:false,reps:8,targetRir:2},sets:[{w:10,r:8,rir:'',done:false}]})
  expect(duration('RIR').value).toBe('');expect(row().rir).toBe('')
  expect(duration('Weight (kg)').value).toBe('10')
})
