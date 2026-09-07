import { describe, expect, it } from 'vitest'
import { recalculatePendingWarmups, warmupPrescription } from './warmup.js'

const weights = count => warmupPrescription({ workWeight: 100, workReps: 8, count, step: 5 }).map(x => x.w)
describe('automatic warm-up prescription', () => {
  it('uses the deterministic load profile', () => {
    expect(weights(1)).toEqual([50]); expect(weights(2)).toEqual([40, 70]); expect(weights(3)).toEqual([35, 60, 80])
    expect(weights(4)).toEqual([30, 50, 70, 85]); expect(weights(5)).toEqual([25, 45, 60, 75, 90])
  })
  it('rounds load down to a usable step', () => {
    const rows = warmupPrescription({ workWeight: 95, workReps: 8, count: 3, step: 5 })
    expect(rows.every(x => x.w % 5 === 0)).toBe(true)
    expect(rows.map(x => x.w)).toEqual([30, 55, 75])
  })
  it('reduces reps without producing zero', () => {
    expect(warmupPrescription({ workReps: 8, count: 3 }).map(x => x.r)).toEqual([6, 4, 2])
    expect(warmupPrescription({ workReps: 5, count: 3 }).map(x => x.r)).toEqual([4, 3, 2])
    expect(warmupPrescription({ workReps: 3, count: 3 }).map(x => x.r)).toEqual([2, 1, 1])
    expect(warmupPrescription({ workReps: 1, count: 3 }).map(x => x.r)).toEqual([1, 1, 1])
  })
  it('uses shorter timed targets and preserves per-side meaning', () => {
    const rows = warmupPrescription({ workWeight: 20, workSec: 60, count: 3, mode: 'time', side: true })
    expect(rows.map(x => x.sec)).toEqual([21, 30, 42]); expect(rows.every(x => x.side && x.sec < 60)).toBe(true)
  })
  it('recalculates pending rows from first work set and preserves completed rows', () => {
    const rows = [{ w: 20, r: 4, done: true, phase: 'warmup' }, { w: 60, r: 4, done: false, phase: 'warmup' }, { w: 110, r: 5, done: false, role: 'top' }, { w: 100, r: 7, done: false, role: 'backoff' }]
    const out = recalculatePendingWarmups(rows, { step: 5 })
    expect(out[0]).toEqual(rows[0]); expect(out[1]).toMatchObject({ w: 75, r: 3 }); expect(out[2].w).toBe(110)
  })
})
