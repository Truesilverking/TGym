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
  expect(summary.prsCount).toBe(1)
  expect(summary.weightDelta).toBe(-0.4)
  expect(summary.nutrition.daysLogged).toBe(2)
  expect(summary.nutrition.avgCalories).toBe(2250)
  expect(summary.nutrition.proteinAdherencePct).toBe(100)
})

it('keeps local calendar boundaries, excludes cancelled copies and preserves historical PRs', () => {
  const previousTZ = process.env.TZ
  process.env.TZ = 'Pacific/Auckland'
  try {
    const session = (id, d, w) => ({ id, d, start: new Date(d + 'T10:00:00').getTime(), entries: [{ id: 'bench', sets: [{ done: true, w, r: 5 }] }] })
    const first = session('first', '2026-10-19', 80)
    const S = { workouts: [first, first, { ...first, id: 'cancelled', cancelled: true }, session('later', '2026-10-26', 100)], nutrition: { logs: { '2026-10-19': { items: [{ calories: 1.4 }, { calories: 1.4 }] } } }, bodyweight: [{ d: '2026-10-19', t: new Date('2026-10-18T12:00:00').getTime(), w: 80 }, { d: '2026-10-25', w: 79 }] }
    const result = buildWeeklySummary(S, '2026-10-25')
    expect(result.mondayIso).toBe('2026-10-19')
    expect(result.sundayIso).toBe('2026-10-25')
    expect(result.workoutsCount).toBe(1)
    expect(result.prsCount).toBe(1)
    expect(result.prs[0].bestWeight.w).toBe(80)
    expect(result.nutrition.avgCalories).toBe(3)
    expect(result.weightDelta).toBe(-1)
  } finally { if (previousTZ == null) delete process.env.TZ; else process.env.TZ = previousTZ }
})

it('normalizes mixed units for weekly weight delta against profile unit', () => {
  const S = {
    unit: 'kg',
    bodyweight: [
      { d: '2026-10-19', w: 176.37, unit: 'lb' },
      { d: '2026-10-25', w: 79.0, unit: 'kg' },
    ],
  }
  const result = buildWeeklySummary(S, '2026-10-25')
  expect(result.weightDelta).toBe(-1)
})
