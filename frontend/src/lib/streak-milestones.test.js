import { describe, expect, it } from 'vitest'
import { dayISO, dayNumber } from './training-pause.js'
import { trainingStreak } from './training-plan.js'
import { STREAK_CONFIG, evaluateStreakMilestones, isCurrentStreakMilestone,
  normalizeStreakMilestoneLedger, streakMilestonesThrough, streakPeriod } from './streak-milestones.js'

// Entirely synthetic records, using the existing activity and calendar rules.
const start = '2026-01-01'
const dateAt = n => dayISO(dayNumber(start) + n)
const nowAt = n => new Date(dateAt(n) + 'T12:00:00')
const workout = (id, d, patch = {}) => ({ id, d, sessionOrigin: { type: 'extra', routineId: null },
  entries: [{ id: 'synthetic-exercise', sets: [{ done: true, r: 8 }] }], ...patch })
const stateFor = (n, patch = {}) => ({ trainingStartDate: start, routines: [], week: {}, dayPlan: {},
  workouts: Array.from({ length: n }, (_, i) => workout('synthetic-' + i, dateAt(i))), ...patch })
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const observe = (state, n, options = {}) => {
  const result = evaluateStreakMilestones(trainingStreak(state, nowAt(n)), state, { now: nowAt(n), ...options })
  return { ...state, streakMilestoneLedger: result.ledger }
}
const finish = (beforeState, d, id, options = {}) => {
  const n = dayNumber(d) - dayNumber(start), now = options.now || nowAt(n)
  const afterState = { ...beforeState, active: null, workouts: [...beforeState.workouts, workout(id, d)] }
  const beforeStreak = trainingStreak(beforeState, now), afterStreak = trainingStreak(afterState, now)
  const result = evaluateStreakMilestones(afterStreak, afterState, {
    explicitCompletion: true, completedWorkoutId: id, beforeState, beforeStreak, now, ...options,
  })
  return { ...result, beforeState, beforeStreak, afterStreak,
    state: { ...afterState, streakMilestoneLedger: result.ledger } }
}

describe('central activity-day equivalents and weekly milestones', () => {
  it('uses seven activity dates per week and thirty per month', () => {
    expect(STREAK_CONFIG).toEqual({ daysPerWeek: 7, daysPerMonth: 30, firstMilestoneWeeks: 2, milestoneMultiplier: 2 })
    expect(streakPeriod(6)).toEqual({ unit: 'day', value: 6, remainder: 0, days: 6 })
    expect(streakPeriod(7)).toEqual({ unit: 'week', value: 1, remainder: 0, days: 7 })
    expect(streakPeriod(29)).toEqual({ unit: 'week', value: 4, remainder: 1, days: 29 })
    expect(streakPeriod(30)).toEqual({ unit: 'month', value: 1, remainder: 0, days: 30 })
    expect(streakPeriod(65)).toEqual({ unit: 'month', value: 2, remainder: 5, days: 65 })
  })

  it('doubles week milestones beyond the original finite list', () => {
    expect(streakMilestonesThrough(13)).toEqual([])
    expect(streakMilestonesThrough(900)).toEqual([
      { weeks: 2, days: 14 }, { weeks: 4, days: 28 }, { weeks: 8, days: 56 },
      { weeks: 16, days: 112 }, { weeks: 32, days: 224 }, { weeks: 64, days: 448 }, { weeks: 128, days: 896 },
    ])
    expect(streakMilestonesThrough(Number.MAX_SAFE_INTEGER).at(-1).days).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER)
  })

  it.each([-1, 1.5, Infinity, NaN, '14', null])('rejects a non-counter value %s', value => {
    expect(streakMilestonesThrough(value)).toEqual([])
    expect(streakPeriod(value)).toEqual({ unit: 'day', value: 0, remainder: 0, days: 0 })
  })
})

