// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Home from '../views/Home.jsx'
import { ZoomCalendar, streakDetailSheet } from '../sheets.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setLang } from '../lib/i18n.js'

let host, root
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label)
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 16, 12))
  await setLang('en')
  useStore.setState({ S: { ...structuredClone(DEF), routines: [{ id: 'r', name: 'Upper long routine name', ex: [] }], week: { 3: 'r', 5: 'r' }, scheduleStarted: '2026-09-01', lang: 'en' }, user: null })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => { root.unmount(); useUI.getState().closeAll() }); host.remove(); vi.clearAllTimers(); vi.useRealTimers() })

it('opens the shared calendar from Home with only Week/Month and allows schedule edits', () => {
  act(() => root.render(<MemoryRouter><Home /></MemoryRouter>))
  const expand = host.querySelector('[aria-label="Expand calendar"]')
  expect(expand).not.toBeNull()
  act(() => expand.click())
  const sheet = useUI.getState().sheets.at(-1)
  act(() => root.render(sheet.render(() => {})))
  expect(button('Week')).toBeTruthy(); expect(button('Month')).toBeTruthy()
  expect(button('Year')).toBeUndefined()
  act(() => button('Month').click())
  expect(host.querySelectorAll('.zoomcal-month .zoomcal-day')).toHaveLength(30)
  act(() => host.querySelectorAll('.zoomcal-month .zoomcal-day')[16].click())
  act(() => button('Edit schedule').click())
  expect(useUI.getState().sheets).toHaveLength(2)
})

it('moves the next workout immediately after matching completion and omits recent status subtitles', () => {
  act(() => streakDetailSheet())
  act(() => root.render(useUI.getState().sheets.at(-1).render(() => {})))
  const card = () => [...host.querySelectorAll('.card')].find(el => el.textContent.includes('Next scheduled workout'))
  expect(card().textContent).toContain('Wednesday')
  act(() => useStore.getState().update(S => S.workouts.push({ id: 'w', d: '2026-09-16', routineId: 'r', name: 'Older name', entries: [] })))
  expect(card().textContent).toContain('Friday')
  expect(host.querySelector('.recent-streak-item .ss')).toBeNull()
  expect(host.querySelector('.recent-streak-item').getAttribute('aria-label')).toContain('Completed')
})

it('places the deload square first only for the visible deload week and keeps measurements out of labels', () => {
  const S = useStore.getState().S
  S.deload = { on: true, startDate: '2026-08-03', normalWeeks: 6 }
  S.measurementReminders = { items: { weight: { enabled: true, intervalValue: 1, intervalUnit: 'days' } } }
  act(() => root.render(<ZoomCalendar S={S} />))
  expect(host.querySelector('.zoomcal-legend span').textContent).toBe('Deload Week')
  expect(host.querySelector('.measurement-calendar-label')).toBeNull()
  expect(host.querySelector('.zoomcal-legend').compareDocumentPosition(host.querySelector('.zoomcal-selection')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  act(() => host.querySelector('.zoomcal-nav>button').click())
  expect(host.querySelector('.zoomcal-legend .deload')).toBeNull()
  expect(host.querySelector('.zoomcal-export-wrap .calendar-export-button')).not.toBeNull()
})
