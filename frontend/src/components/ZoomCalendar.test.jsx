// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ZoomCalendar } from '../sheets.jsx'
import { useUI } from '../store/useUI.js'

const state = () => ({
  workouts: [{ id: 'w1', d: '2026-09-02', name: 'Upper A' }],
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

  it('renders twelve seven-column mini calendars with invisible placeholders', () => {
    render(); act(() => zoomOut().click()); act(() => zoomOut().click())
    expect(host.querySelectorAll('.zoomcal-mini-month')).toHaveLength(12)
    expect(host.querySelector('.zoomcal-mini-month .completed')).not.toBeNull()
    expect(host.querySelectorAll('.zoomcal-mini-month .placeholder').length).toBeGreaterThan(0)
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
