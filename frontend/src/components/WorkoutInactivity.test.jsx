// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { workoutInactivitySheet } from '../sheets.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { _setLangState } from '../lib/i18n-core.js'
import { workoutElapsedMs } from '../lib/workout-time.js'
import Modals from './Modals.jsx'

let host, root, original
const minute=60000
const clock=+new Date('2026-09-16T12:00:00')
const active=()=>({id:'paused',name:'Original session',d:'2026-09-16',start:clock-100*minute,
  timerPausedAt:clock-70*minute,lastUserInteractionAt:clock-100*minute,pauseReason:'inactivity',
  entries:[{id:'0025',target:{mode:'reps'},sets:[{done:true,r:8,w:20},{done:false,r:8,w:20}]}]})
const click=text=>{
  const button=[...host.querySelectorAll('button')].filter(node=>node.textContent.trim()===text).at(-1)
  expect(button,`Missing button ${text}`).toBeTruthy();act(()=>button.click())
}
const enter=value=>act(()=>{
  const field=host.querySelector('.inactivity-editor input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value)
  field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}))
})
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  vi.useFakeTimers();vi.setSystemTime(clock);_setLangState('en');localStorage.clear()
  original=useStore.getState().S
  useStore.setState({S:{...structuredClone(DEF),lang:'en',sound:false,hasCompletedOnboarding:true,hasCompletedAppTour:true,
    active:active(),workouts:[{id:'history',d:'2026-09-15',entries:[]}],routines:[{id:'r',name:'Keep',ex:[]}]},user:null})
  useUI.getState().closeAll()
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  act(()=>root.render(<Modals/>));act(()=>workoutInactivitySheet())
})
afterEach(()=>{
  act(()=>{root.unmount();useUI.getState().closeAll();useUI.getState().stopRest();useUI.getState().stopWork()})
  host.remove();useStore.setState({S:original});vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks()
})

it('keeps the reviewed clock locked until explicit editing and never saves draft changes or cancel',()=>{
  const before=JSON.stringify(useStore.getState().S)
  expect(host.querySelector('.inactivity-clock strong').textContent).toBe('30 min')
  expect(host.querySelector('.inactivity-editor')).toBeNull()
  expect(useUI.getState().sheets[0].locked).toBe(true)
  click('Update time');expect(host.querySelector('.inactivity-editor input').value).toBe('30')
  enter('40');host.querySelector('input').dispatchEvent(new Event('blur',{bubbles:true}))
  expect(JSON.stringify(useStore.getState().S)).toBe(before)
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
  click('Cancel');expect(host.querySelector('.inactivity-editor')).toBeNull()
  click('Update time');expect(host.querySelector('input').value).toBe('30')
  expect(JSON.stringify(useStore.getState().S)).toBe(before)
})

it.each(['','0','-2','101','bad','1..5'])('rejects invalid or future duration %j without confirmation or data writes',value=>{
  const before=JSON.stringify(useStore.getState().S)
  click('Update time');enter(value);click('Save duration')
  expect(host.querySelector('[role=alert]').textContent).toContain('Enter a valid duration')
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(JSON.stringify(useStore.getState().S)).toBe(before)
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('requires confirmation, accepts decimal minutes and preserves rows/history/clock audit through repeated save',()=>{
  const before=structuredClone(useStore.getState().S)
  click('Update time');enter('40,5');click('Save duration')
  expect(useUI.getState().sheets).toHaveLength(2)
  expect(host.textContent).toContain('The recorded duration will change to 40.5 minutes')
  expect(useStore.getState().S.active).toEqual(before.active)
  click('Cancel');expect(useStore.getState().S.active).toEqual(before.active)
  click('Save duration');click('Save changes')
  const changed=useStore.getState().S
  expect(workoutElapsedMs(changed.active)).toBe(40.5*minute)
  expect(changed.active).toMatchObject({pauseReason:'inactivity',originalTimerPausedAt:before.active.timerPausedAt,originalDurationMs:30*minute,durationCorrectedAt:clock})
  expect(changed.active.entries).toEqual(before.active.entries)
  expect(changed.workouts).toEqual(before.workouts);expect(changed.routines).toEqual(before.routines)
  expect(host.querySelector('.inactivity-editor')).toBeNull()
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.accumulatedActiveDuration).toBe(40.5*minute)
  click('Update time');enter('35');click('Save duration');click('Save changes')
  expect(workoutElapsedMs(useStore.getState().S.active)).toBe(35*minute)
  expect(useStore.getState().S.active.originalDurationMs).toBe(30*minute)
  expect(useStore.getState().S.workouts).toEqual(before.workouts)
})

it('does not apply a stale confirmation to a replacement active session',()=>{
  click('Update time');enter('40');click('Save duration')
  act(()=>useStore.setState({S:{...useStore.getState().S,active:{...active(),id:'replacement'}}}))
  click('Save changes')
  expect(useStore.getState().S.active.id).toBe('replacement')
  expect(workoutElapsedMs(useStore.getState().S.active)).toBe(30*minute)
})

it('continues through the shared paused clock without saving an unconfirmed draft or duplicating history',()=>{
  const before=structuredClone(useStore.getState().S)
  click('Update time');enter('40');click('Continue workout')
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(useStore.getState().S.active.timerPausedAt).toBeUndefined()
  expect(useStore.getState().S.active.pausedDurationMs).toBe(70*minute)
  expect(workoutElapsedMs(useStore.getState().S.active)).toBe(30*minute)
  expect(useStore.getState().S.active.entries).toEqual(before.active.entries)
  expect(useStore.getState().S.workouts).toEqual(before.workouts)
})

it('finishes using the existing early-finish confirmation and keeps the edited draft out of the saved record',()=>{
  const rows=structuredClone(useStore.getState().S.active.entries)
  click('Update time');enter('40');click('Finish workout')
  expect(host.textContent).toContain('Finish early?')
  // The second button belongs to the existing confirmation on the top sheet.
  act(()=>[...host.querySelectorAll('button')].filter(node=>node.textContent.trim()==='Finish workout').at(-1).click())
  expect(useStore.getState().S.active).toBeNull()
  const stored=useStore.getState().S.workouts.find(row=>row.id==='paused')
  expect(workoutElapsedMs(stored)).toBe(30*minute)
  expect(stored.entries).toMatchObject(rows)
  expect(stored.entries[0].sets).toEqual(rows[0].sets)
  expect(useStore.getState().S.workouts).toHaveLength(2)
})

it('keeps a failed save editable with the prior session intact',()=>{
  const before=structuredClone(useStore.getState().S.active)
  click('Update time');enter('40');click('Save duration')
  const fail=vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError')})
  click('Save changes');fail.mockRestore()
  expect(useStore.getState().S.active).toEqual(before)
  expect(host.querySelector('.inactivity-editor')).not.toBeNull()
  expect(host.querySelector('[role=alert]').textContent).toContain('Could not save changes')
})
