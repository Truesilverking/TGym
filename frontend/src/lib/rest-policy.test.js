import { describe, expect, it } from 'vitest'
import { restSeconds } from './rest-policy.js'

const state = { restSec: 90, restAdvanced: { warmup: 45, betweenExercises: 120, supersetMove: 0, supersetRound: 150 } }
describe('rest hierarchy', () => {
  it('uses global defaults for each phase', () => {
    expect(restSeconds({ state })).toBe(90)
    expect(restSeconds({ state, warmup: true })).toBe(45)
    expect(restSeconds({ state, phase: 'betweenExercises' })).toBe(90)
    expect(restSeconds({ state, phase: 'supersetMove' })).toBe(0)
    expect(restSeconds({ state, phase: 'supersetRound' })).toBe(150)
  })
  it('prefers the exercise value, then the routine and global value', () => {
    expect(restSeconds({ state, routine: { restSec: 80 } })).toBe(80)
    expect(restSeconds({ state, routine: { restSec: 80 }, target: { restSec: 70 } })).toBe(70)
    expect(restSeconds({ state, target: { restSec: 70, setRestSec: [30, 60] }, setIndex: 1 })).toBe(70)
    expect(restSeconds({ state, routine: { restSec: 80, betweenRestSec: 240 }, target: { restSec: 70, afterRestSec: 300 }, phase: 'betweenExercises' })).toBe(70)
  })
  it('preserves an explicit zero to disable a timer', () => {
    expect(restSeconds({ state, target: { restSec: 0 } })).toBe(0)
  })
})
