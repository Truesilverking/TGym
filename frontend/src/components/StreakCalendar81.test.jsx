// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {ZoomCalendar,streakDetailSheet} from '../sheets.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {_setLangState} from '../lib/i18n-core.js'

let host,root,original
const fixture=()=>({...structuredClone(DEF),lang:'en',scheduleStarted:'2026-10-19',profile:{name:'Synthetic Local',photo:null},routines:[],workouts:[],week:{}})
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-22T12:00:00'));_setLangState('en')
 original=useStore.getState().S;host=document.createElement('div');document.body.append(host);root=createRoot(host);useUI.getState().closeAll()
})
afterEach(()=>{act(()=>{root.unmount();useUI.getState().closeAll()});host.remove();useStore.setState({S:original});vi.clearAllTimers();vi.useRealTimers()})

it.each([['week','19-25','Week'],['month','October','Month'],['months','2026','Year']])('uses a minimal %s title while retaining its full accessible period', (level,visible,accessible)=>{
 const S=fixture(),before=JSON.stringify(S)
 act(()=>root.render(<ZoomCalendar S={S} streakView initialLevel={level}/>))
 const picker=host.querySelector('.zoomcal-period-picker')
 expect(picker.textContent).toBe(visible)
 expect(picker.querySelector('span')).toBeNull()
 expect(picker.getAttribute('aria-label')).toContain(`Calendar view: ${accessible}`)
 expect(picker.getAttribute('aria-label')).toContain('2026')
 if(level==='week'){expect(picker.getAttribute('aria-label')).toContain('19');expect(picker.getAttribute('aria-label')).toContain('25')}
 expect(picker.querySelector('svg')).not.toBeNull()
 expect(JSON.stringify(S)).toBe(before)
})

it('keeps the visible week numbers correct across a month/year boundary without losing accessible dates',()=>{
 const S=fixture()
 act(()=>root.render(<ZoomCalendar S={S} streakView initialAnchor={new Date('2026-12-31T12:00:00')}/>))
 const picker=host.querySelector('.zoomcal-period-picker')
 expect(picker.textContent).toBe('28-3');expect(picker.getAttribute('aria-label')).toContain('2026');expect(picker.getAttribute('aria-label')).toContain('2027')
})

it('removes annual weekday labels while retaining every date and generic calendar weekday labels',()=>{
 const S=fixture()
 act(()=>root.render(<ZoomCalendar S={S} streakView initialLevel="months" initialAnchor={new Date('2024-06-01T12:00:00')}/>))
 expect(host.querySelectorAll('.zoomcal-month-card')).toHaveLength(12)
 expect(host.querySelectorAll('.calendar-date')).toHaveLength(366)
 expect(host.querySelector('.zoomcal-mini-weekday')).toBeNull()
 expect(host.querySelector('[data-date="2024-02-29"]').getAttribute('aria-label')).toContain('2024')
 act(()=>root.render(<ZoomCalendar S={S} initialLevel="months" initialAnchor={new Date('2024-06-01T12:00:00')}/>))
 expect(host.querySelectorAll('.zoomcal-mini-weekday')).toHaveLength(84)
})

it('hides the visibility button immediately after Show, reveals Hide from avatar/name and restores Show after Hide/reopen',()=>{
 const S=fixture();useStore.setState({S})
 act(()=>streakDetailSheet());const render=()=>act(()=>root.render(useUI.getState().sheets[0].render(()=>{})))
 render();const profileBefore=JSON.stringify(S.profile),trainingBefore=JSON.stringify(S.workouts)
 expect(host.querySelector('[aria-label="Show profile"]')).not.toBeNull()
 act(()=>host.querySelector('[aria-label="Show profile"]').click())
 expect(host.querySelector('.streak-profile-tools')).toBeNull()
 expect(host.querySelector('.streak-profile').getAttribute('aria-expanded')).toBe('false')
 act(()=>host.querySelector('.streak-profile-name').click())
 expect(host.querySelector('[aria-label="Hide profile"]')).not.toBeNull()
 expect(useUI.getState().sheets).toHaveLength(1)
 act(()=>host.querySelector('.streak-profile-avatar').click())
 expect(host.querySelector('.streak-profile-tools')).toBeNull()
 act(()=>root.render(null));render()
 expect(host.querySelector('.streak-profile-tools')).toBeNull()
 act(()=>host.querySelector('.streak-profile').click());act(()=>host.querySelector('[aria-label="Hide profile"]').click())
 expect(host.querySelector('.streak-profile')).toBeNull();expect(host.querySelector('[aria-label="Show profile"]')).not.toBeNull()
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).streakCalendarShowProfile).toBe(false)
 act(()=>root.render(null));render();expect(host.querySelector('[aria-label="Show profile"]')).not.toBeNull()
 expect(JSON.stringify(useStore.getState().S.profile)).toBe(profileBefore);expect(JSON.stringify(useStore.getState().S.workouts)).toBe(trainingBefore)
})
