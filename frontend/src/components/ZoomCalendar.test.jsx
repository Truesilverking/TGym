// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ZoomCalendar } from '../sheets.jsx'
import { useUI } from '../store/useUI.js'
import { calendarReportState } from '../lib/calendar-visual.js'

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
    expect(host.querySelectorAll('[data-legend]')).toHaveLength(7)
    expect(host.querySelector('[data-legend="rest"]').textContent).toContain('Rest day')
    expect(host.querySelector('[data-legend="untracked"]').textContent).toContain('Not tracking yet')
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
    expect(host.querySelector('[data-date="2026-09-01"]').getAttribute('aria-label')).toContain('Not tracking yet')
    expect(host.querySelector('[data-date="2026-09-01"]').style.getPropertyValue('--calendar-fill')).toBe('#d7dee8')
    expect(host.querySelector('[data-legend="untracked"]').textContent).toContain('Not tracking yet')
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
