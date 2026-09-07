import { describe, expect, it } from 'vitest'
import { applyTrainingPlan, backoffRepOffsetFor, clampReps, defaultDeload, deloadStatus, deloadTargetFor, repBounds, repRangeEnabled, rirAdvice, streakTier, targetRirFor, targetRirRangeFor, trainingStreak } from './training-plan.js'

const base = { routines: [{ id: 'r', name: 'Push' }], week: { 1: 'r', 3: 'r', 5: 'r' }, dayPlan: {}, workouts: [] }
describe('trainingStreak', () => {
  it('counts scheduled sessions, ignores rest days and leaves today pending', () => {
    const S = { ...base, workouts: [
      { d: '2026-08-24', routineId: 'r' }, { d: '2026-08-26', routineId: 'r' }, { d: '2026-08-28', routineId: 'r' },
    ] }
    expect(trainingStreak(S, new Date('2026-08-31T16:00:00')).current).toBe(3)
  })
  it('breaks on a missed scheduled workout', () => {
    const S = { ...base, workouts: [{ d: '2026-08-24', routineId: 'r' }, { d: '2026-08-28', routineId: 'r' }] }
    expect(trainingStreak(S, new Date('2026-08-29T12:00:00')).current).toBe(1)
  })
  it('uses progressive flame tiers that begin in yellow', () => {
    expect(streakTier(1)).toBe('yellow')
    expect(streakTier(7)).toBe('orange')
    expect(streakTier(14)).toBe('redgold')
    expect(streakTier(100)).toBe('legend')
  })
})

describe('deloadStatus', () => {
  it('uses a clear recovery default while leaving every value configurable', () => {
    expect(defaultDeload()).toMatchObject({ normalWeeks: 6, deloadWeeks: 1, loadPct: 80, setPct: 60, targetRir: 4 })
  })
  it('marks the seventh week after six normal weeks', () => {
    const S = { deload: { on: true, startDate: '2026-01-05', normalWeeks: 6, deloadWeeks: 1 } }
    expect(deloadStatus(S, '2026-02-16').active).toBe(true)
    expect(deloadStatus(S, '2026-02-23').active).toBe(false)
  })
})

