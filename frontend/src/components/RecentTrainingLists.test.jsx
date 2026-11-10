// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZoomCalendar, sessionTimingSheet, streakDetailSheet } from '../sheets.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { _setLangState } from '../lib/i18n-core.js'
import es from '../locales/es.js'

let host, root, original
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-16T12:00:00'))
  _setLangState('en')
  original = useStore.getState().S
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => {
  act(() => { root.unmount(); useUI.getState().closeAll() })
  host.remove(); useStore.setState({ S: original }); _setLangState('en'); vi.useRealTimers()
})

const fixture = count => {
  const workouts = Array.from({ length:count }, (_,index) => {
    const start = +new Date('2026-09-14T08:00:00') + index * 60000
    return { id:`session-${index}`, d:'2026-09-14', start, end:start+600000, name:`Session ${index}`,
      entries:[{ id:'exercise', sets:[{ done:true,r:8 }] }] }
  })
  // Import/storage order must never determine which records are shown first.
  const shuffled = [...workouts.filter((_,i)=>i%2), ...workouts.filter((_,i)=>!(i%2))]
  return { ...structuredClone(DEF), lang:'en', scheduleStarted:'2026-09-01', workouts:shuffled }
}
const showMore = () => host.querySelector('.recent-show-more')
const ids = selector => [...host.querySelectorAll(selector)].map(row=>row.getAttribute('data-workout-id'))
const renderSheet = (S,open) => {
  useStore.setState({ S }); act(() => open())
  act(() => root.render(useUI.getState().sheets.at(-1).render(() => {})))
}

describe('recent session times', () => {
  it.each([0,1,3,4,36])('keeps %i recorded sessions and initially shows at most three newest valid sessions', count => {
    const S=fixture(count), before=JSON.stringify(S), stored=localStorage.getItem('gym_state_v1')
    renderSheet(S,sessionTimingSheet)
    const selector='.recent-session-times .item'
    expect(ids(selector)).toEqual(Array.from({length:Math.min(count,3)},(_,i)=>`session-${count-1-i}`))
    if (count>3) {
      expect(showMore().textContent).toBe('Show more')
      act(() => showMore().click())
      expect(ids(selector)).toEqual(Array.from({length:count},(_,i)=>`session-${count-1-i}`))
    }
    expect(showMore()).toBeNull()
    expect(JSON.stringify(useStore.getState().S)).toBe(before)
    expect(localStorage.getItem('gym_state_v1')).toBe(stored)
    if (!count) expect(host.textContent).toContain('Finish a timed workout')
  })
})

describe('recent Streak workouts', () => {
  it.each([0,1,5,6,36])('keeps %i recorded workouts and shows the newest five without collapsing sessions on the same day', count => {
    const S=fixture(count), before=JSON.stringify(S)
    renderSheet(S,streakDetailSheet)
    const selector='.streak-recent-workouts .item'
    expect(ids(selector)).toEqual(Array.from({length:Math.min(count,5)},(_,i)=>`session-${count-1-i}`))
    if (count>5) {
      act(() => showMore().click())
      expect(ids(selector)).toEqual(Array.from({length:count},(_,i)=>`session-${count-1-i}`))
    }
    expect(showMore()).toBeNull()
    expect(JSON.stringify(useStore.getState().S)).toBe(before)
    if (!count) expect(host.querySelector('.streak-recent-workouts').textContent).toContain('No workouts yet')
  })

  it('sorts by workout date before time and omits duplicates, cancelled records and records without activity', () => {
    const S=fixture(2)
    S.workouts.push({...S.workouts[0]}, { ...S.workouts[0],id:'cancelled',cancelled:true },
      { ...S.workouts[0],id:'empty',entries:[] },
      { ...S.workouts[0],id:'next-date',d:'2026-09-15',start:null,end:null })
    renderSheet(S,streakDetailSheet)
    expect(ids('.streak-recent-workouts .item')).toEqual(['next-date','session-1','session-0'])
  })

  it('localizes Show more and retains access to workout details', () => {
    _setLangState('es',es)
    renderSheet(fixture(6),streakDetailSheet)
    expect(showMore().textContent).toBe('Mostrar más')
    act(() => host.querySelector('.streak-recent-workouts .item').click())
    expect(useUI.getState().sheets).toHaveLength(2)
  })
})

it.each(['week','month','months'])('keeps current/future treatments and bottom export in Streak %s without restoring selected details or Weight', level => {
  const S=fixture(1), before=JSON.stringify(S)
  act(() => root.render(<ZoomCalendar S={S} streakView initialLevel={level}/>))
  expect(host.querySelector('.zoomcal-legend .zoomcal-time-key')).toBeNull()
  expect(host.querySelector('.calendar-date[aria-current="date"]')).not.toBeNull()
  expect(host.querySelector('.calendar-date[data-future="true"]')).not.toBeNull()
  expect(host.querySelector('.zoomcal-selection, .zoomcal-actions-row')).toBeNull()
  expect(host.querySelectorAll('.zoomcal-toolbar .calendar-export-button')).toHaveLength(0)
  expect(host.querySelectorAll('.zoomcal-export-wrap .calendar-export-button')).toHaveLength(1)
  expect(host.querySelector('.seg')).toBeNull()
  expect(host.querySelector('.zoomcal-period-picker')).not.toBeNull()
  act(() => host.querySelector('.zoomcal-export-wrap .calendar-export-button').click())
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(JSON.stringify(S)).toBe(before)
})

it.each(['week','month','months'])('places the existing selected-routine muscles action between legends and export in Streak %s', level=>{
  const S={...fixture(1),routines:[{id:'routine',name:'Selected routine',ex:[]}],week:{3:'routine'}},before=JSON.stringify(S)
  useStore.setState({S})
  act(()=>root.render(<ZoomCalendar S={S} streakView initialLevel={level}/>))
  const legend=host.querySelector('.zoomcal-legend'),muscles=host.querySelector('.zoomcal-streak-muscles'),exportRow=host.querySelector('.zoomcal-export-wrap')
  expect(legend.compareDocumentPosition(muscles)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(muscles.compareDocumentPosition(exportRow)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(muscles.textContent).toBe('Muscles trained')
  act(()=>muscles.querySelector('button').click())
  const detail=document.createElement('div'),detailRoot=createRoot(detail)
  act(()=>detailRoot.render(useUI.getState().sheets.at(-1).render(()=>{})))
  expect(detail.querySelector('.routine-muscle-preview h3').textContent).toBe('Selected routine')
  act(()=>detailRoot.unmount())
  expect(JSON.stringify(useStore.getState().S)).toBe(before)
})
