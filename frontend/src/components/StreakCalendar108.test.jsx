// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach, afterEach, it, expect, vi} from 'vitest'
import {ZoomCalendar, streakDetailSheet} from '../sheets.jsx'
import {DEF, useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {_setLangState} from '../lib/i18n-core.js'

let host, root, original, originalUser, stored
const workout=(id,d)=>({id,d,routineId:'routine',name:'Recorded routine',entries:[{id:'exercise',sets:[{done:true,r:8}]}]})
const fixture=()=>({...structuredClone(DEF),lang:'en',scheduleStarted:'2026-10-19',
  trainingHistory:{trackedFrom:'2026-10-19',historicalWorkouts:0},
  profile:{name:'Synthetic Local',photo:null},
  routines:[{id:'routine',name:'Existing routine',ex:[]}],week:{1:'routine',2:'routine',3:'routine',4:'routine'},
  workouts:[workout('monday','2026-10-19'),workout('tuesday','2026-10-20'),workout('thursday','2026-10-22'),workout('extra-thursday','2026-10-22')]})
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-22T12:00:00'));_setLangState('en')
  original=useStore.getState().S;originalUser=useStore.getState().user;stored=localStorage.getItem('gym_state_v1')
  host=document.createElement('div');document.body.append(host);root=createRoot(host);useUI.getState().closeAll()
})
afterEach(()=>{
  act(()=>{root.unmount();useUI.getState().closeAll()});host.remove()
  useStore.setState({S:original,user:originalUser})
  if(stored===null)localStorage.removeItem('gym_state_v1');else localStorage.setItem('gym_state_v1',stored)
  vi.clearAllTimers();vi.useRealTimers()
})
const renderDetail=S=>{
  useStore.setState({S,user:{name:'Cloud identity',email:'private@example.test'}})
  act(()=>streakDetailSheet());act(()=>root.render(useUI.getState().sheets.at(-1).render(()=>{})))
}

it.each(['week','month','months'])('starts the %s key closed, keeps selection/navigation local and closes it on reopening',level=>{
  const S=fixture(),before=JSON.stringify(S),persisted=localStorage.getItem('gym_state_v1'),onDay=vi.fn()
  const render=()=>act(()=>root.render(<ZoomCalendar S={S} streakView initialLevel={level} onDay={onDay}/>))
  render()
  const key=host.querySelector('details.zoomcal-key')
  expect(key.open).toBe(false)
  expect(key.querySelector('summary').textContent).toBe('Calendar key')
  expect(key.querySelector('.zoomcal-legend')).not.toBeNull()
  act(()=>{key.open=true})
  expect(key.open).toBe(true)
  if(level==='months')act(()=>host.querySelector('[data-month="2026-10"]').click())
  act(()=>host.querySelector('button[data-date="2026-10-22"]').click())
  expect(onDay).toHaveBeenCalledExactlyOnceWith('2026-10-22')
  expect(host.querySelector('[data-date="2026-10-22"]').classList.contains('selected')).toBe(true)
  act(()=>host.querySelector('.zoomcal-nav>button[aria-label="Next"]').click())
  expect(host.querySelector('details.zoomcal-key').open).toBe(true)
  act(()=>{key.open=false});expect(key.open).toBe(false)
  act(()=>{key.open=true});act(()=>root.render(null));render()
  expect(host.querySelector('details.zoomcal-key').open).toBe(false)
  expect(JSON.stringify(S)).toBe(before)
  expect(localStorage.getItem('gym_state_v1')).toBe(persisted)
})

it.each([{streakView:false},{streakView:true,exporting:true}])('keeps noninteractive export and other calendar keys visible for %o',props=>{
  act(()=>root.render(<ZoomCalendar S={fixture()} {...props}/>))
  expect(host.querySelector('.zoomcal-key')).toBeNull()
  expect(host.querySelector('.zoomcal-legend')).not.toBeNull()
})