describe('training prescription helpers', () => {
  it('derives automatic Back-off reps and legacy offsets', () => {
    expect(backoffRepOffsetFor({ backoffRepOffset: 2 })).toBe(2)
    expect(backoffRepOffsetFor({ topRepsMax: 6, backoffRepsMax: 8 })).toBe(2)
    expect(backoffRepOffsetFor({ topRepsMax: 6, backoffRepsMax: 20 })).toBe(2)
    expect(repBounds({ setScheme: 'topback', topRepsMin: 4, topRepsMax: 6, backoffRepOffset: 2 }, 'backoff')).toEqual({ min: 6, max: 8 })
    const rows = applyTrainingPlan([{ w: 100, r: 6, done: false }], { setScheme: 'topback', topSets: 1, backoffSets: 2, reps: 6, backoffPct: 10, backoffRepOffset: 2 }, 2.5)
    expect(rows.map(x => [x.w, x.r])).toEqual([[100, 6], [90, 8], [90, 8]])
  })
  it('normalizes legacy and explicit RIR ranges', () => {
    expect(targetRirRangeFor({ targetRir: 2 })).toEqual({ min: 2, max: 2 })
    expect(targetRirRangeFor({ targetRirMin: 1, targetRirMax: 2 })).toEqual({ min: 1, max: 2 })
    expect(targetRirRangeFor({ topRirMin: 1, topRirMax: 2 }, 'top')).toEqual({ min: 1, max: 2 })
    expect(targetRirRangeFor({ backoffRirMin: 2, backoffRirMax: 3 }, 'backoff')).toEqual({ min: 2, max: 3 })
    expect(targetRirRangeFor({ targetRirMin: 3, targetRirMax: 2 })).toEqual({ min: 3, max: 3 })
    expect(targetRirRangeFor({ targetRirMin: -2, targetRirMax: 12 })).toEqual({ min: 0, max: 10 })
  })

  it('uses the last eligible set against its own RIR range', () => {
    const cfg = { targetRirMin: 1, targetRirMax: 2 }
    expect(rirAdvice([{ done: true, rir: 1 }], cfg).kind).toBe('maintain')
    expect(rirAdvice([{ done: true, rir: 2 }], cfg).kind).toBe('maintain')
    expect(rirAdvice([{ done: true, rir: 2.5 }], cfg).kind).toBe('increase')
    expect(rirAdvice([{ done: true, rir: 0.5 }], cfg).kind).toBe('reduce')
    expect(rirAdvice([{ done: true, rir: .5 }, { done: true, rir: 3 }, { done: true, rir: 1.5 }], cfg).kind).toBe('maintain')
    expect(rirAdvice([{ done: true, warmup: true, rir: 0 }, { done: true, rir: 1.5 }], cfg).kind).toBe('maintain')
    expect(rirAdvice([{ done: true, role: 'backoff', rir: 2.5 }], { backoffRirMin: 2, backoffRirMax: 3 }).kind).toBe('maintain')
  })
  it('creates top and back-off rows and rounds load', () => {
    const out = applyTrainingPlan([{ w: 100, r: 6, done: false }], { setScheme: 'topback', topSets: 1, backoffSets: 2, backoffPct: 10, reps: 6, backoffRepsMax: 8 }, 2.5)
    expect(out.map(s => [s.role, s.w, s.r])).toEqual([['top', 100, 6], ['backoff', 90, 8], ['backoff', 90, 8]])
  })
  it('clamps reps only when strict mode is active', () => {
    const cfg = { repsMin: 6, reps: 10 }
    expect(clampReps({ strictReps: true }, cfg, {}, 12)).toBe(10)
    expect(clampReps({ strictReps: false }, cfg, {}, 12)).toBe(12)
  })
  it('allows the repetition range to be explicitly enabled or disabled', () => {
    expect(repRangeEnabled({ repsMin: 4, reps: 6 })).toBe(true)
    expect(repRangeEnabled({ repRange: false, repsMin: 4, reps: 6 })).toBe(false)
    expect(clampReps({ strictReps: true }, { repRange: false, repsMin: 4, reps: 6 }, {}, 4)).toBe(6)
  })
  it('compares actual RIR with the configured target', () => {
    const cfg = { targetRir: 2 }
    expect(rirAdvice([{ done: true, rir: 3 }], cfg).kind).toBe('increase')
    expect(rirAdvice([{ done: true, rir: 2 }], cfg).kind).toBe('maintain')
    expect(rirAdvice([{ done: true, rir: 0 }], cfg).kind).toBe('reduce')
  })
  it('uses the last eligible rated set rather than an average', () => {
    const cfg = { targetRir: 2 }
    expect(rirAdvice([{ done: true, rir: 3 }, { done: true, rir: 2 }, { done: true, rir: 1 }], cfg).kind).toBe('reduce')
    expect(rirAdvice([{ done: true, rir: 1 }, { done: true, rir: 1 }, { done: true, rir: 3 }], cfg).kind).toBe('increase')
    expect(rirAdvice([{ done: true, rir: 1 }, { done: true, rir: 2 }], cfg).kind).toBe('maintain')
  })
  it('ignores warm-ups and unfinished ratings', () => {
    const cfg = { targetRir: 2 }
    expect(rirAdvice([{ done: true, rir: 3 }, { done: true, rir: 0, warmup: true }, { done: false, rir: 0 }], cfg).kind).toBe('increase')
  })
  it('uses the role-specific target of the last Top/Back-off set', () => {
    const cfg = { setScheme: 'topback', topRir: 1, backoffRir: 3 }
    expect(rirAdvice([{ done: true, role: 'top', rir: 1 }, { done: true, role: 'backoff', rir: 3 }], cfg).kind).toBe('maintain')
    expect(rirAdvice([{ done: true, role: 'top', rir: 1 }, { done: true, role: 'backoff', rir: 4 }], cfg).kind).toBe('increase')
  })
  it('prefers the most recently completed timestamp and falls back to array order', () => {
    const cfg = { targetRir: 2 }
    expect(rirAdvice([{ done: true, rir: 1, doneAt: 200 }, { done: true, rir: 3, doneAt: 100 }], cfg).kind).toBe('reduce')
    expect(rirAdvice([{ done: true, rir: 1 }, { done: true, rir: 3 }], cfg).kind).toBe('increase')
  })
  it('keeps both Top and Back-off work during a deload and removes intensifiers only from the session', () => {
    const cfg = { setScheme: 'topback', topSets: 2, backoffSets: 2, backoffPct: 10, reps: 6, topRir: 2, backoffRir: 3, intensifier: 'drop' }
    const deload = { active: true, config: { loadPct: 80, setPct: 50, targetRir: 4 } }
    const rows = applyTrainingPlan([{ w: 100, r: 6, done: false }], cfg, 2.5, deload)
    expect(rows.map(row => row.role)).toEqual(['top', 'backoff'])
    expect(rows.map(row => row.w)).toEqual([80, 72.5])
    const target = deloadTargetFor(cfg, deload)
    expect(target).toMatchObject({ deload: true, topRir: 4, backoffRir: 4 })
    expect(target).not.toHaveProperty('intensifier')
    expect(cfg.intensifier).toBe('drop')
  })
  it('falls back to the shared RIR target for each Top and Back-off row', () => {
    expect(targetRirFor({ targetRir: 2 }, 'top')).toBe(2)
    expect(targetRirFor({ targetRir: 2 }, 'backoff')).toBe(2)
  })
})
