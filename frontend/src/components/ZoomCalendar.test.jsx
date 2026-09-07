// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ZoomCalendar } from '../sheets.jsx'

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