describe('explicit Finish claims only the highest pending milestone', () => {
  it.each([14, 28, 56, 112, 224, 448])('presents threshold %s only at its boundary, never immediately before or after', threshold => {
    const baseline = observe(stateFor(threshold - 2), threshold - 2)
    baseline.streakMilestoneLedger.episodes[0].consumedThrough = threshold === 14 ? 0 : threshold / 2
    const before = finish(baseline, dateAt(threshold - 2), 'boundary-before-' + threshold)
    expect(before.afterStreak.current).toBe(threshold - 1)
    expect(before.claim).toBeNull()
    const at = finish(before.state, dateAt(threshold - 1), 'boundary-at-' + threshold)
    expect(at.claim).toMatchObject({ days: threshold, weeks: threshold / STREAK_CONFIG.daysPerWeek,
      nextWeeks: threshold / STREAK_CONFIG.daysPerWeek * STREAK_CONFIG.milestoneMultiplier })
    expect(isCurrentStreakMilestone(at.claim, at.afterStreak, at.state, nowAt(threshold - 1))).toBe(true)
    const after = finish(at.state, dateAt(threshold), 'boundary-after-' + threshold)
    expect(after.afterStreak.current).toBe(threshold + 1)
    expect(after.claim).toBeNull()
  })

  it('claims two weeks on the fourteenth distinct activity date', () => {
    const result = finish(stateFor(13), dateAt(13), 'explicit-fourteenth')
    expect(result.afterStreak.current).toBe(14)
    expect(result.claim).toMatchObject({ workoutId: 'explicit-fourteenth', weeks: 2, days: 14, nextWeeks: 4 })
    expect(result.ledger.episodes).toHaveLength(1)
    expect(result.ledger.episodes[0]).toMatchObject({ consumedThrough: 14, observedCount: 14 })
    expect(isCurrentStreakMilestone(result.claim, result.afterStreak, result.state, nowAt(13))).toBe(true)
  })

  it('acknowledges lower pending milestones when an old profile is first saved above several thresholds', () => {
    const old = observe(stateFor(86, { streakCelebrations: [7, 14, 30, 50] }), 86)
    expect(old.streakMilestoneLedger.episodes[0].consumedThrough).toBe(0)
    const result = finish(old, dateAt(86), 'legacy-first-finish')
    expect(result.claim).toMatchObject({ weeks: 8, days: 56, nextWeeks: 16 })
    expect(result.state.streakCelebrations).toEqual([7, 14, 30, 50])
    expect(result.ledger.episodes[0].consumedThrough).toBe(56)
    const next = finish(result.state, dateAt(87), 'legacy-next-finish')
    expect(next.claim).toBeNull()
    expect(next.ledger.episodes[0].consumedThrough).toBe(56)
  })

  it('requires an explicit valid save with both before snapshots, rather than exact threshold equality alone', () => {
    const S = stateFor(14), streak = trainingStreak(S, nowAt(13))
    for (const options of [{}, { explicitCompletion: true }, { explicitCompletion: true, completedWorkoutId: 'synthetic-13' }]) {
      expect(evaluateStreakMilestones(streak, S, { now: nowAt(13), ...options }).claim).toBeNull()
    }
    const pending = observe(stateFor(14), 14)
    expect(finish(pending, dateAt(14), 'fifteenth').claim).toMatchObject({ days: 14 })
  })

  it('never repeats a claimed save after serialization, even if its old before snapshot is replayed', () => {
    const result = finish(stateFor(13), dateAt(13), 'saved-once')
    const reopened = JSON.parse(JSON.stringify(result.state))
    const repeated = evaluateStreakMilestones(trainingStreak(reopened, nowAt(13)), reopened, {
      now: nowAt(13), explicitCompletion: true, completedWorkoutId: 'saved-once',
      beforeState: result.beforeState, beforeStreak: result.beforeStreak,
    })
    expect(repeated.claim).toBeNull()
    expect(repeated.ledger.episodes[0].consumedThrough).toBe(14)
  })

  it('does not celebrate a second session on the same date or a duplicate record', () => {
    const pending = observe(stateFor(14), 13)
    const sameDay = finish(pending, dateAt(13), 'second-same-date')
    expect(sameDay.afterStreak.current).toBe(14)
    expect(sameDay.claim).toBeNull()
    const duplicate = finish(pending, dateAt(14), 'synthetic-13')
    expect(duplicate.afterStreak.current).toBe(14)
    expect(duplicate.claim).toBeNull()
    expect(finish(sameDay.state, dateAt(14), 'next-activity-date').claim).toMatchObject({ days: 14 })
  })

  it('preserves the identity of legacy numeric workout IDs alongside distinct string IDs', () => {
    const before = stateFor(13)
    before.workouts[12].id = 13
    const result = finish(before, dateAt(13), '13')
    expect(result.afterStreak.current).toBe(14)
    expect(result.claim).toMatchObject({ workoutId: '13', days: 14 })
    expect(result.ledger.episodes[0].workoutIds).toContain(13)
    expect(result.ledger.episodes[0].workoutIds).toContain('13')
  })

  it.each([0, 42])('can claim a valid legacy numeric workout ID %s without changing its type', id => {
    const result = finish(stateFor(13), dateAt(13), id)
    expect(result.claim).toMatchObject({ workoutId: id, days: 14 })
    expect(isCurrentStreakMilestone(result.claim, result.afterStreak, result.state, nowAt(13))).toBe(true)
  })

  it.each([undefined, null, ''])('does not claim an unidentifiable save ID %s', id => {
    expect(finish(stateFor(13), dateAt(13), id).claim).toBeNull()
  })

  it('observes silent automatic/recovery saves without burning their unseen milestone', () => {
    const before = observe(stateFor(13), 13)
    const silent = finish(before, dateAt(13), 'silent-fourteenth', { silent: true })
    expect(silent.claim).toBeNull()
    expect(silent.ledger.episodes[0]).toMatchObject({ consumedThrough: 0, observedCount: 14 })
    expect(finish(silent.state, dateAt(14), 'explicit-fifteenth').claim).toMatchObject({ days: 14, weeks: 2 })
  })

  it('preserves a silent pending milestone through a small history edit that crosses no new threshold', () => {
    const silent = finish(observe(stateFor(13), 13), dateAt(13), 'silent-fourteenth', { silent: true })
    const edited = { ...silent.state, workouts: [...silent.state.workouts, workout('history-edit', dateAt(14))] }
    expect(finish(edited, dateAt(15), 'explicit-sixteenth').claim).toMatchObject({ days: 14, weeks: 2 })
  })

  it('preserves a silent pending milestone when old records are deleted and then restored', () => {
    const silent = finish(observe(stateFor(13), 13), dateAt(13), 'silent-fourteenth', { silent: true })
    const deleted = observe({ ...silent.state, workouts: silent.state.workouts.slice(1) }, 13)
    expect(deleted.streakMilestoneLedger.episodes[0].observedCount).toBe(14)
    const restored = { ...deleted, workouts: silent.state.workouts }
    expect(finish(restored, dateAt(14), 'explicit-fifteenth').claim).toMatchObject({ days: 14, weeks: 2 })
  })

  it('can count a valid overnight Finish that repairs yesterday while preserving its recorded start date', () => {
    const schedule = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, ['synthetic-routine']]))
    const before = stateFor(13, { routines: [{ id: 'synthetic-routine' }], week: schedule })
    const result = finish(before, dateAt(13), 'overnight', { now: nowAt(14) })
    expect(result.beforeStreak.current).toBe(0)
    expect(result.afterStreak.current).toBe(14)
    expect(result.claim).toMatchObject({ days: 14 })
  })
})

