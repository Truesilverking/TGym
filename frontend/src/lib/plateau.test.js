import { it, expect } from 'vitest'
import { detectExercisePlateau } from './plateau.js'

it('does not flag plateau when there are not enough sessions', () => {
  const workouts = [
    { start: Date.now() - 5 * 86400000, entries: [{ id: 'bench', sets: [{ w: 100, r: 5, done: true }] }] },
  ]
  const result = detectExercisePlateau(workouts, 'bench')
  expect(result.isPlateau).toBe(false)
})

it.each([undefined, null, 0, '0', false])('uses the recorded workout date when legacy start is %j', start => {
  const now = Date.now()
  const workouts = [1, 2, 3].map(ago => ({ id: `legacy-${ago}`, d: new Date(now - ago * 86400000).toISOString().slice(0, 10), start,
    entries: [{ id: '0025', sets: [{ done: true, w: 40, r: 8 }] }] }))
  const before = structuredClone(workouts)
  expect(detectExercisePlateau(workouts, '0025')).toMatchObject({ sessionCount: 3, isPlateau: true })
  expect(workouts).toEqual(before)
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
  expect(detectExercisePlateau(workouts.map(w => ({ ...w, entries: [{ id: '0025', sets: [{ w: 100, r: 5, done: true }] }] })), '0025').muscle).toBe('pectorals')
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

it('uses the shared 1RM rep cap and ignores future, cancelled and duplicate sessions', () => {
  const now = Date.now()
  const session = (id, ago, extra = {}) => ({ id, start: now - ago * 86400000, entries: [{ id: 'bench', sets: [{ w: 100, r: 5, done: true }] }], ...extra })
  const a = session('a', 5)
  expect(detectExercisePlateau([a, a, session('future', -2), session('cancelled', 3, { cancelled: true })], 'bench').sessionCount).toBe(1)
  const highReps = [1, 2, 3].map(i => session('r' + i, i, { entries: [{ id: 'bench', sets: [{ w: 100, r: 30, done: true }] }] }))
  expect(detectExercisePlateau(highReps, 'bench').sessionCount).toBe(0)
  const timed = [1, 2, 3].map(i => session('t' + i, i, { entries: [{ id: 'bench', target: { mode: 'time' }, sets: [{ w: 100, r: 5, sec: 30, done: true }] }] }))
  expect(detectExercisePlateau(timed, 'bench').sessionCount).toBe(0)
  expect(detectExercisePlateau([session('iso', 5, { start: new Date(now - 5 * 86400000).toISOString() })], 'bench').sessionCount).toBe(1)
})
