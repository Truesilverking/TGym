import { it, expect } from 'vitest'
import { buildWeeklySummary } from './weekly-summary.js'

it('builds a weekly summary aggregating workouts, volume, nutrition and weight changes', () => {
  const anchor = new Date('2026-10-25T12:00:00') // Sunday
  const monday = new Date('2026-10-19T12:00:00')

  const state = {
    workouts: [
      { start: monday.getTime() + 1000, entries: [{ id: '0025', sets: [{ done: true, w: 100, r: 5 }] }] },
      { start: monday.getTime() + 2 * 86400000, entries: [{ id: '0025', sets: [{ done: true, w: 105, r: 5 }] }] },
    ],
    bodyweight: [
      { t: monday.getTime(), w: 80.0 },
      { t: monday.getTime() + 5 * 86400000, w: 79.6 },
    ],
    nutrition: {
      goals: { protein: 150 },
      logs: {
        '2026-10-19': { items: [{ calories: 2200, protein: 150, qty: 1 }] },
        '2026-10-20': { items: [{ calories: 2300, protein: 140, qty: 1 }] },
      },
    },
  }

  const summary = buildWeeklySummary(state, anchor)
  expect(summary.workoutsCount).toBe(2)
  expect(summary.weightDelta).toBe(-0.4)
  expect(summary.nutrition.daysLogged).toBe(2)
  expect(summary.nutrition.avgCalories).toBe(2250)
  expect(summary.nutrition.proteinAdherencePct).toBe(100)
})
