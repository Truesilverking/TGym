import { it, expect } from 'vitest'
import { calculateWeeklyMuscleVolume, DEFAULT_VOLUME_TARGETS } from './volume-targets.js'

it('calculates weekly hard sets and identifies low, optimal, or excessive volume', () => {
  const now = Date.now()
  // 3 workouts of bench press (chest primary) = 3 * 4 sets = 12 sets -> optimal
  const workouts = [
    { start: now - 5 * 86400000, entries: [{ id: '0025', sets: [{ done: true }, { done: true }, { done: true }, { done: true }] }] },
    { start: now - 3 * 86400000, entries: [{ id: '0025', sets: [{ done: true }, { done: true }, { done: true }, { done: true }] }] },
    { start: now - 1 * 86400000, entries: [{ id: '0025', sets: [{ done: true }, { done: true }, { done: true }, { done: true }] }] },
  ]

  const report = calculateWeeklyMuscleVolume(workouts, { weekStartMs: now - 7 * 86400000 })
  expect(report.chest).toBeDefined()
  expect(report.chest.sets).toBe(12)
  expect(report.chest.status).toBe('optimal')
})

it('flags volume as low when below minimum target', () => {
  const now = Date.now()
  const workouts = [
    { start: now - 2 * 86400000, entries: [{ id: '0025', sets: [{ done: true }, { done: true }] }] },
  ]
  const report = calculateWeeklyMuscleVolume(workouts, { weekStartMs: now - 7 * 86400000 })
  expect(report.chest.sets).toBe(2)
  expect(report.chest.status).toBe('low')
})

it.each([undefined, null, 0, '0', false])('counts dated legacy sessions when start is %j', start => {
  const now = Date.now()
  const workouts = [{ id: 'legacy', d: new Date(now - 2 * 86400000).toISOString().slice(0, 10), start,
    entries: [{ id: '0025', sets: [{ done: true }] }] }]
  const before = structuredClone(workouts)
  expect(calculateWeeklyMuscleVolume(workouts, { weekStartMs: now - 7 * 86400000 }).chest.sets).toBe(1)
  expect(workouts).toEqual(before)
})

it('retains custom historical muscle weights and excludes duplicate, cancelled and future sessions', () => {
  const now = Date.now()
  const session = { id: 'one', start: now - 86400000, entries: [{ id: 'deleted-custom', muscleSnapshot: { muscleWeights: { chest: 1, triceps: 0.25 } }, sets: [{ done: true }, { done: true, phase: 'warmup' }] }] }
  const report = calculateWeeklyMuscleVolume([session, session, { ...session, id: 'cancelled', cancelled: true }, { ...session, id: 'future', start: now + 86400000 }])
  expect(report.chest.sets).toBe(1)
  expect(report.triceps.sets).toBe(0.3)
})

it('reports zero volume for explicitly targeted muscles that were not trained', () => {
  expect(calculateWeeklyMuscleVolume([], { targets: { quadriceps: { min: 5, max: 10 } } }).quadriceps).toMatchObject({ sets: 0, status: 'low' })
})

it('accepts ISO string timestamps for workout start', () => {
  const now = Date.now()
  const isoStart = new Date(now - 2 * 86400000).toISOString()
  const workouts = [
    { id: 'iso', start: isoStart, entries: [{ id: '0025', sets: [{ done: true }] }] },
  ]
  const report = calculateWeeklyMuscleVolume(workouts, { weekStartMs: now - 7 * 86400000 })
  expect(report.chest.sets).toBe(1)
})
