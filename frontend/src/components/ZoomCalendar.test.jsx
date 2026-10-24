// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ZoomCalendar, streakDetailSheet } from '../sheets.jsx'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { TRACKING_START_MARKER, calendarReportState } from '../lib/calendar-visual.js'
import { readFileSync } from 'node:fs'

const calendarStyles = readFileSync('src/components/CalendarVisual.css', 'utf8')
import { calendarActivity, calendarActivityCount } from '../lib/calendar-view.js'
import { _setLangState } from '../lib/i18n-core.js'
import es from '../locales/es.js'

const state = () => ({
  workouts: [{ id: 'w1', d: '2026-09-02', name: 'Upper A' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}],
  routines: [{ id: 'upper', name: 'Upper A' }, { id: 'lower', name: 'Lower B' }],
  week: { 3: 'upper', 4: 'lower' }, dayPlan: {}, scheduleStarted: '2026-09-01',
})

describe('zoom consistency calendar', () => {
  let host, root
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'))
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  })
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })
  const render = () => act(() => root.render(<ZoomCalendar S={state()} />))
  const zoomOut = () => [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Zoom out')

  it('uses the same dashed border on future dates and their legend after the CSS cascade', () => {
    const style = document.createElement('style')
    style.textContent = calendarStyles
    document.head.appendChild(style)
    host.style.setProperty('--label-2', '#888888')
    host.style.setProperty('--bg-el', '#111111')
    try {
      render()
      expect(getComputedStyle(host.querySelector('.calendar-date[data-future="true"]')).borderStyle).toBe('dashed')
      expect(getComputedStyle(host.querySelector('.zoomcal-future-key')).borderStyle).toBe('dashed')
    } finally { style.remove() }
  })

  it('marks deload days without replacing completion state in both day views', () => {
    const S=state(); S.trainingStartDate='2026-07-20'; S.deload={on:true,startDate:'2026-07-20',normalWeeks:6}; S.workouts[0].deload=true
    act(()=>root.render(<ZoomCalendar S={S}/>))
    expect(host.querySelectorAll('.zoomcal-day.deload')).toHaveLength(7)
    expect(host.querySelector('.zoomcal-day.completed.deload')).not.toBeNull()
    act(()=>zoomOut().click())
    expect(host.querySelectorAll('.zoomcal-day.deload')).toHaveLength(6)
  })
  it('renders seven square day buttons with routine names outside them', () => {
    render()
    const buttons = host.querySelectorAll('.zoomcal-week .zoomcal-day')
    expect(buttons).toHaveLength(7)
    expect([...buttons].some(b => b.textContent.includes('Upper A'))).toBe(false)
    expect([...host.querySelectorAll('.zoomcal-routine')].some(x => x.textContent === 'Upper A')).toBe(true)
    expect([...host.querySelectorAll('.zoomcal-routine')].some(x => x.textContent === 'Lower B')).toBe(true)
    expect(host.querySelector('.zoomcal-day.completed')).not.toBeNull()
    expect(host.querySelector('.zoomcal-day.today')).not.toBeNull()
    expect(host.querySelector('.zoomcal-day.selected')).not.toBeNull()
  })

  it('keeps month cells name-free and distinguishes missed from pending', () => {
    vi.setSystemTime(new Date('2026-09-16T12:00:00')); render(); act(() => zoomOut().click())
    expect(host.querySelectorAll('.zoomcal-month>small')).toHaveLength(7)
    expect([...host.querySelectorAll('.zoomcal-month .zoomcal-day')].some(b => /Upper A|Lower B/.test(b.textContent))).toBe(false)
    expect(host.querySelector('.zoomcal-month .missed')).not.toBeNull()
    expect(host.querySelector('.zoomcal-month .pending')).not.toBeNull()
    expect(host.querySelector('.zoomcal-month .selected')).not.toBeNull()
  })

  it('uses the same accessible partial/rest state and presentation in cells and the complete legend', () => {
    const S=state(); S.week[3]=['upper','lower']
    act(()=>root.render(<ZoomCalendar S={S}/>))
    const partial=host.querySelector('.zoomcal-day.partial'), legend=host.querySelector('[data-legend="partial"]')
    expect(partial.getAttribute('aria-label')).toContain('Partially completed')
    expect(partial.getAttribute('aria-label')).not.toContain('Rest day')
    expect(partial.querySelector('i, svg')).toBeNull()
    expect(partial.textContent).toBe('2')
    expect(legend.querySelector('i').textContent).toBe('')
    expect(partial.style.getPropertyValue('--calendar-fill')).toBe(legend.querySelector('i').style.getPropertyValue('--calendar-fill'))
    expect(host.querySelectorAll('[data-legend]')).toHaveLength(6)
    expect(host.querySelector('[data-legend="rest"]').textContent).toContain('Rest day')
    expect(host.querySelector('[data-legend="untracked"]')).toBeNull()
    expect(host.querySelector('.calendar-state-symbol')).toBeNull()
  })

  it('matches exported rest/paused/missed/pending colors and labels in month cells and legend', () => {
    vi.setSystemTime(new Date('2026-09-16T12:00:00'))
    const S = state()
    S.trainingStartDate = '2026-09-02'
    S.week = {}
    S.dayPlan = { '2026-09-03': ['lower'], '2026-09-04': [], '2026-09-05': ['upper'], '2026-09-17': ['upper'] }
    S.trainingPauses = [{ start: '2026-09-05', end: '2026-09-06' }]
    const before = JSON.stringify(S)
    act(() => root.render(<ZoomCalendar S={S} initialLevel="month" initialAnchor={new Date('2026-09-16T12:00:00')} />))
    for (const [status, date] of [['rest', '2026-09-04'], ['paused', '2026-09-05'], ['missed', '2026-09-03'], ['pending', '2026-09-17']]) {
      const visual = calendarReportState(status), cell = host.querySelector(`[data-date="${date}"]`)
      const legend = host.querySelector(`[data-legend="${status}"]`)
      expect(cell.getAttribute('data-status')).toBe(status)
      expect(cell.getAttribute('aria-label')).toContain(visual.label)
      expect(legend.textContent).toContain(visual.label)
      for (const element of [cell, legend.querySelector('i')]) {
        expect(element.style.getPropertyValue('--calendar-fill')).toBe(visual.fill)
        expect(element.style.getPropertyValue('--calendar-ink')).toBe(visual.ink)
        expect(element.style.getPropertyValue('--calendar-border')).toBe(visual.border)
      }
    }
    expect(host.querySelector('[data-date="2026-09-01"]').getAttribute('data-status')).toBe('untracked')
    expect(host.querySelector('[data-date="2026-09-01"]').getAttribute('aria-label')).toContain('Rest day')
    expect(host.querySelector('[data-date="2026-09-01"]').style.getPropertyValue('--calendar-fill')).toBe('#ffffff')
    expect(host.querySelector('[data-legend="untracked"]')).toBeNull()
    expect(JSON.stringify(S)).toBe(before)
  })

  it.each(['week', 'month', 'months', 'years'])('shows a separate tracking-start indicator without a pre-tracking category in %s view', level => {
    vi.setSystemTime(new Date('2026-09-16T12:00:00'))
    const S = state()
    S.trainingStartDate = '2025-01-01'
    S.trainingHistory = { trackedFrom: '2026-09-15', historicalWorkouts: 20, workoutsPerWeek: 3 }
    const before = JSON.stringify(S)
    // The real Sep2 workout advances the effective boundary before the entered Sep15.
    act(() => root.render(<ZoomCalendar S={S} initialLevel={level} initialAnchor={new Date('2026-09-02T12:00:00')} />))
    const marker = host.querySelector('.zoomcal-tracking-start')
    expect(marker).not.toBeNull()
    expect(host.querySelectorAll('.zoomcal-tracking-start')).toHaveLength(1)
    expect(marker.getAttribute('data-tracking-start')).toBe('2026-09-02')
    expect(marker.textContent).toContain('Tracking since')
    expect(marker.textContent).toContain('2026')
    expect(marker.style.getPropertyValue('--tracking-fill')).toBe(TRACKING_START_MARKER.fill)
    expect(marker.style.getPropertyValue('--tracking-border')).toBe(TRACKING_START_MARKER.border)
    expect(marker.querySelector('i').getAttribute('aria-hidden')).toBe('true')
    expect(marker.closest('.zoomcal-week, .zoomcal-month, .zoomcal-mini-month, .zoomcal-mini-year, .zoomcal-legend')).toBeNull()
    const body = host.querySelector('.zoomcal-week, .zoomcal-month, .zoomcal-periods')
    expect(marker.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(host.querySelectorAll('[data-legend]')).toHaveLength(6)
    expect(host.querySelector('[data-legend="untracked"]')).toBeNull()
    expect(host.textContent).not.toContain('Not tracking yet')
    for (const element of host.querySelectorAll('[aria-label], [title]')) {
      expect(element.getAttribute('aria-label') || '').not.toContain('Not tracking yet')
      expect(element.getAttribute('title') || '').not.toContain('Not tracking yet')
    }
    for (const cell of host.querySelectorAll('[data-status="untracked"]')) {
      expect(cell.style.getPropertyValue('--calendar-fill')).toBe('#ffffff')
      expect(cell.style.getPropertyValue('--calendar-border')).toBe('#7b8796')
    }
    for (const cell of host.querySelectorAll('[data-status]')) expect(cell.style.getPropertyValue('--calendar-fill')).not.toBe(TRACKING_START_MARKER.fill)
    const firstRecordedDay = host.querySelector('[data-date="2026-09-02"]')
    if (firstRecordedDay) expect(firstRecordedDay.style.getPropertyValue('--calendar-fill')).toBe('#115bb2')
    if (level === 'months' || level === 'years') {
      const firstPeriod = host.querySelector('.zoomcal-periods>button')
      expect(firstPeriod.getAttribute('data-active-days')).toBe('0')
      expect(firstPeriod.querySelector(':scope > small').textContent).toBe('Active days')
    }
    expect(JSON.stringify(S)).toBe(before)
  })

  it('keeps an untracked selected date visible without inventing a status or an earlier tracking boundary', () => {
    vi.setSystemTime(new Date('2026-09-16T12:00:00'))
    const S = { ...state(), trainingStartDate: '2025-01-01', trainingHistory: { trackedFrom: '2026-09-15', historicalWorkouts: 20, workoutsPerWeek: 3 }, workouts: [] }
    const before = JSON.stringify(S)
    act(() => root.render(<ZoomCalendar S={S} initialLevel="month" initialAnchor={new Date('2026-09-16T12:00:00')} />))
    expect(host.querySelector('.zoomcal-tracking-start').getAttribute('data-tracking-start')).toBe('2026-09-15')
    const untracked = host.querySelector('[data-date="2026-09-01"]')
    act(() => untracked.click())
    const selection = host.querySelector('.zoomcal-selection')
    expect(selection.querySelector('b').textContent).not.toBe('')
    expect(selection.querySelector('span')).toBeNull()
    expect(selection.style.getPropertyValue('--calendar-fill')).toBe('#ffffff')
    expect(host.querySelector('[data-date="2026-09-01"].selected')).not.toBeNull()
    expect(JSON.stringify(S)).toBe(before)
  })

  it('shows the full year boundary in the week heading outside the day cells', () => {
    act(()=>root.render(<ZoomCalendar S={state()} initialAnchor={new Date('2026-12-30T12:00:00')}/>))
    const title=host.querySelector('.zoomcal-title>b').textContent
    expect(title).toContain('2026'); expect(title).toContain('2027')
    expect([...host.querySelectorAll('.zoomcal-day b')].map(day=>day.textContent)).toEqual(['28','29','30','31','1','2','3'])
  })

  it('renders twelve seven-column mini calendars with invisible placeholders', () => {
    render(); act(() => zoomOut().click()); act(() => zoomOut().click())
    expect(host.querySelectorAll('.zoomcal-mini-month')).toHaveLength(12)
    expect(host.querySelector('.zoomcal-mini-month .completed')).not.toBeNull()
    expect(host.querySelectorAll('.zoomcal-mini-month .placeholder').length).toBeGreaterThan(0)
    expect(host.querySelectorAll('.zoomcal-mini-month .zoomcal-mini-weekday')).toHaveLength(84)
    expect(host.querySelectorAll('.zoomcal-mini-month .zoomcal-mini-day')).toHaveLength(365)
    expect(host.querySelector('.zoomcal-mini-month .zoomcal-mini-day').textContent).toBe('1')
    expect(host.querySelector('.zoomcal-mini-month .completed').getAttribute('aria-label')).toContain('Completed')
    expect(host.querySelector('.zoomcal-periods.months>button').getAttribute('aria-label')).toMatch(/January 2026.*Zoom in/)
  })

  it('keeps zoom navigation working through the year level', () => {
    render(); act(() => zoomOut().click()); act(() => zoomOut().click()); act(() => zoomOut().click())
    expect(host.querySelectorAll('.zoomcal-periods.years>button')).toHaveLength(12)
    const zoomIn = [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Zoom in')
    act(() => zoomIn.click())
    expect(host.querySelectorAll('.zoomcal-mini-month')).toHaveLength(12)
  })
})

it('uses a real inline export button with the existing icon before its text', () => {
  const host=document.createElement('div'), root=createRoot(host)
  act(()=>root.render(<ZoomCalendar S={state()} />))
  const button=host.querySelector('button.calendar-export-button')
  expect(button).not.toBeNull()
  expect(button.firstElementChild.tagName.toLowerCase()).toBe('svg')
  expect(button.lastElementChild.textContent).toBe('Export Calendar')
  expect([...host.querySelectorAll('.zoomcal-export-wrap button')].map(node => node.textContent)).toEqual(['Export Calendar'])
  expect(host.textContent).not.toContain('Consistency Report')
  expect(host.textContent).not.toContain('Export Reports')
  act(() => button.click())
  expect(useUI.getState().sheets).toHaveLength(1)
  const sheet = document.createElement('div'), sheetRoot = createRoot(sheet)
  act(() => sheetRoot.render(useUI.getState().sheets[0].render(() => {})))
  expect(sheet.querySelector('h3').textContent).toBe('Export Calendar')
  act(() => sheetRoot.unmount())
  useUI.getState().closeAll()
  act(()=>root.unmount())
})
it('keeps measurement markers secondary to training and out of yearly mini cells', () => {
  const host=document.createElement('div'), root=createRoot(host)
  const S={...state(),bodyweight:[{d:'2026-09-01',w:80}],measurementReminders:{items:{weight:{enabled:true,intervalValue:1,intervalUnit:'days'}}}}
  act(()=>root.render(<ZoomCalendar S={S} initialLevel="week" initialAnchor={new Date('2026-09-02T12:00:00')} />))
  expect(host.querySelectorAll('.measurement-calendar-dot').length).toBeGreaterThan(0)
  expect(host.querySelectorAll('.zoomcal-day.completed')).toHaveLength(1)
  act(()=>root.unmount())
  const yearRoot=createRoot(host)
  act(()=>yearRoot.render(<ZoomCalendar S={S} initialLevel="months" initialAnchor={new Date('2026-09-02T12:00:00')} />))
  expect(host.querySelector('.zoomcal-mini-month .measurement-calendar-dot')).toBeNull()
  act(()=>yearRoot.unmount())
})

describe('unified activity calendar presentation', () => {
  let host, root, originalState
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-16T12:00:00'))
    _setLangState('en')
    originalState = useStore.getState().S
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount()); host.remove()
    useUI.getState().closeAll(); useStore.setState({ S: originalState })
    _setLangState('en'); vi.useRealTimers()
  })
  const fixture = () => {
    const S = { ...state(), trainingStartDate: '2026-09-01', week: {},
      dayPlan: { '2026-09-02': ['upper', 'lower'], '2026-09-03': ['upper', 'lower'], '2026-09-17': ['upper'] } }
    const session = (id, d, routineId) => ({ id, d, name: 'Synthetic calendar session', routineId,
      sessionOrigin: { type: routineId ? 'planned' : 'extra', routineId }, entries: [{ id: 'synthetic-exercise', sets: [{ done: true, r: 8 }] }] })
    S.workouts = [session('upper2', '2026-09-02', 'upper'), session('extra2', '2026-09-02', null),
      session('upper3', '2026-09-03', 'upper'), session('lower3', '2026-09-03', 'lower'), session('future17', '2026-09-17', 'upper')]
    return S
  }
  const button = label => [...host.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label)
  const render = (S, level, anchor = new Date('2026-09-02T12:00:00')) => act(() => root.render(<ZoomCalendar key={level} S={S} initialLevel={level} initialAnchor={anchor} />))

  it.each(['week', 'month', 'months'])('shows real deduplicated activity rather than routine completion in %s view', level => {
    const S = fixture(), before = JSON.stringify(S)
    render(S, level)
    const period = host.querySelector('.zoomcal-period-active'), activity = calendarActivity(S, new Date())
    expect(host.querySelector('.zoomcal').getAttribute('data-level')).toBe(level)
    expect(period).not.toBeNull()
    expect(period.getAttribute('data-active-days')).toBe('2')
    expect(calendarActivityCount(activity, period.getAttribute('data-period-start'), period.getAttribute('data-period-end'))).toBe(2)
    expect(period.textContent).toMatch(/active days/i)
    expect(period.querySelector('strong').textContent).toBe('2')
    expect(host.querySelector('[data-date="2026-09-02"]').getAttribute('data-status')).toBe('partial')
    expect(host.querySelector('[data-date="2026-09-02"]').getAttribute('data-active')).toBe('true')
    expect(host.querySelector('[data-date="2026-09-02"]').style.getPropertyValue('--calendar-fill')).toBe('#0087c2')
    expect(JSON.stringify(S)).toBe(before)
  })

  it('shows January through December in twelve cards with independent monthly active-date counts', () => {
    render(fixture(), 'months')
    const cards = [...host.querySelectorAll('button.zoomcal-month-card')]
    expect(cards.map(card => card.getAttribute('data-month'))).toEqual(Array.from({ length: 12 }, (_, month) => `2026-${String(month + 1).padStart(2, '0')}`))
    expect(cards.map(card => Number(card.getAttribute('data-active-days')))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0])
    expect(cards[8].textContent).toMatch(/2.*active days/i)
    expect(cards[8].textContent).not.toMatch(/\d+\/\d+ completed/i)
    expect(host.querySelectorAll('.zoomcal-mini-weekday')).toHaveLength(84)
    const dates = [...host.querySelectorAll('.zoomcal-mini-month .calendar-date[data-date]')].map(cell => cell.getAttribute('data-date'))
    expect(dates).toHaveLength(365); expect(new Set(dates).size).toBe(365)
    expect(dates[0]).toBe('2026-01-01'); expect(dates.at(-1)).toBe('2026-12-31')
  })

  it.each(['week', 'month', 'months'])('marks future dates without inventing future activity in %s view', level => {
    const S = fixture(), before = JSON.stringify(S)
    render(S, level, new Date('2026-09-16T12:00:00'))
    const future = host.querySelector('[data-date="2026-09-17"]')
    expect(future.getAttribute('data-future')).toBe('true')
    expect(future.getAttribute('data-active')).toBe('false')
    expect(future.getAttribute('data-status')).toBe('completed')
    expect(future.querySelector('b').textContent).toBe('17')
    expect(future.style.getPropertyValue('--calendar-fill')).toBe(calendarReportState('completed').fill)
    const today = host.querySelector('[data-date="2026-09-16"]')
    expect(today.getAttribute('data-future')).toBe('false'); expect(today.classList.contains('today')).toBe(true)
    expect(JSON.stringify(S)).toBe(before)
  })

  it('retains leap day and the complete Monday-first year without hiding pre-tracking dates', () => {
    const S = { ...state(), workouts: [], trainingStartDate: '2024-06-15', trainingHistory: { trackedFrom: '2024-06-15', historicalWorkouts: 0, workoutsPerWeek: 0 } }
    render(S, 'months', new Date('2024-02-29T12:00:00'))
    const dates = [...host.querySelectorAll('.calendar-date[data-date]')]
    expect(dates).toHaveLength(366); expect(new Set(dates.map(cell => cell.getAttribute('data-date'))).size).toBe(366)
    const leap = host.querySelector('[data-date="2024-02-29"]')
    expect(leap.getAttribute('data-status')).toBe('untracked')
    expect(leap.style.getPropertyValue('--calendar-fill')).toBe('#ffffff')
    expect(leap.getAttribute('aria-label')).toContain('Rest day')
    expect(host.textContent).not.toContain('Not tracking yet')
    expect(host.querySelector('[data-month="2024-01"] .zoomcal-mini-month .placeholder')).toBeNull()
    expect(host.querySelectorAll('[data-month="2024-02"] .zoomcal-mini-month .placeholder')).toHaveLength(3)
    expect(host.querySelector('.zoomcal-period-active').getAttribute('data-active-days')).toBe('0')
  })

  it('preserves day selection and details while moving between annual cards and month view', () => {
    const S = fixture(), onDay = vi.fn(), before = JSON.stringify(S)
    act(() => root.render(<ZoomCalendar S={S} onDay={onDay} initialLevel="months" initialAnchor={new Date('2026-09-02T12:00:00')} />))
    act(() => host.querySelector('[data-month="2026-09"]').click())
    expect(host.querySelector('.zoomcal').getAttribute('data-level')).toBe('month')
    act(() => host.querySelector('.zoomcal-day[data-date="2026-09-02"]').click())
    expect(onDay).toHaveBeenCalledExactlyOnceWith('2026-09-02')
    act(() => button('Zoom out').click())
    expect(host.querySelector('.zoomcal').getAttribute('data-level')).toBe('months')
    expect(host.querySelector('.calendar-date[data-date="2026-09-02"]').classList.contains('selected')).toBe(true)
    act(() => button('Next').click())
    expect(host.querySelector('[data-month="2027-01"]')).not.toBeNull()
    expect(host.querySelector('.zoomcal-period-active').getAttribute('data-active-days')).toBe('0')
    act(() => button('Prev').click())
    expect(host.querySelector('.zoomcal-period-active').getAttribute('data-active-days')).toBe('2')
    expect(JSON.stringify(S)).toBe(before)
  })

  it('switches the shared Week/Month/Year control without losing the anchor or its activity count', () => {
    const S = fixture(), before = JSON.stringify(S)
    render(S, 'week')
    const tabs = () => [...host.querySelectorAll('.zoomcal-toolbar .seg button')]
    expect(tabs().map(tab => tab.textContent)).toEqual(['Week', 'Month', 'Year'])
    for (const [label, level] of [['Month', 'month'], ['Year', 'months'], ['Week', 'week']]) {
      act(() => tabs().find(tab => tab.textContent === label).click())
      expect(host.querySelector('.zoomcal').getAttribute('data-level')).toBe(level)
      expect(tabs().find(tab => tab.getAttribute('aria-pressed') === 'true').textContent).toBe(label)
      expect(host.querySelector('.zoomcal-period-active').getAttribute('data-active-days')).toBe('2')
      expect(host.querySelector('[data-date="2026-09-02"]')).not.toBeNull()
    }
    expect(JSON.stringify(S)).toBe(before)
  })

  it('uses localized headings, day names and active-day labels in the same annual layout', () => {
    _setLangState('es', es)
    render(fixture(), 'months')
    expect(host.querySelector('[data-month="2026-01"] .zoomcal-period-head b').textContent).toBe('Enero')
    expect(host.querySelector('[data-month="2026-12"] .zoomcal-period-head b').textContent).toBe('Diciembre')
    expect([...host.querySelectorAll('[data-month="2026-01"] .zoomcal-mini-weekday')].map(day => day.textContent)).toEqual(['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'])
    expect(host.querySelector('.zoomcal-period-active').textContent).toMatch(/días activos/i)
    expect(host.querySelector('[data-month="2026-09"]').getAttribute('aria-label')).toMatch(/días activos/i)
  })

  it('keeps a new user at zero while retaining all days and the effective tracking marker', () => {
    const S = { ...state(), workouts: [], week: {}, dayPlan: {}, scheduleStarted: null }
    const before = JSON.stringify(S)
    render(S, 'months')
    expect(host.querySelector('.zoomcal-period-active').getAttribute('data-active-days')).toBe('0')
    expect([...host.querySelectorAll('.zoomcal-month-card')].every(card => card.getAttribute('data-active-days') === '0')).toBe(true)
    expect(host.querySelectorAll('.calendar-date[data-date]')).toHaveLength(365)
    expect(host.querySelector('.zoomcal-tracking-start').getAttribute('data-tracking-start')).toBe('2026-09-16')
    expect(JSON.stringify(S)).toBe(before)
  })

  it('refreshes visible counts and future markers after a suspended calendar resumes on the next local date', () => {
    const S = fixture(), before = JSON.stringify(S)
    render(S, 'months')
    expect(host.querySelector('.zoomcal-period-active').getAttribute('data-active-days')).toBe('2')
    expect(host.querySelector('[data-date="2026-09-17"]').getAttribute('data-future')).toBe('true')
    vi.setSystemTime(new Date('2026-09-17T12:00:00'))
    act(() => window.dispatchEvent(new Event('pageshow')))
    expect(host.querySelector('.zoomcal-period-active').getAttribute('data-active-days')).toBe('3')
    const resumedDay = host.querySelector('[data-date="2026-09-17"]')
    expect(resumedDay.getAttribute('data-future')).toBe('false')
    expect(resumedDay.getAttribute('data-active')).toBe('true')
    expect(resumedDay.classList.contains('today')).toBe(true)
    expect(JSON.stringify(S)).toBe(before)
  })

  it('opens the Streak detail at the week calendar with bottom export and independent recent workouts', () => {
    const S = { ...originalState, ...fixture() }
    useStore.setState({ S })
    act(() => streakDetailSheet())
    const sheet = useUI.getState().sheets.at(-1)
    act(() => root.render(sheet.render(() => {})))
    expect(host.querySelector('.zoomcal').getAttribute('data-level')).toBe('week')
    expect(host.querySelectorAll('.zoomcal-week .zoomcal-day')).toHaveLength(7)
    expect(host.querySelector('.zoomcal-toolbar .calendar-export-button')).toBeNull()
    expect(host.querySelector('.zoomcal-export-wrap .calendar-export-button')).not.toBeNull()
    expect(host.querySelector('.streak-recent-workouts').closest('.zoomcal')).toBeNull()
    act(() => root.render(<ZoomCalendar key="default" S={S} />))
    expect(host.querySelector('.zoomcal').getAttribute('data-level')).toBe('week')
  })
})
