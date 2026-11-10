// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach, afterEach, it, expect, vi} from 'vitest'
import {activityHistorySheet, ZoomCalendar, WorkoutRow} from '../sheets.jsx'
import {DEF, useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {_setLangState} from '../lib/i18n-core.js'

let host, root, pickerHost, pickerRoot, original, originalStored
const workout=(id,d)=>({id,d,routineId:'r',name:'Synthetic session',entries:[{id:'0025',sets:[{done:true,w:20,r:8}]}]})
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-03T12:00:00'));_setLangState('en')
  original=useStore.getState().S;originalStored=localStorage.getItem('gym_state_v1')
  useStore.setState({S:{...structuredClone(DEF),lang:'en',scheduleStarted:'2026-09-27',trainingHistory:{trackedFrom:'2026-09-27',historicalWorkouts:0},routines:[{id:'r',name:'Routine',ex:[]}],week:{1:'r'},workouts:[workout('oct','2026-10-01'),workout('nov','2026-11-01'),workout('nov2','2026-11-02'),workout('same-day','2026-11-02')]}})
  host=document.createElement('div');pickerHost=document.createElement('div');document.body.append(host,pickerHost)
  root=createRoot(host);pickerRoot=createRoot(pickerHost);useUI.getState().closeAll()
})
afterEach(()=>{
  act(()=>{root.unmount();pickerRoot.unmount();useUI.getState().closeAll()});host.remove();pickerHost.remove()
  useStore.setState({S:original});if(originalStored===null)localStorage.removeItem('gym_state_v1');else localStorage.setItem('gym_state_v1',originalStored)
  vi.clearAllTimers();vi.useRealTimers()
})
const historyCalendar=()=>{
  act(()=>activityHistorySheet())
  act(()=>root.render(useUI.getState().sheets.at(-1).render(()=>{})))
}
const choose=label=>{
  act(()=>host.querySelector('.zoomcal-period-picker').click())
  const sheet=useUI.getState().sheets.at(-1)
  act(()=>pickerRoot.render(sheet.render(()=>useUI.getState().closeSheet(sheet.id))))
  act(()=>[...pickerHost.querySelectorAll('[role="radio"]')].find(node=>node.textContent===label).click())
  act(()=>pickerRoot.render(null))
}

it('browses History through one period picker and keeps its distinct date total between the arrows without changing the profile',()=>{
  const before=JSON.stringify(useStore.getState().S),stored=localStorage.getItem('gym_state_v1')
  historyCalendar()
  const calendar=host.querySelector('.workout-history-calendar .zoomcal')
  expect(calendar.querySelector('.zoomcal-toolbar')).toBeNull()
  expect(calendar.querySelector('.zoomcal-period-picker small')).toBeNull()
  expect(calendar.querySelector('.zoomcal-period-picker').getAttribute('aria-label')).toContain('2026')
  expect(calendar.querySelector('.zoomcal-period-active').textContent).toBe('1')
  const nav=calendar.querySelector('.zoomcal-nav')
  expect(nav.children[0].getAttribute('aria-label')).toBe('Prev')
  expect(nav.children[1].querySelector('.zoomcal-period-picker')).not.toBeNull()
  expect(nav.children[1].querySelector('.zoomcal-period-active')).not.toBeNull()
  expect(nav.children[2].getAttribute('aria-label')).toBe('Next')
  choose('Month')
  expect(calendar.getAttribute('data-level')).toBe('month')
  expect(calendar.querySelector('.zoomcal-period-picker').getAttribute('aria-label')).toContain('November 2026')
  expect(calendar.querySelector('.zoomcal-period-picker').textContent).toBe('November')
  expect(calendar.querySelector('.zoomcal-period-active').textContent).toBe('2')
  choose('Year')
  expect(calendar.querySelectorAll('.zoomcal-month-card')).toHaveLength(12)
  expect(calendar.querySelector('.zoomcal-period-active').textContent).toBe('3')
  expect(calendar.querySelector('.zoomcal-tracking-start').compareDocumentPosition(nav)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  act(()=>nav.firstElementChild.click())
  expect(calendar.querySelector('.zoomcal-period-picker').textContent).toBe('2025')
  expect(calendar.querySelector('.zoomcal-period-active').textContent).toBe('0')
  expect(calendar.querySelector('.zoomcal-tracking-start')).toBeNull()
  choose('Years')
  expect(calendar.getAttribute('data-level')).toBe('years')
  expect(calendar.querySelectorAll('.zoomcal-periods.years>button')).toHaveLength(12)
  expect(JSON.stringify(useStore.getState().S)).toBe(before)
  expect(localStorage.getItem('gym_state_v1')).toBe(stored)
})

it('retains the existing controls in Today and Nutrition while Streak keeps its current picker',()=>{
  const S=useStore.getState().S
  act(()=>root.render(<ZoomCalendar S={S}/>))
  expect(host.querySelector('.zoomcal-toolbar .seg')).not.toBeNull()
  expect(host.querySelector('.zoomcal-scale')).not.toBeNull()
  expect(host.querySelector('.zoomcal-period-picker')).toBeNull()
  act(()=>root.render(<ZoomCalendar key="nutrition" S={S} datePicker selectedDate="2026-11-03"/>))
  expect(host.querySelector('.zoomcal-toolbar .seg')).not.toBeNull()
  expect(host.querySelector('.compact-navigation')).toBeNull()
  act(()=>root.render(<ZoomCalendar key="streak" S={S} streakView/>))
  expect(host.querySelector('.zoomcal-period-picker')).not.toBeNull()
  expect(host.querySelector('.zoomcal-toolbar,.compact-navigation')).toBeNull()
})

it('opens historical rows as a native keyboard control and labels saved pounds independently of the current profile unit',()=>{
  const w={...workout('lb','2026-11-02'),unit:'lb',vol:800},onClick=vi.fn()
  const before=JSON.stringify(w)
  act(()=>root.render(<WorkoutRow w={w} onClick={onClick}/>))
  const row=host.querySelector('.item')
  expect(row.tagName).toBe('BUTTON')
  expect(row.querySelector('.ss').textContent).toContain('800 lb')
  expect(row.querySelector('.ss').textContent).not.toContain('800 kg')
  act(()=>row.click());expect(onClick).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(w)).toBe(before)
})
