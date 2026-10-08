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
  expect(host.querySelector('.streak-flame-fill').tagName.toLowerCase()).toBe('path')
  expect(host.querySelector('.streak-flame-fill').getAttribute('opacity')).toBe('1')
  expect(host.textContent).toContain('Your consistency is paying off. Keep the flame alive!')
})
it('keeps zero visible and neutral without a filled or animated active flame', () => {
  act(() => root.render(<WorkoutSummaryStreak value={0} />))
  expect(host.querySelector('.workout-summary-streak-value').textContent).toBe('0')
  expect(host.querySelector('.workout-summary-streak.inactive')).not.toBeNull()
  expect(host.querySelector('.streak-flame.inactive')).not.toBeNull()
  expect(host.querySelector('.streak-flame-fill').getAttribute('opacity')).toBe('0')
  expect(host.textContent).toContain('Complete a workout to start a streak.')
  expect(host.textContent).not.toContain('Keep the flame alive!')
})
it('fills the first valid day without a special filled option', () => {
  act(() => root.render(<StreakFlame value={1} />))
  const fill = host.querySelector('.streak-flame-fill')
  expect(fill.getAttribute('opacity')).toBe('1')
  expect(fill.getAttribute('d')).toBe(host.querySelector('.streak-flame-outline').getAttribute('d'))
})

it.each([
  ['pending', "Complete today's workout to keep your streak."],
  ['rest', 'No workout scheduled today — streak preserved.'],
  ['paused', 'Training paused — streak preserved.'],
])('preserves the filled counter while reporting %s', (state, message) => {
  act(() => root.render(<WorkoutSummaryStreak streak={{ current: 7, state }} />))
  expect(host.querySelector('.workout-summary-streak-value').textContent).toBe('7')
  expect(host.querySelector('.streak-status').dataset.streakState).toBe(state)
  expect(host.textContent).toContain(message)
  expect(host.querySelector('.streak-flame-fill').getAttribute('opacity')).toBe('1')
  expect(host.textContent).toContain('Week and month equivalents use completed training days: 7 per week and 30 per month.')
})

it('reports an interrupted streak neutrally without erasing its saved best', () => {
  const streak = { current: 0, best: 7, state: 'interrupted' }
  act(() => root.render(<WorkoutSummaryStreak streak={streak} />))
  expect(host.textContent).toContain('Streak interrupted. Complete a workout to start a new one.')
  expect(host.querySelector('.streak-flame-fill').getAttribute('opacity')).toBe('0')
  expect(streak.best).toBe(7)
})

it.each([[7, '1 week'], [14, '2 weeks'], [28, '4 weeks'], [30, '1 month'], [31, '1 month · 1 day'], [56, '1 month · 26 days']])('presents the agreed equivalent of %s without changing the counter', (value, equivalent) => {
  act(() => root.render(<WorkoutSummaryStreak value={value} />))
  expect(host.querySelector('.workout-summary-streak-value').textContent).toBe(String(value))
  expect(host.querySelector('.workout-summary-streak-period').textContent).toBe(equivalent)
})
