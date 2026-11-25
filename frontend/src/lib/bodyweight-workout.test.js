import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { dailyWeightForWorkout } from './bodyweight-workout.js'
import { LB_PER_KG } from './weight-units.js'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-21T12:00:00')) })
afterEach(() => vi.useRealTimers())

it.each(['manual', 'withings', 'health-connect'])('reads the saved daily %s aggregate without changing its samples', source => {
  const state = { unit: 'kg', bodyweight: [{ d: '2026-11-21', w: 80.5, t: Date.now() - 1000,
    samples: [{ id: 'kept-a', source, w: 80 }, { id: 'kept-b', source, w: 81 }] }] }
  const before = structuredClone(state)
  expect(dailyWeightForWorkout(state)).toBe(80.5)
  expect(state).toEqual(before)
})

it.each([['kg', 'lb', 80, 80 * LB_PER_KG], ['lb', 'kg', 176, 176 / LB_PER_KG]])(
  'normalizes a %s stamped daily row into the current %s unit without rounding it', (from, unit, w, expected) => {
    const state = { unit, bodyweight: [{ d: '2026-11-21', unit: from, w }] }
    const before = structuredClone(state)
    expect(dailyWeightForWorkout(state)).toBeCloseTo(expected, 10)
    expect(state).toEqual(before)
  })

it('keeps legacy unstamped entries in their configured profile unit', () => {
  expect(dailyWeightForWorkout({ unit: 'lb', bodyweight: [{ d: '2026-11-21', w: '176.5' }] })).toBe(176.5)
})

it.each([undefined, null, [], {}, [{ d: '2026-11-20', w: 80 }], [{ d: '2026-11-22', w: 80 }],
  [{ d: '2026-11-21', w: '' }], [{ d: '2026-11-21', w: 0 }], [{ d: '2026-11-21', w: -1 }],
  [{ d: '2026-11-21', w: Infinity }], [{ d: '2026-11-21', w: 'invalid' }],
  [{ d: '2026-11-21', w: 80, unit: 'stones' }], [{ d: '2026-11-21', w: 80, t: -1 }],
  [{ d: '2026-11-21', w: 80, t: 'invalid' }]])('does not substitute an absent or invalid daily weight (%j)', bodyweight => {
    expect(dailyWeightForWorkout({ unit: 'kg', bodyweight })).toBeNull()
  })

it('rejects an entry whose measurement timestamp is still in the future', () => {
  expect(dailyWeightForWorkout({ unit: 'kg', bodyweight: [{ d: '2026-11-21', w: 80, t: Date.now() + 1 }] })).toBeNull()
})

it('uses the latest valid same-day aggregate and ignores a newer malformed duplicate', () => {
  expect(dailyWeightForWorkout({ unit: 'kg', bodyweight: [
    { d: '2026-11-21', w: 80, t: 100 }, { d: '2026-11-21', w: 81, t: 200 },
    { d: '2026-11-21', w: 0, t: 300 }, { d: '2026-11-20', w: 90, t: 400 },
  ] })).toBe(81)
})

it('stops reusing yesterday when the local calendar day changes', () => {
  const state = { unit: 'kg', bodyweight: [{ d: '2026-11-21', w: 80 }] }
  expect(dailyWeightForWorkout(state)).toBe(80)
  vi.setSystemTime(new Date('2026-11-22T00:00:01'))
  expect(dailyWeightForWorkout(state)).toBeNull()
})
