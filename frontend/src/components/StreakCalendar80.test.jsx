// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ZoomCalendar, streakDetailSheet } from '../sheets.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { _setLangState } from '../lib/i18n-core.js'
import { calendarVisualStyle, TRACKING_START_MARKER } from '../lib/calendar-visual.js'

let host, root, sheetHost, sheetRoot, original
const fixture=()=>({...structuredClone(DEF),lang:'en',hasCompletedOnboarding:true,hasCompletedAppTour:true,
  scheduleStarted:'2026-09-14',trainingHistory:{trackedFrom:'2026-09-14',historicalWorkouts:0},
  routines:[{id:'routine',name:'Existing routine',ex:[]}],week:{1:'routine',3:'routine'},
  workouts:[{id:'session',d:'2026-09-14',name:'Recorded routine',entries:[{id:'exercise',sets:[{done:true,r:8}]}]}]})
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16T12:00:00'));_setLangState('en')
  original=useStore.getState().S;useUI.getState().closeAll()
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  sheetHost=document.createElement('div');document.body.append(sheetHost);sheetRoot=createRoot(sheetHost)
})
afterEach(()=>{
  act(()=>{root.unmount();sheetRoot.unmount();useUI.getState().closeAll()})
  host.remove();sheetHost.remove();useStore.setState({S:original,user:null});vi.clearAllTimers();vi.useRealTimers()
})
const renderCalendar=(S,level='week')=>act(()=>root.render(<ZoomCalendar S={S} streakView levels={['week','month','months']} initialLevel={level}/>))
function chooseView(label){
  act(()=>host.querySelector('.zoomcal-period-picker').click())
  const sheet=useUI.getState().sheets.at(-1)
  act(()=>sheetRoot.render(sheet.render(()=>useUI.getState().closeSheet(sheet.id))))
  const choices=[...sheetHost.querySelectorAll('[role=radio]')]
  expect(choices.map(button=>button.textContent)).toEqual(['Week','Month','Year'])
  const current={week:'Week',month:'Month',months:'Year'}[host.querySelector('.zoomcal').dataset.level]
  expect(choices.find(button=>button.textContent===current).getAttribute('aria-checked')).toBe('true')
  act(()=>choices.find(button=>button.textContent===label).click())
  expect(useUI.getState().sheets.some(row=>row.id===sheet.id)).toBe(false)
}

it('opens a checked view chooser from each period header and keeps its anchor and numeric activity count',()=>{
  const S=fixture(),before=JSON.stringify(S);renderCalendar(S)
  expect(host.querySelector('.seg,.zoomcal-scale,.zoomcal-toolbar')).toBeNull()
  for(const [label,level,start,end,cells] of [['Week','week','2026-09-14','2026-09-20',7],['Month','month','2026-09-01','2026-09-30',30],['Year','months','2026-01-01','2026-12-31',365],['Week','week','2026-09-14','2026-09-20',7]]){
    chooseView(label)
    expect(host.querySelector('.zoomcal').dataset.level).toBe(level)
    const count=host.querySelector('.zoomcal-period-active')
    expect(count.dataset.periodStart).toBe(start);expect(count.dataset.periodEnd).toBe(end)
    expect(count.textContent).toBe('1');expect(count.querySelector('strong').getAttribute('aria-label')).toBe('Active days: 1')
    expect(host.querySelectorAll('.calendar-date')).toHaveLength(cells)
    expect(host.textContent).not.toContain('Active days');expect(host.textContent).not.toContain('One square per day')
    expect(host.textContent).not.toContain('Tracking since');expect(host.querySelector('.zoomcal-time-key')).toBeNull()
  }
  expect(JSON.stringify(S)).toBe(before)
})

it.each(['week','month','months'])('overlays the tracking marker on the exact completed date without changing its state in %s',level=>{
  const S=fixture();renderCalendar(S,level)
  const markers=host.querySelectorAll('.calendar-tracking-marker')
  expect(markers).toHaveLength(1)
  const cell=markers[0].closest('.calendar-date')
  expect(cell.dataset.date).toBe('2026-09-14');expect(cell.dataset.status).toBe('completed')
  expect(cell.style.getPropertyValue('--calendar-fill')).toBe(calendarVisualStyle('completed')['--calendar-fill'])
  expect(cell.getAttribute('aria-label')).toContain('Tracking start')
  expect(markers[0].style.getPropertyValue('--tracking-fill')).toBe(TRACKING_START_MARKER.fill)
  expect(markers[0].getAttribute('aria-hidden')).toBe('true')
  expect(host.querySelectorAll('[data-legend=tracking-start]')).toHaveLength(1)
  act(()=>host.querySelector('.zoomcal-nav>button[aria-label=Next]').click())
  expect(host.querySelector('.calendar-tracking-marker,[data-legend=tracking-start]')).toBeNull()
  act(()=>host.querySelector('.zoomcal-nav>button[aria-label=Prev]').click())
  expect(host.querySelectorAll('.calendar-tracking-marker')).toHaveLength(1)
})

