import { it, expect } from 'vitest'
import { detectExercisePlateau } from './plateau.js'

it('does not flag plateau when there are not enough sessions', () => {
  const workouts = [
    { start: Date.now() - 5 * 86400000, entries: [{ id: 'bench', sets: [{ w: 100, r: 5, done: true }] }] },
  ]
  const result = detectExercisePlateau(workouts, 'bench')
  expect(result.isPlateau).toBe(false)
})

it('detects a plateau when e1RM fails to progress across 3+ sessions over weeks', () => {
  const now = Date.now()
  const workouts = [
    { start: now - 25 * 86400000, entries: [{ id: 'bench', sets: [{ w: 100, r: 5, done: true }] }] },
    { start: now - 18 * 86400000, entries: [{ id: 'bench', sets: [{ w: 100, r: 5, done: true }] }] },
    { start: now - 10 * 86400000, entries: [{ id: 'bench', sets: [{ w: 97.5, r: 5, done: true }] }] },
    { start: now - 2 * 86400000, entries: [{ id: 'bench', sets: [{ w: 100, r: 4, done: true }] }] },
  ]
  const result = detectExercisePlateau(workouts, 'bench')
  expect(result.isPlateau).toBe(true)
  expect(result.recommendations.length).toBeGreaterThanOrEqual(2)
  expect(result.recommendations.some(r => r.type === 'deload')).toBe(true)
})

it('does not flag plateau when user is consistently progressing', () => {
  const now = Date.now()
  const workouts = [
    { start: now - 25 * 86400000, entries: [{ id: 'bench', sets: [{ w: 80, r: 5, done: true }] }] },
    { start: now - 18 * 86400000, entries: [{ id: 'bench', sets: [{ w: 85, r: 5, done: true }] }] },
    { start: now - 10 * 86400000, entries: [{ id: 'bench', sets: [{ w: 90, r: 5, done: true }] }] },
    { start: now - 2 * 86400000, entries: [{ id: 'bench', sets: [{ w: 95, r: 5, done: true }] }] },
  ]
  const result = detectExercisePlateau(workouts, 'bench')
  expect(result.isPlateau).toBe(false)
})
