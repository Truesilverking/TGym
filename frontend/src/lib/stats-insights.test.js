import { describe, expect, it } from 'vitest'
import { bmiBand, bmiFor, measurementValue, routineConsistency, sessionTimingSummary, validTimedSessions } from './stats-insights.js'

describe('body and session insights', () => {
  it('keeps legacy one-side measurements readable as left and right', () => {
    expect(measurementValue({ arm: 35 }, 'armLeft')).toBe(35)
    expect(measurementValue({ thigh: 60 }, 'thighRight')).toBe(60)
  })
  it('calculates BMI from kilograms and pounds', () => {
    expect(bmiFor(80, 'kg', 180)).toBe(24.7)
    expect(bmiFor(176.37, 'lb', 180)).toBe(24.7)
    expect(bmiBand(24.7)).toBe('Healthy range')
  })

  it('ignores missing and implausibly long timers', () => {
    const start = new Date(2026, 7, 1, 18, 0).getTime()
    expect(validTimedSessions([{ start, end: start + 60 * 60000 }, { start, end: start + 14 * 3600000 }, { start }])).toHaveLength(1)
  })

  it('summarises duration and a usual start time across midnight', () => {
    const a = new Date(2026, 7, 1, 23, 30).getTime()
    const b = new Date(2026, 7, 2, 0, 30).getTime()
    const result = sessionTimingSummary([{ id: 'a', start: a, end: a + 60 * 60000 }, { id: 'b', start: b, end: b + 90 * 60000 }])
    expect(result.averageMs).toBe(75 * 60000)
    expect(result.usualStartMinutes === 0 || result.usualStartMinutes === 1440).toBe(true)
  })

  it('counts completed, missed and extra routine days', () => {
    const S = {
      routines: [{ id: 'r', name: 'Upper' }], week: { 1: 'r' }, dayPlan: {},
      workouts: [{ d: '2026-08-24', routineId: 'r', name: 'Upper' }, { d: '2026-08-25', routineId: null, name: 'Extra' }],
    }
    const result = routineConsistency(S, 7, new Date(2026, 7, 31, 12))
    expect(result).toMatchObject({ planned: 1, completed: 1, missed: 0, extra: 1, rate: 1 })
  })
})
