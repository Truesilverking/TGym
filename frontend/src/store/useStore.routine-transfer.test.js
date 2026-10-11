// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from './useStore.js'
import { beginWorkout } from '../sheets.jsx'
import { EXIDX, registerCustom } from '../lib/exercises.js'
import { applyRoutineExchange, createRoutineExchange, validateRoutineExchange } from '../lib/routine-exchange.js'
import { dailyPlan } from '../lib/daily-plan.js'

const source = () => ({ ...structuredClone(DEF), unit: 'kg', restSec: 45, strictReps: true, backoffRepsMode: 'same', restAdvanced: { warmup: 20, supersetMove: 10, supersetRound: 150 },
  customEx: [{ id: 'shared-local', n: 'Sentadilla ágil', bp: 'upper legs', eq: 'barbell', custom: true, img: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }],
  exerciseAliases: { 'shared-local': 'Mi GIF' }, routines: [{ id: 'old-routine', name: 'Transferencia útil', ex: [{ id: 'shared-local', sets: 3, reps: 8, weight: 103, inc: 2.5, warmupSets: 1, setScheme: 'topback', topSets: 1, backoffSets: 2, backoffPct: 15, prog: 'off' }] }], routineOrder: ['old-routine'], week: { 0: ['old-routine'] }, dayPlan: {} })
const destination = () => ({ ...structuredClone(DEF), unit: 'lb', restSec: 180, strictReps: false, backoffRepsMode: 'increased',
  customEx: [{ id: 'shared-local', n: 'Otro movimiento', bp: 'chest', eq: 'machine', custom: true }], routines: [{ id: 'unrelated', name: 'Actual', ex: [{ id: 'shared-local', sets: 2, reps: 10, weight: 50 }] }], routineOrder: ['unrelated'], week: {}, dayPlan: {},
  workouts: [{ id: 'original-history', routineId: 'old-routine', sessionOrigin: { type: 'planned', routineId: 'old-routine' }, name: 'Rutina eliminada', d: '2026-10-11', start: 1000, end: 61000, entries: [{ id: 'shared-local', target: { mode: 'reps', sets: 1, reps: 10 }, sets: [{ w: 50, r: 10, done: true }] }] }] })
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z')); localStorage.clear(); useStore.setState({ user: null }); useStore.getState().replaceState(destination()) })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); registerCustom([]) })
function review() {
  const data = createRoutineExchange(source()), before = useStore.getState().S, check = validateRoutineExchange(data, before)
  expect(check.errors).toEqual([])
  const conflicts = Object.fromEntries(check.conflicts.map(item => [item.key, item.kind === 'unit' ? 'convert' : 'copy']))
  return { before, check, conflicts }
}

it('atomically saves remapped prescriptions and preserves history, other routines and globals through reopen and start', () => {
  const { before, check, conflicts } = review()
  useStore.getState().update(S => Object.assign(S, applyRoutineExchange(S, check, { conflicts, schedule: true, acceptAdaptations: true })), true, false)
  const after = useStore.getState().S, imported = after.routines.find(r => r.id !== 'unrelated')
  expect(imported.id).not.toBe('old-routine'); expect(imported.ex[0].id).not.toBe('shared-local')
  expect(after.routines[0]).toEqual(before.routines[0]); expect(after.workouts).toEqual(before.workouts)
  for (const key of ['unit', 'restSec', 'restAdvanced', 'strictReps', 'backoffRepsMode', 'effort', 'deload', 'bodyweight', 'measurements', 'exWeights']) expect(after[key]).toEqual(before[key])
  expect(after.customEx.find(ex => ex.id === 'shared-local')).toEqual(before.customEx[0])
  expect(after.customEx.find(ex => ex.id === imported.ex[0].id).img).toBe(source().customEx[0].img)
  expect(dailyPlan(after, '2026-10-11').completed).toBe(0)
  useStore.getState().replaceState(JSON.parse(localStorage.getItem('gym_state_v1')))
  beginWorkout(imported.id, 80)
  const started = useStore.getState().S, entry = started.active.entries[0]
  expect(entry.target.restSec).toBe(45); expect(entry.target.strictReps).toBe(true)
  const backoff = entry.sets.filter(row => row.role === 'backoff')
  expect(backoff.map(row => row.r)).toEqual([8, 8])
  for (const row of backoff) expect(row.w).toBeCloseTo(90 * 2.2046226218487757, 3)
  expect(entry.sets.every(row => row.done === false)).toBe(true); expect(started.workouts).toEqual(before.workouts)
  expect(started.routines).toEqual(after.routines)
})

it('leaves both the persisted state and exercise registry intact when primary storage rejects the import', () => {
  const { before, check, conflicts } = review(), disk = localStorage.getItem('gym_state_v1'), newIds = check.data.routines.flatMap(r => r.ex.map(ex => ex.id)).filter(id => id !== 'shared-local')
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
  expect(() => useStore.getState().update(S => Object.assign(S, applyRoutineExchange(S, check, { conflicts, acceptAdaptations: true })))).toThrow('QuotaExceededError')
  write.mockRestore()
  expect(useStore.getState().S).toBe(before); expect(localStorage.getItem('gym_state_v1')).toBe(disk)
  expect(EXIDX['shared-local'].n).toBe('Otro movimiento'); expect(newIds.every(id => !EXIDX[id])).toBe(true)
  useStore.getState().update(S => Object.assign(S, applyRoutineExchange(S, check, { conflicts, acceptAdaptations: true })))
  expect(useStore.getState().S.routines).toHaveLength(2)
})
