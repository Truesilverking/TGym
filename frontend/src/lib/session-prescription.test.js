import { describe, expect, it } from 'vitest'
import { buildSessionExercise, resolveLoadProgression } from './session-prescription.js'
import { convertWeightState } from './unit-conversion.js'
import { createBackup, readBackup } from './backup.js'
import { migrateState } from './state-migrations.js'
import { insertWarmupRow, removeRowAt } from './history.js'
import { removeDropAt } from './workout-model.js'

const cfg = {
  id: '0025', mode: 'reps', sets: 3, setScheme: 'topback', topSets: 1, backoffSets: 2,
  reps: 6, repsMin: 6, topRepsMin: 6, topRepsMax: 6, backoffPct: 7,
  inc: 10, loadingStep: 10, prog: 'double', warmupSets: 1,
}
const history = () => ({
  id: 'past', d: '2026-11-12', start: 1, unit: 'lb', entries: [{ id: cfg.id, target: { ...cfg }, sets: [
    { w: 150, r: 6, role: 'top', done: true },
    { w: 140, r: 8, role: 'backoff', done: true },
    { w: 140, r: 8, role: 'backoff', done: true },
  ] }],
})
const state = () => ({ unit: 'lb', exWeights: {}, workouts: [history()], routines: [], backoffRepsMode: 'increased' })
const weights = entry => entry.sets.map(row => row.w)
const serial = value => JSON.parse(JSON.stringify(value))

