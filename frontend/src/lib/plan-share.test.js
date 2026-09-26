import { describe, expect, it } from 'vitest'
import { buildPlanBundle, parsePlan, mergePlan } from './plan-share.js'
import { planActivity, createActivityWorkout } from './activities.js'
import { dailyPlan } from './daily-plan.js'
import { isoOf } from './format.js'

// There was no test file for plan sharing at all, which is how a whole prescription field
// went missing without anyone noticing.
const stateWith = ex => ({
  routines: [{ id: 'r1', name: 'Push', ex: [{ id: '0025', sets: 3, reps: 5, weight: 100, ...ex }] }],
  week: {}, customEx: [],
})
const roundTrip = ex => parsePlan(JSON.stringify(buildPlanBundle(stateWith(ex), 'Plan'))).routines[0].ex[0]

describe('what survives a shared plan', () => {
  it('carries a drop-set prescription', () => {
    expect(roundTrip({ intensifier: { type: 'dropset', count: 2, pct: 20 } }).intensifier)
      .toEqual({ type: 'dropset', count: 2, pct: 20 })
  })

  it('carries a rest-pause prescription', () => {
    expect(roundTrip({ intensifier: { type: 'restpause', totalReps: 12, restSec: 15 } }).intensifier)
      .toEqual({ type: 'restpause', totalReps: 12, restSec: 15 })
  })

  it('carries planned warm-ups', () => {
    expect(roundTrip({ warmupSets: 3 }).warmupSets).toBe(3)
  })
  it('carries advanced exercise rest settings', () => {
    expect(roundTrip({ restSec: 75, afterRestSec: 150, warmupRestSec: 30, setRestSec: [45, 60, 90] }))
      .toMatchObject({ restSec: 75, afterRestSec: 150, warmupRestSec: 30, setRestSec: [45, 60, 90] })
  })

  it('drops an intensifier it does not recognise rather than passing it on', () => {
    expect(roundTrip({ intensifier: { type: 'nonsense', count: 3 } }).intensifier).toBeUndefined()
  })

  it('clamps a hand-edited warm-up count instead of showing it verbatim', () => {
    const bundle = { opengym_plan: 1, name: 'x', routines: [{ id: 'r', name: 'R', ex: [{ id: '0025', sets: 3, reps: 5, warmupSets: 999 }] }], week: {}, customEx: [] }
    expect(parsePlan(bundle).routines[0].ex[0].warmupSets).toBe(5)
  })

  // The floors are the config sheet's own (count >= 1, pct >= 5); a value that is present but
  // out of range is pulled up to the floor, while a missing one falls back to the default.
  it('clamps out-of-range intensifier numbers to the floors the app enforces', () => {
    const bundle = { opengym_plan: 1, name: 'x', routines: [{ id: 'r', name: 'R', ex: [{ id: '0025', sets: 3, reps: 5, intensifier: { type: 'dropset', count: 0, pct: -5 } }] }], week: {}, customEx: [] }
    expect(parsePlan(bundle).routines[0].ex[0].intensifier).toEqual({ type: 'dropset', count: 1, pct: 5 })
  })

  it('falls back to the default drop percentage when the file omits it', () => {
    const bundle = { opengym_plan: 1, name: 'x', routines: [{ id: 'r', name: 'R', ex: [{ id: '0025', sets: 3, reps: 5, intensifier: { type: 'dropset' } }] }], week: {}, customEx: [] }
    expect(parsePlan(bundle).routines[0].ex[0].intensifier).toEqual({ type: 'dropset', count: 1, pct: 20 })
  })
})

it('preserves per-side targets without doubling prescribed repetitions',()=>{expect(roundTrip({side:true,repsPerSide:true,reps:10})).toMatchObject({side:true,repsPerSide:true,reps:10})})

it('shared activity routines still complete their daily assignment after ID remapping', () => {
  const now = new Date(isoOf(new Date()) + 'T12:00:00'), start = +now - 60000, date = isoOf(now)
  const source = { routines: [], customEx: [], workouts: [], week: {}, dayPlan: {} }
  planActivity(source, { type: 'running', minutes: 1, weekdays: [now.getDay()] }, now)
  const target = { routines: [], customEx: [], workouts: [], week: {}, dayPlan: {}, unit: 'kg' }
  mergePlan(target, parsePlan(JSON.stringify(buildPlanBundle(source))), { schedule: true })
  expect(target.routines[0].ex[0]).toMatchObject({ activityType: 'running', mode: 'cardio' })
  target.workouts.push(createActivityWorkout(target, { type: 'running', start, minutes: 1 }, +now))
  expect(dailyPlan(target, date)).toMatchObject({ completed: 1, extra: 0 })
})