it('centers the name above the photo and streak, with the period and distinct activity total between the arrows',()=>{
  const S=fixture();S.streakCalendarShowProfile=true;renderDetail(S)
  const calendar=host.querySelector('.streak-calendar'),heading=calendar.querySelector('.streak-calendar-heading')
  const nav=calendar.querySelector('.zoomcal-nav'),period=nav.querySelector('.zoomcal-period-heading')
  expect(heading.querySelector('.streak-profile-name').textContent).toBe('Synthetic Local')
  expect(heading.querySelector('.streak-main .streak-number').textContent).toBe('1')
  expect(heading.compareDocumentPosition(nav)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(heading.firstElementChild.classList.contains('streak-profile-identity')).toBe(true)
  const identity=heading.querySelector('.streak-profile-summary')
  expect(identity.firstElementChild.classList.contains('streak-profile')).toBe(true)
  expect(identity.lastElementChild.classList.contains('streak-main')).toBe(true)
  expect(heading.querySelector('.streak-profile-identity .streak-profile-name')).not.toBeNull()
  expect(heading.textContent).not.toContain('Training days in this streak')
  expect(heading.querySelector('.streak-main').getAttribute('aria-label')).toBe('Training streak: 1')
  expect(nav.children[0].getAttribute('aria-label')).toBe('Prev')
  expect(nav.children[1]).toBe(period)
  expect(nav.children[2].getAttribute('aria-label')).toBe('Next')
  expect(period.firstElementChild.classList.contains('zoomcal-period-picker')).toBe(true)
  expect(period.lastElementChild.classList.contains('zoomcal-period-active')).toBe(true)
  expect(nav.querySelector('.streak-profile,.streak-main')).toBeNull()
  expect(period.querySelector('.zoomcal-period-active').textContent).toBe('3')
  expect(calendar.textContent).not.toMatch(/Cloud identity|private@example/)
})

it('replaces the unexplained milestone with distinct total dates independently of current and best streaks',()=>{
  const S=fixture()
  S.workouts.push(workout('future','2026-10-23'))
  const pending=workout('unfinished','2026-10-21');pending.entries[0].sets[0].done=false;S.workouts.push(pending)
  const before=JSON.stringify(S);renderDetail(S)
  const values=Object.fromEntries([...host.querySelectorAll('.tiles .tile')].map(tile=>[tile.querySelector('.l').textContent,tile.querySelector('.v').textContent]))
  expect(values).toEqual({'Best streak':'2','Total training days':'3'})
  expect(host.querySelector('.streak-number').textContent).toBe('1')
  expect(host.textContent).not.toContain('Next milestone')
  expect(JSON.stringify(useStore.getState().S)).toBe(before)
})

it('falls back from a broken photo and retries a replacement without changing the stored profile',()=>{
  const S=fixture();S.streakCalendarShowProfile=true;S.profile.photo='https://example.test/missing-avatar.png';renderDetail(S)
  const before=JSON.stringify(useStore.getState().S),image=host.querySelector('.streak-profile img')
  act(()=>image.dispatchEvent(new Event('error')))
  expect(host.querySelector('.streak-profile img')).toBeNull()
  expect(host.querySelector('.streak-profile-avatar').textContent).toBe('SL')
  expect(JSON.stringify(useStore.getState().S)).toBe(before)
  const replacement={...useStore.getState().S,profile:{name:'Synthetic Local',photo:'data:image/png;base64,replacement'}}
  act(()=>useStore.setState({S:replacement}))
  expect(host.querySelector('.streak-profile img').getAttribute('src')).toBe(replacement.profile.photo)
})

it('reveals the same hide control from the name and avatar and preserves only its existing visibility preference',()=>{
  const S=fixture();S.streakCalendarShowProfile=true;renderDetail(S)
  const before=JSON.stringify(S)
  for(const selector of ['.streak-profile-name','.streak-profile']){
    act(()=>host.querySelector(selector).click())
    const control=host.querySelector('[aria-label="Hide profile"]')
    expect(control).not.toBeNull()
    expect(host.querySelector('.streak-profile-name').getAttribute('aria-controls')).toBe(control.parentElement.id)
    expect(host.querySelector('.streak-profile').getAttribute('aria-expanded')).toBe('true')
    expect(useUI.getState().sheets).toHaveLength(1)
    act(()=>host.querySelector(selector).click())
    expect(host.querySelector('[aria-label="Hide profile"]')).toBeNull()
  }
  expect(JSON.stringify(useStore.getState().S)).toBe(before)
  act(()=>host.querySelector('.streak-profile-name').click());act(()=>host.querySelector('[aria-label="Hide profile"]').click())
  expect(host.querySelector('.streak-profile-name,.streak-profile')).toBeNull()
  expect(host.querySelector('[aria-label="Show profile"]')).not.toBeNull()
  const expected={...S,streakCalendarShowProfile:false}
  expect(useStore.getState().S.profile).toEqual(S.profile)
  expect(useStore.getState().S.workouts).toEqual(S.workouts)
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).streakCalendarShowProfile).toBe(expected.streakCalendarShowProfile)
})