describe('episode identity survives edits and deletion, and resets only across actual missed days', () => {
  it('absorbs earlier history-edit inflation before a later genuine Finish', () => {
    const old = observe(stateFor(13), 13)
    const edited = { ...old, workouts: stateFor(28).workouts }
    const result = finish(edited, dateAt(28), 'after-edit')
    expect(result.afterStreak.current).toBe(29)
    expect(result.claim).toBeNull()
    expect(result.ledger.episodes[0]).toMatchObject({ consumedThrough: 28, observedCount: 29 })
  })

  it('does not claim when a history edit itself crosses a threshold', () => {
    const old = observe(stateFor(13), 13)
    const edited = { ...old, workouts: stateFor(14).workouts }
    const result = evaluateStreakMilestones(trainingStreak(edited, nowAt(13)), edited, { now: nowAt(13) })
    expect(result.claim).toBeNull()
    expect(result.ledger.episodes[0].consumedThrough).toBe(14)
  })

  it('retains the claimed episode after the earliest anchor is deleted', () => {
    const first = finish(stateFor(13), dateAt(13), 'original-fourteenth')
    const edited = { ...first.state, workouts: first.state.workouts.slice(1) }
    const next = finish(edited, dateAt(14), 'replacement-activity')
    expect(next.afterStreak.current).toBe(14)
    expect(next.claim).toBeNull()
    expect(next.episodeId).toBe(first.episodeId)
    expect(next.ledger.episodes[0].dates).toContain(start)
    expect(next.ledger.episodes[0].workoutIds).toContain('synthetic-0')
  })

  it('does not invent a new episode if all old anchors are deleted without a missed scheduled day', () => {
    const first = finish(stateFor(13), dateAt(13), 'original-fourteenth')
    const rebuilt = { ...first.state, workouts: [] }
    const later = finish(rebuilt, dateAt(30), 'new-after-deletion')
    expect(later.episodeId).toBe(first.episodeId)
    const replenished = { ...later.state, workouts: Array.from({ length: 13 }, (_, i) => workout('replacement-' + i, dateAt(30 + i))) }
    const next = finish(replenished, dateAt(43), 'replacement-fourteenth')
    expect(next.afterStreak.current).toBe(14)
    expect(next.claim).toBeNull()
    expect(next.episodeId).toBe(first.episodeId)
  })

  it('allows a new run after an actual missed day to celebrate the same milestone again', () => {
    const schedule = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, ['synthetic-routine']]))
    const first = finish(stateFor(13, { routines: [{ id: 'synthetic-routine' }], week: schedule }), dateAt(13), 'first-run-fourteenth')
    const secondBefore = { ...first.state, workouts: [...first.state.workouts,
      ...Array.from({ length: 13 }, (_, i) => workout('second-run-' + i, dateAt(15 + i)))] }
    const second = finish(secondBefore, dateAt(28), 'second-run-fourteenth')
    expect(second.afterStreak.current).toBe(14)
    expect(second.claim).toMatchObject({ days: 14, weeks: 2 })
    expect(second.episodeId).not.toBe(first.episodeId)
    expect(second.ledger.episodes).toHaveLength(2)
    expect(isCurrentStreakMilestone(first.claim, second.afterStreak, second.state, nowAt(28))).toBe(false)
    expect(isCurrentStreakMilestone(second.claim, second.afterStreak, second.state, nowAt(28))).toBe(true)
  })

  it('merges the consumption of previously separate episodes when an edit removes their missed-day boundary', () => {
    const schedule = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, ['synthetic-routine']]))
    const first = finish(stateFor(13, { routines: [{ id: 'synthetic-routine' }], week: schedule }), dateAt(13), 'first-run-fourteenth')
    const secondBefore = { ...first.state, workouts: [...first.state.workouts,
      ...Array.from({ length: 13 }, (_, i) => workout('second-run-' + i, dateAt(15 + i)))] }
    const second = finish(secondBefore, dateAt(28), 'second-run-fourteenth')
    const edited = { ...second.state, workouts: [...second.state.workouts, workout('backfilled-miss', dateAt(14))] }
    const result = finish(edited, dateAt(29), 'after-merged-history')
    expect(result.afterStreak.current).toBe(30)
    expect(result.claim).toBeNull()
    expect(result.ledger.episodes).toHaveLength(1)
    expect(result.ledger.episodes[0].consumedThrough).toBe(28)
  })

  it('keeps rest gaps and training pauses in the same episode', () => {
    const first = finish(stateFor(13), dateAt(13), 'original-fourteenth')
    const paused = { ...first.state, routines: [{ id: 'synthetic-routine' }], week: { 1: ['synthetic-routine'] },
      trainingPauses: [{ start: dateAt(14), end: dateAt(60) }] }
    const resumed = finish(paused, dateAt(60), 'after-pause')
    expect(resumed.afterStreak.current).toBe(15)
    expect(resumed.episodeId).toBe(first.episodeId)
    expect(resumed.claim).toBeNull()
  })
})

