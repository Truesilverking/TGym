import { expect, it } from 'vitest'
import { createBackup } from './backup.js'
import { parseTGymJson } from './json-import.js'
import { migrateState } from './state-migrations.js'
import { normalizeStreakMilestoneLedger } from './streak-milestones.js'

it('retains per-streak claims, legacy celebrations and history through portable backup and migration', () => {
  const ledger = { version: 1, episodes: [{ id: 'streak:2026-09-25:first', from: '2026-09-25', through: '2026-10-08', dates: ['2026-09-25', '2026-10-08'], workoutIds: ['first', 'last'], consumedThrough: 14, observedCount: 14 }] }
  const input = { workouts: [{ id: 'first', d: '2026-09-25', entries: [] }], routines: [], streakCelebrations: [7, 14], streakMilestoneLedger: ledger, lang: 'es', trainingStartDate: '2026-09-25', trainingHistory: { trackedFrom: '2026-09-25', historicalWorkouts: 0, workoutsPerWeek: 0 } }
  const restored = migrateState(parseTGymJson(JSON.stringify(createBackup(input))).data)
  expect(restored.streakMilestoneLedger).toEqual(ledger)
  expect(normalizeStreakMilestoneLedger(restored.streakMilestoneLedger)).toEqual(ledger)
  expect(restored.workouts).toEqual(input.workouts)
  expect(restored.streakCelebrations).toEqual([7, 14])
  expect(input.streakMilestoneLedger).toEqual(ledger)
})

it('restores an older profile without inventing previously displayed weekly milestones', () => {
  const restored = migrateState(parseTGymJson(JSON.stringify(createBackup({ workouts: [], routines: [], streakCelebrations: [7, 14, 30] }))).data)
  expect(restored.streakCelebrations).toEqual([7, 14, 30])
  expect(normalizeStreakMilestoneLedger(restored.streakMilestoneLedger)).toEqual({ version: 1, episodes: [] })
})
