// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './useStore.js'
import { beginWorkout } from '../sheets.jsx'
import { applyRoutineExchange, createRoutineExchange, validateRoutineExchange } from '../lib/routine-exchange.js'
import { applyTrainingPlan, repBounds, withBackoffRepsMode } from '../lib/training-plan.js'

const base = { id: '0025', setScheme: 'topback', sets: 3, topSets: 1, backoffSets: 2, reps: 8, repsMin: 6, repRange: true, topRepsMin: 6, topRepsMax: 8, weight: 40, backoffPct: 10, prog: 'off' }
const history = [{ id: 'preserved-history', sessionOrigin: { type: 'extra', routineId: null }, name: 'Previous session', d: '2026-10-01', start: 1000, end: 61000, entries: [] }]
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T12:00:00Z')); localStorage.clear()
  useStore.setState({ user: null, S: { ...structuredClone(DEF), lang: 'en', active: null, unit: 'kg', backoffRepsMode: 'same', workouts: structuredClone(history), exWeights: {}, routines: [], routineOrder: [], week: {}, dayPlan: {} } })
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('explicit Back-off overrides and legacy profile inheritance', () => {
  it('honors only marked automatic modes and positive legacy offsets', () => {
    expect(repBounds(withBackoffRepsMode({ ...base, backoffRepsMode: 'same', backoffRepsOverride: true }, { backoffRepsMode: 'increased' }), 'backoff')).toEqual({ min: 6, max: 8 })
    expect(repBounds(withBackoffRepsMode({ ...base, backoffRepsMode: 'increased', backoffRepsOverride: true }, { backoffRepsMode: 'same' }), 'backoff')).toEqual({ min: 8, max: 10 })
    expect(repBounds(withBackoffRepsMode({ ...base, backoffRepOffset: 4, backoffRepsOverride: true }, { backoffRepsMode: 'same' }), 'backoff')).toEqual({ min: 10, max: 12 })
    for (const flag of [undefined, false]) {
      expect(repBounds(withBackoffRepsMode({ ...base, backoffRepsMode: 'increased', backoffRepOffset: 4, ...(flag === undefined ? {} : { backoffRepsOverride: flag }) }, { backoffRepsMode: 'same' }), 'backoff')).toEqual({ min: 6, max: 8 })
    }
  })

  it('executes portable repeated instances with source modes, legacy offsets and effective inherited defaults', () => {
    const before = useStore.getState().S
    const ex = [
      { ...base, backoffRepsOverride: true, backoffRepsMode: 'same' },
      { ...base, backoffRepsOverride: true, backoffRepsMode: 'increased' },
      { ...base, backoffRepsOverride: true, backoffRepOffset: 4 },
      { ...base, backoffRepsMode: 'increased', backoffRepOffset: 4 },
      { ...base },
    ]
    const input = createRoutineExchange({ ...before, routines: [{ id: 'overrides', name: 'Mixed Back-off rules', ex }], routineOrder: ['overrides'] })
    const checked = validateRoutineExchange(input, before)
    expect(checked.errors).toEqual([])
    useStore.getState().update(current => Object.assign(current, applyRoutineExchange(current, checked)))
    beginWorkout('overrides', 80)
    const entries = useStore.getState().S.active.entries
    expect(entries.map(e => repBounds(e.target, 'backoff'))).toEqual([{ min: 6, max: 8 }, { min: 8, max: 10 }, { min: 10, max: 12 }, { min: 6, max: 8 }, { min: 6, max: 8 }])
    expect(entries.map(e => e.sets.filter(s => s.role === 'backoff').map(s => s.r))).toEqual([[8, 8], [10, 10], [12, 12], [8, 8], [8, 8]])
    expect(entries.every(e => e.sets.every(s => !s.done))).toBe(true)
    useStore.getState().update(S => { S.backoffRepsMode = 'increased' })
    const after = useStore.getState().S
    expect(after.active.entries.map(e => e.sets.filter(s => s.role === 'backoff').map(s => s.r))).toEqual([[8, 8], [10, 10], [12, 12], [8, 8], [8, 8]])
    expect(after.workouts).toEqual(history)
    const reopened = JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(reopened.active.entries).toEqual(after.active.entries)
    expect(reopened.routines).toEqual(after.routines)
  })

  it('keeps existing unmarked profile prescriptions inherited without a storage migration', () => {
    const ex = [{ ...base }, { ...base, backoffRepsMode: 'increased', backoffRepOffset: 4 }]
    useStore.getState().update(S => { S.routines = [{ id: 'legacy', name: 'Existing legacy', ex }]; S.routineOrder = ['legacy'] })
    beginWorkout('legacy', 80)
    expect(useStore.getState().S.active.entries.map(e => e.sets.filter(s => s.role === 'backoff').map(s => s.r))).toEqual([[8, 8], [8, 8]])
    useStore.getState().update(S => { S.backoffRepsMode = 'increased' })
    expect(useStore.getState().S.active.entries.map(e => e.sets.filter(s => s.role === 'backoff').map(s => s.r))).toEqual([[10, 10], [10, 10]])
    expect(useStore.getState().S.routines[0].ex).toEqual(ex)
    expect(useStore.getState().S.workouts).toEqual(history)
  })

  it('retains visible unilateral offset semantics and leaves independent ranges unchanged', () => {
    const legacy = { ...base, side: true, reps: 16, topRepsMin: 12, topRepsMax: 16, backoffRepsOverride: true, backoffRepOffset: 8 }
    const target = withBackoffRepsMode(legacy, { backoffRepsMode: 'same' })
    expect(repBounds(target, 'backoff')).toEqual({ min: 20, max: 24 })
    expect(applyTrainingPlan([{ w: 40, r: 16 }], target, 2.5).filter(s => s.role === 'backoff').map(s => s.r)).toEqual([24, 24])
    const independent = { ...base, autoBackoffReps: false, backoffRepsMin: 10, backoffRepsMax: 13, backoffRepsOverride: true, backoffRepsMode: 'same' }
    expect(withBackoffRepsMode(independent, { backoffRepsMode: 'increased' })).toEqual(independent)
  })
})