describe('load progression requires an explicit per-exercise decision', () => {
  it('starts at the previous load and derives its Top, Back-off, warm-up and drops consistently', () => {
    const S = state(), before = structuredClone(S)
    const entry = buildSessionExercise(S, { ...cfg, intensifier: { type: 'dropset', count: 1, pct: 20 } })
    expect(entry.loadProgression).toMatchObject({ status: 'pending', previousWeight: 150, nextWeight: 160 })
    expect(entry.plan).toMatchObject({ kind: 'hold', weight: 150 })
    expect(weights(entry)).toEqual([70, 150, 140, 140])
    expect(entry.sets.slice(1).map(row => row.drops[0].w)).toEqual([120, 112, 112])
    expect(S).toEqual(before)
  })

  it('accepts once, updates all derived loads and leaves history and the saved routine untouched', () => {
    const S = state(), before = serial(S), entry = buildSessionExercise(S, cfg)
    const accepted = resolveLoadProgression(entry, true, 10)
    expect(weights(accepted)).toEqual([80, 160, 150, 150])
    expect(accepted.plan).toMatchObject({ kind: 'up', weight: 160 })
    expect(accepted.loadProgression.status).toBe('accepted')
    expect(resolveLoadProgression(accepted, true, 10)).toBe(accepted)
    expect(resolveLoadProgression(accepted, false, 10)).toBe(accepted)
    expect(weights(entry)).toEqual([70, 150, 140, 140])
    expect(S).toEqual(before)
  })

  it('declines once and retains the exact original rows, reps and generated extras', () => {
    const entry = buildSessionExercise(state(), cfg), before = serial(entry.sets)
    const declined = resolveLoadProgression(entry, false, 10)
    expect(declined.loadProgression.status).toBe('declined')
    expect(declined.plan).toMatchObject({ kind: 'hold', weight: 150 })
    expect(declined.sets).toEqual(before)
    expect(resolveLoadProgression(declined, true, 10)).toBe(declined)
  })

  it.each(['pending', 'accepted', 'declined'])('preserves a %s decision through serialization, backup and additive migration', status => {
    let entry = buildSessionExercise(state(), cfg)
    if (status !== 'pending') entry = resolveLoadProgression(entry, status === 'accepted', 10)
    const S = { ...state(), active: { id: 'active', start: 1000, entries: [entry] } }
    const restored = migrateState(readBackup(serial(createBackup(S))))
    expect(restored.active.entries[0]).toEqual(entry)
    expect(restored.workouts).toEqual(S.workouts)
  })

  it('preserves done, partially completed and manual rows when accepting after other interactions', () => {
    const entry = buildSessionExercise(state(), { ...cfg, topSets: 2, backoffSets: 3 })
    entry.sets[0] = { ...entry.sets[0], done: true }
    entry.sets[1] = { ...entry.sets[1], done: true, doneAt: 123 }
    entry.sets[3] = { ...entry.sets[3], leftDone: true }
    entry.sets[4] = { ...entry.sets[4], w: 125, r: 9, rir: 2, manualFields: { w: true, r: true } }
    const before = serial(entry)
    const accepted = resolveLoadProgression(entry, true, 10)
    for (const i of [0, 1, 3, 4]) expect(accepted.sets[i]).toEqual(before.sets[i])
    expect(accepted.sets[2].w).toBe(160)
    expect(accepted.sets[5].w).toBe(150)
    expect(entry).toEqual(before)
  })

  it('derives pending Back-offs from a manually kept Top load and preserves manual warm-ups', () => {
    const entry = buildSessionExercise(state(), cfg)
    entry.sets[0] = { ...entry.sets[0], w: 65, manualFields: { w: true } }
    entry.sets[1] = { ...entry.sets[1], w: 155, manualFields: { w: true } }
    expect(weights(resolveLoadProgression(entry, true, 10))).toEqual([65, 155, 140, 140])
  })

  it('reports a hold and keeps all rows when the completed Top leaves no pending automatic load to increase', () => {
    const entry = buildSessionExercise(state(), { ...cfg, reps: 8, topRepsMax: 8, topRepsMin: 6 })
    entry.sets[1] = { ...entry.sets[1], done: true, doneAt: 123 }
    const before = serial(entry.sets)
    const accepted = resolveLoadProgression(entry, true, 10)
    expect(accepted.loadProgression.status).toBe('accepted')
    expect(accepted.plan).toMatchObject({ kind: 'hold', why: ['Your logged and manually entered weights were kept.'] })
    expect(accepted.sets).toEqual(before)
  })

  it('recomputes generated drops while preserving edited drop weights', () => {
    const entry = buildSessionExercise(state(), { ...cfg, intensifier: { type: 'dropset', count: 2, pct: 20 } })
    entry.sets[2].drops[0].w = 100
    const accepted = resolveLoadProgression(entry, true, 10)
    expect(accepted.sets[1].drops.map(drop => drop.w)).toEqual([128, 102.5])
    expect(accepted.sets[2].drops[0].w).toBe(100)
    expect(accepted.sets[2].drops[1].w).toBe(80)
  })

  it.each(['insert warmup', 'remove warmup', 'remove work'])('keeps generated drops aligned after %s before consent', action => {
    const entry = buildSessionExercise(state(), { ...cfg, intensifier: { type: 'dropset', count: 2, pct: 20 } })
    if (action === 'insert warmup') entry.sets = insertWarmupRow(entry.sets, 'reps', entry.target, 10)
    else entry.sets = removeRowAt(entry.sets, action === 'remove warmup' ? 0 : 1)
    const accepted = resolveLoadProgression(serial(entry), true, 10)
    const work = accepted.sets.filter(row => row.drops)
    expect(work.every(row => row.drops[0].w === (row.role === 'top' ? 128 : 120))).toBe(true)
    expect(work.every(row => row.drops[1].w === (row.role === 'top' ? 102.5 : 96))).toBe(true)
  })

  it('keeps a generated drop aligned when an earlier drop is removed before consent', () => {
    const entry = buildSessionExercise(state(), { ...cfg, intensifier: { type: 'dropset', count: 2, pct: 20 } })
    entry.sets[1] = removeDropAt(entry.sets[1], 0)
    const accepted = resolveLoadProgression(serial(entry), true, 10)
    expect(accepted.sets[1].drops.map(drop => drop.w)).toEqual([128])
  })

  it('recomputes generated drops after unit conversion while retaining an explicit drop edit', () => {
    const S = state(); S.active = { unit: 'lb', entries: [buildSessionExercise(S, { ...cfg, intensifier: { type: 'dropset', count: 2, pct: 20 } })] }
    convertWeightState(S, 'kg')
    const entry = S.active.entries[0]
    expect(entry.sets[1].drops.map(drop => drop.w)).toEqual([54.43, 43.54])
    entry.sets[2].drops[0].w = 50
    const accepted = resolveLoadProgression(entry, true, entry.target.loadingStep)
    expect(accepted.sets[1].drops.map(drop => drop.w)).toEqual([58, 46.5])
    expect(accepted.sets[2].drops[0].w).toBe(50)
  })

  it('keeps accepted Top/Back-off reps within their explicit ranges when legacy repsMin is absent', () => {
    const target = { ...cfg }; delete target.repsMin
    const entry = buildSessionExercise(state(), target)
    expect(entry.loadProgression.prescription.reps).toBe(6)
    const accepted = resolveLoadProgression(entry, true, 10)
    expect(accepted.sets.slice(1).map(row => row.r)).toEqual([6, 8, 8])
    expect(accepted.plan.why.at(-1)).toBe(6)
  })

  it('keeps rest-pause total reps, burst breakdown and activation shape while increasing the load', () => {
    const target = { id: cfg.id, mode: 'reps', sets: 1, reps: 8, repsMin: 6, prog: 'double', inc: 10,
      intensifier: { type: 'restpause', totalReps: 20, restSec: 15 } }
    const S = state(); S.workouts[0].entries[0] = { id: cfg.id, target, sets: [{ w: 150, r: 20, done: true }] }
    const entry = buildSessionExercise(S, target)
    expect(entry.sets.map(row => row.r)).toEqual([8, 20])
    const accepted = resolveLoadProgression(entry, true, 10)
    expect(accepted.sets).toMatchObject([{ w: 160, r: 8, phase: 'warmup' }, { w: 160, r: 20, type: 'restpause' }])
    expect(accepted.sets[1].clusters).toEqual(entry.sets[1].clusters)
    expect(accepted.sets[1].clusters.reduce((sum, cluster) => sum + cluster.r, 0)).toBe(20)
    expect(accepted.plan.why).toEqual(['Every rep last time — {0} {1} more.', 10, 'lb'])
  })

  it.each(['linear', 'greyskull', 'double'])('gates %s increases for ordinary working sets', prog => {
    const target = { id: cfg.id, mode: 'reps', sets: 2, reps: 6, repsMin: 4, weight: 150, inc: 10, prog }
    const S = state(); S.workouts[0].entries[0] = { id: cfg.id, target, sets: [{ w: 150, r: 6, done: true }, { w: 150, r: 6, done: true }] }
    const entry = buildSessionExercise(S, target)
    expect(weights(entry)).toEqual([150, 150])
    const accepted = resolveLoadProgression(entry, true, 10)
    expect(weights(accepted)).toEqual([160, 160])
    expect(accepted.sets.map(row => row.r)).toEqual(prog === 'double' ? [4, 4] : [6, 6])
  })

  it('does not add a load decision to first, off, bodyweight, time, freestyle or recovery sessions', () => {
    expect(buildSessionExercise({ ...state(), workouts: [] }, cfg).loadProgression).toBeUndefined()
    expect(buildSessionExercise(state(), { ...cfg, prog: 'off' }).loadProgression).toBeUndefined()
    expect(buildSessionExercise(state(), cfg, null, { freestyle: true }).loadProgression).toBeUndefined()
    const bw = state(); bw.workouts[0].entries[0].sets.forEach(row => { row.w = 0 })
    expect(buildSessionExercise(bw, cfg).loadProgression).toBeUndefined()
    const timedCfg = { id: cfg.id, mode: 'time', sec: 30, sets: 1, prog: 'time' }
    const timed = state(); timed.workouts[0].entries[0] = { id: cfg.id, target: timedCfg, sets: [{ sec: 30, w: 0, done: true }] }
    expect(buildSessionExercise(timed, timedCfg)).toMatchObject({ plan: { kind: 'up', sec: 35 }, sets: [{ sec: 35 }] })
    expect(buildSessionExercise(timed, timedCfg).loadProgression).toBeUndefined()
    const deload = { active: true, config: { setPct: 60, loadPct: 80, targetRir: 4 } }
    expect(buildSessionExercise(state(), cfg, null, { deload })).toMatchObject({ plan: { kind: 'deload' } })
    expect(buildSessionExercise(state(), cfg, null, { deload }).loadProgression).toBeUndefined()
  })

  it('converts pending load decisions with their session and resolves using the converted load', () => {
    const S = state(); S.active = { unit: 'lb', entries: [buildSessionExercise(S, cfg)] }
    convertWeightState(S, 'kg')
    const entry = S.active.entries[0]
    expect(entry.loadProgression).toMatchObject({ previousWeight: 68.04, nextWeight: 72.57, prescription: { weight: 72.57 } })
    expect(entry.loadProgression.prescription.why).toEqual(['Top of the rep range in every set — {0} {1} more, back to {2} reps.', 4.54, 'kg', 6])
    expect(resolveLoadProgression(entry, true, entry.target.loadingStep).sets[1].w).toBe(72.57)
  })
})
