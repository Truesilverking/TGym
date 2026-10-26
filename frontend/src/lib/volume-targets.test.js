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
