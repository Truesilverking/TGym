// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WorkoutSummaryStreak from './WorkoutSummaryStreak.jsx'
import StreakFlame from './StreakFlame.jsx'

vi.mock('../lib/i18n.js', () => ({ t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]) }))
let root, host
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

it.each([1, 4, 7, 14, 100])('shows a full highlighted flame for an active streak of %s', value => {
  act(() => root.render(<WorkoutSummaryStreak value={value} />))
  expect(host.querySelector('.workout-summary-streak-value').textContent).toBe(String(value))
  expect(host.querySelector('.workout-summary-streak.active')).not.toBeNull()
  expect(host.querySelector('.streak-flame.active')).not.toBeNull()
  expect(host.querySelector('.streak-flame-fill').getAttribute('y')).toBe('0')
  expect(host.querySelector('.streak-flame-fill').getAttribute('height')).toBe('24')
  expect(host.textContent).toContain('Your consistency is paying off. Keep the flame alive!')
})
it('keeps zero visible and neutral without a filled or animated active flame', () => {
  act(() => root.render(<WorkoutSummaryStreak value={0} />))
  expect(host.querySelector('.workout-summary-streak-value').textContent).toBe('0')
  expect(host.querySelector('.workout-summary-streak.inactive')).not.toBeNull()
  expect(host.querySelector('.streak-flame.inactive')).not.toBeNull()
  expect(host.querySelector('.streak-flame-fill').getAttribute('height')).toBe('0')
  expect(host.textContent).toContain('Activity days advance the streak; missed scheduled days reset it.')
  expect(host.textContent).not.toContain('Keep the flame alive!')
})
it('preserves the existing partial-fill behavior when no filled option is requested', () => {
  act(() => root.render(<StreakFlame value={1} />))
  const fill = host.querySelector('.streak-flame-fill')
  expect(Number(fill.getAttribute('y'))).toBeGreaterThan(0)
  expect(Number(fill.getAttribute('height'))).toBeLessThan(24)
})

it.each([[7, '1 week'], [14, '2 weeks'], [28, '4 weeks'], [30, '1 month'], [31, '1 month · 1 day'], [56, '1 month · 26 days']])('presents the agreed equivalent of %s without changing the counter', (value, equivalent) => {
  act(() => root.render(<WorkoutSummaryStreak value={value} />))
  expect(host.querySelector('.workout-summary-streak-value').textContent).toBe(String(value))
  expect(host.querySelector('.workout-summary-streak-period').textContent).toBe(equivalent)
})