it.each(['rest','partial'])('preserves the actual %s color on tracking start instead of reclassifying it',status=>{
  const S=fixture()
  if(status==='rest'){S.workouts=[];S.week={}}
  else{S.routines.push({id:'second',name:'Second routine',ex:[]});S.week[1]=['routine','second'];S.workouts[0].routineId='routine'}
  renderCalendar(S)
  const cell=host.querySelector('[data-date="2026-09-14"]')
  expect(cell.dataset.status).toBe(status);expect(cell.querySelector('.calendar-tracking-marker')).not.toBeNull()
  expect(cell.style.getPropertyValue('--calendar-fill')).toBe(calendarVisualStyle(status)['--calendar-fill'])
})

it('shows all twelve months and a leap day with number-only per-month counts',()=>{
  const S=fixture();S.trainingHistory.trackedFrom='2024-02-29';S.scheduleStarted='2024-02-29';S.workouts[0].d='2024-02-29'
  act(()=>root.render(<ZoomCalendar S={S} streakView initialLevel="months" initialAnchor={new Date('2024-06-01T12:00:00')}/>))
  expect(host.querySelectorAll('.zoomcal-month-card')).toHaveLength(12)
  expect(host.querySelectorAll('.calendar-date')).toHaveLength(366)
  expect(host.querySelector('.zoomcal-month-card>small')).toBeNull()
  expect(host.querySelector('[data-month="2024-02"] em').textContent).toBe('1')
  expect(host.querySelector('.calendar-tracking-marker').closest('.calendar-date').dataset.date).toBe('2024-02-29')
})

it('uses only local profile name/photo and persists the optional visibility without touching training data',()=>{
  const S=fixture();S.profile={name:'Local Display',photo:'data:image/png;base64,cGhvdG8='};S.heightCm=180;S.targetW=80
  useStore.setState({S,user:{name:'Cloud name',email:'private@example.test'}})
  act(()=>streakDetailSheet());act(()=>root.render(useUI.getState().sheets[0].render(()=>{})))
  expect(host.querySelector('.streak-profile')).toBeNull()
  act(()=>host.querySelector('[aria-label="Show profile"]').click())
  expect(host.querySelector('[aria-label="Hide profile"]')).toBeNull()
  expect(useStore.getState().S.streakCalendarShowProfile).toBe(true)
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).streakCalendarShowProfile).toBe(true)
  expect(host.querySelector('.streak-profile').textContent).toBe('Local Display')
  expect(host.querySelector('.streak-profile img').getAttribute('src')).toBe(S.profile.photo)
  expect(host.querySelector('.streak-profile').textContent).not.toMatch(/Cloud|private|180|80/)
  expect(useStore.getState().S.workouts).toEqual(S.workouts);expect(useStore.getState().S.routines).toEqual(S.routines)
  act(()=>root.render(null));act(()=>root.render(useUI.getState().sheets[0].render(()=>{})))
  expect(host.querySelector('.streak-profile')).not.toBeNull()
  act(()=>useStore.getState().update(state=>{delete state.profile.photo}))
  expect(host.querySelector('.streak-profile-avatar').textContent).toBe('LD')
  act(()=>host.querySelector('.streak-profile').click())
  act(()=>host.querySelector('[aria-label="Hide profile"]').click())
  expect(host.querySelector('.streak-profile')).toBeNull()
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).streakCalendarShowProfile).toBe(false)
})

it('reveals profile visibility without opening an editor and uses a neutral icon when the local profile is empty',()=>{
  const S=fixture();S.streakCalendarShowProfile=true
  useStore.setState({S,user:{name:'Cloud name'}})
  act(()=>streakDetailSheet());act(()=>root.render(useUI.getState().sheets[0].render(()=>{})))
  const profile=host.querySelector('.streak-profile')
  expect(profile.textContent).toBe('');expect(profile.querySelector('svg')).not.toBeNull()
  expect(host.querySelector('[aria-label="Hide profile"]')).toBeNull()
  act(()=>profile.click())
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(host.querySelector('[aria-label="Hide profile"]')).not.toBeNull()
  expect(host.querySelector('.streak-profile').getAttribute('aria-expanded')).toBe('true')
})