describe('live claim guards, input validation and pure calculation', () => {
  it('hides an old open claim when its recorded workout disappears or current count drops', () => {
    const result = finish(stateFor(13), dateAt(13), 'original-fourteenth')
    const deleted = { ...result.state, workouts: result.state.workouts.filter(w => w.id !== result.claim.workoutId) }
    expect(isCurrentStreakMilestone(result.claim, trainingStreak(deleted, nowAt(13)), deleted, nowAt(13))).toBe(false)
    const shortened = { ...result.state, trainingStartDate: dateAt(5) }
    expect(isCurrentStreakMilestone(result.claim, trainingStreak(shortened, nowAt(13)), shortened, nowAt(13))).toBe(false)
  })

  it('hides an old lower claim after a higher milestone is consumed by history reconciliation', () => {
    const first = finish(stateFor(13), dateAt(13), 'original-fourteenth')
    const edited = { ...first.state, workouts: [...first.state.workouts, ...stateFor(28).workouts.slice(14)] }
    expect(isCurrentStreakMilestone(first.claim, trainingStreak(edited, nowAt(27)), edited, nowAt(27))).toBe(false)
  })

  it.each([
    ['warmup-only', { entries: [{ sets: [{ done: true, r: 8, warmup: true }] }] }],
    ['empty', { entries: [] }],
    ['zero-rep', { entries: [{ sets: [{ done: true, r: 0 }] }] }],
    ['cancelled', { cancelled: true }],
    ['active', { active: true }],
    ['unconfirmed', { entries: [{ sets: [{ done: false, r: 8 }] }] }],
  ])('never claims from an invalid %s session', (_label, patch) => {
    const before = stateFor(13), after = { ...before, workouts: [...before.workouts, workout('invalid', dateAt(13), patch)] }
    const result = evaluateStreakMilestones(trainingStreak(after, nowAt(13)), after, {
      now: nowAt(13), explicitCompletion: true, completedWorkoutId: 'invalid', beforeState: before,
      beforeStreak: trainingStreak(before, nowAt(13)),
    })
    expect(result.claim).toBeNull()
  })

  it('rejects stale/mismatching derived streak counts and future records', () => {
    const before = stateFor(13), after = { ...before, workouts: [...before.workouts, workout('future', dateAt(14))] }
    const result = evaluateStreakMilestones({ ...trainingStreak(after, nowAt(13)), current: 14 }, after, {
      now: nowAt(13), explicitCompletion: true, completedWorkoutId: 'future', beforeState: before,
      beforeStreak: trainingStreak(before, nowAt(13)),
    })
    expect(result.claim).toBeNull()
  })

  it('normalizes malformed portable ledger rows without reinterpreting legacy numeric celebrations', () => {
    expect(normalizeStreakMilestoneLedger([7, 14, 30])).toEqual({ version: 1, episodes: [] })
    const raw = freeze({ version: 1, episodes: [null, { id: 'bad', from: '2026-02-30', through: start },
      { id: 'same', dates: [start, start, 'bad'], workoutIds: ['id', 'id', null], consumedThrough: 29, observedCount: 29 },
      { id: 'same', from: dateAt(1), through: dateAt(2), workoutIds: ['new'], consumedThrough: 56, observedCount: 56 }] })
    const before = JSON.stringify(raw), result = normalizeStreakMilestoneLedger(raw)
    expect(result.episodes).toEqual([{ id: 'same', from: start, through: dateAt(2), dates: [start],
      workoutIds: ['id', 'new'], consumedThrough: 56, observedCount: 56 }])
    expect(JSON.stringify(raw)).toBe(before)
  })

  it('does not mutate frozen before/after states, metrics or caller options', () => {
    const before = freeze(observe(stateFor(13), 13))
    const after = freeze({ ...before, workouts: [...before.workouts, workout('new-fourteenth', dateAt(13))] })
    const options = freeze({ now: nowAt(13), explicitCompletion: true, completedWorkoutId: 'new-fourteenth',
      beforeState: before, beforeStreak: trainingStreak(before, nowAt(13)) })
    const streak = freeze(trainingStreak(after, nowAt(13)))
    const serialized = JSON.stringify({ before, after, options, streak })
    expect(evaluateStreakMilestones(streak, after, options).claim).toMatchObject({ days: 14 })
    expect(JSON.stringify({ before, after, options, streak })).toBe(serialized)
  })
})
