import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { consistencyStats } from './consistency.js'
import { dailyPlan } from './daily-plan.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { trainingStreak } from './training-plan.js'

// Synthetic regression data only. These dates do not represent a user's history.
const now = new Date('2026-10-03T12:00:00')
const row = (patch = {}) => ({ done: true, r: 8, w: 0, ...patch })
const session = (id, d, planned = false) => ({
  id, d, name: planned ? 'Synthetic routine' : 'Synthetic extra',
  routineId: planned ? 'synthetic-r' : null,
  sessionOrigin: { type: planned ? 'planned' : 'extra', routineId: planned ? 'synthetic-r' : null },
  entries: [{ id: 'synthetic-exercise', target: { mode: 'reps' }, sets: [row()] }],
})
const fixture = () => ({
  routines: [{ id: 'synthetic-r', name: 'Synthetic routine' }],
  week: { 1: ['synthetic-r'], 2: ['synthetic-r'], 5: ['synthetic-r'] },
  trainingStartDate: '2026-09-28',
  trainingPauses: [{ id: 'synthetic-pause', start: '2026-10-02', end: null }],
  workouts: [
    session('planned-mon', '2026-09-28', true),
    session('planned-tue', '2026-09-29', true),
    session('extra-tue', '2026-09-29'),
    session('extra-wed', '2026-09-30'),
    session('extra-thu', '2026-10-01'),
  ],
})
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

describe('training streak uses daily activity independently of session classification', () => {
  it('counts two planned plus three extra sessions as four consecutive activity dates', () => {
    const S = fixture()
    expect(consistencyStats(S, '2026-09-28', '2026-10-03', now)).toMatchObject({
      planned: 2, completed: 2, missed: 0, extra: 3, activeDays: 4, missedDays: 0, rate: 1,
    })
    expect(dailyPlan(S, '2026-09-29')).toMatchObject({ plannedSessions: 1, extra: 1, active: true })
    expect(trainingStreak(S, now)).toMatchObject({ current: 4, best: 4, lastCompleted: '2026-10-01' })
    expect(trainingStreak(S, now).rows).toEqual([
      { iso: '2026-09-28', routineId: 'synthetic-r', status: 'completed', planned: true },
      { iso: '2026-09-29', routineId: 'synthetic-r', status: 'completed', planned: true },
      { iso: '2026-09-30', status: 'completed', planned: false },
      { iso: '2026-10-01', status: 'completed', planned: false },
    ])
  })

  it('preserves edited planned origins and raw history across calculation and serialized reopen', () => {
    const S = fixture()
    S.workouts[0].entries = ['replacement', 'added-one', 'added-two', 'added-three']
      .map(id => ({ id, sets: [row({ r: 12, w: 30, rest: 15 })] }))
    const before = JSON.stringify(S)
    const reopened = freeze(JSON.parse(before))
    expect(trainingStreak(reopened, now).current).toBe(4)
    expect(consistencyStats(reopened, '2026-09-28', '2026-10-03', now)).toMatchObject({ completed: 2, extra: 3, activeDays: 4 })
    expect(JSON.stringify(reopened)).toBe(before)
    expect(JSON.stringify(S)).toBe(before)
  })

  it('does not inflate a day when more independent extra sessions or duplicate records are present', () => {
    const S = fixture()
    S.workouts.push(session('another-extra-tue', '2026-09-29'), structuredClone(S.workouts[0]))
    expect(consistencyStats(S, '2026-09-28', '2026-10-03', now)).toMatchObject({ completed: 2, extra: 4, activeDays: 4 })
    expect(trainingStreak(S, now)).toMatchObject({ current: 4, best: 4 })
  })

  it('keeps an unplanned rest date neutral between activity dates', () => {
    const S = fixture()
    S.workouts = S.workouts.filter(w => w.d !== '2026-09-30')
    expect(trainingStreak(S, now)).toMatchObject({ current: 3, best: 3 })
    expect(trainingStreak(S, now).rows.some(r => r.iso === '2026-09-30')).toBe(false)
  })

  it('breaks on the same empty date when that date was scheduled', () => {
    const S = fixture()
    S.week[3] = ['synthetic-r']
    S.workouts = S.workouts.filter(w => w.d !== '2026-09-30')
    expect(trainingStreak(S, now)).toMatchObject({ current: 1, best: 2 })
    expect(trainingStreak(S, now).rows).toContainEqual({
      iso: '2026-09-30', routineId: 'synthetic-r', status: 'missed', planned: true,
    })
  })

  it('leaves an unfinished scheduled today pending until that day is past', () => {
    const S = fixture()
    S.trainingPauses = []
    const friday = trainingStreak(S, new Date('2026-10-02T12:00:00'))
    expect(friday.current).toBe(4)
    expect(friday.rows.at(-1)).toMatchObject({ iso: '2026-10-02', status: 'pending' })
    expect(trainingStreak(S, now)).toMatchObject({ current: 0, best: 4 })
  })

  it('applies the explicit tracking boundary without deleting older history', () => {
    const S = fixture()
    S.trainingStartDate = '2026-09-30'
    const before = JSON.stringify(S.workouts)
    expect(trainingStreak(S, now)).toMatchObject({ current: 2, best: 2 })
    expect(JSON.stringify(S.workouts)).toBe(before)
  })

  it.each([
    ['warmup-only', { entries: [{ sets: [row({ warmup: true })] }] }],
    ['zero repetitions', { entries: [{ sets: [row({ r: 0, w: 50 })] }] }],
    ['unconfirmed repetitions', { entries: [{ sets: [row({ done: false })] }] }],
    ['active flag', { active: true }],
    ['active status', { status: 'active' }],
    ['cancelled session', { cancelled: true }],
    ['empty session', { entries: [] }],
  ])('does not add an activity date for %s', (_label, patch) => {
    const S = fixture()
    S.workouts.push({ ...session('invalid-extra', '2026-10-02'), ...patch })
    expect(trainingStreak(S, now)).toMatchObject({ current: 4, best: 4 })
    expect(consistencyStats(S, '2026-09-28', '2026-10-03', now)).toMatchObject({ extra: 3, activeDays: 4 })
  })

  it('excludes a history copy of the currently active session', () => {
    const S = fixture()
    S.active = session('still-active', '2026-10-02')
    S.workouts.push(structuredClone(S.active))
    expect(trainingStreak(S, now).current).toBe(4)
    expect(trainingStreak(S, now).rows.map(r => r.iso)).not.toContain('2026-10-02')
  })

  it('retains the recorded start date when a completed session crosses midnight', () => {
    const active = {
      ...session('cross-midnight', '2026-09-30'),
      start: Date.parse('2026-09-30T23:59:00-04:00'),
    }
    const completed = buildCompletedWorkout(active, { end: Date.parse('2026-10-01T00:05:00-04:00') })
    const S = { ...fixture(), week: {}, workouts: [completed] }
    expect(completed).toMatchObject({ d: '2026-09-30', sessionOrigin: { type: 'extra', routineId: null } })
    expect(trainingStreak(S, new Date('2026-10-01T12:00:00')).rows).toEqual([
      { iso: '2026-09-30', status: 'completed', planned: false },
    ])
    expect(active.d).toBe('2026-09-30')
  })
})

const trainingModule = new URL('./training-plan.js', import.meta.url).href
const finishModule = new URL('./finish-workout.js', import.meta.url).href
const formatModule = new URL('./format.js', import.meta.url).href
const inTimezone = (timezone, S, instant) => {
  // Separate native Node processes avoid changing Date behavior in other Vitest files.
  const script = `
    import { trainingStreak } from ${JSON.stringify(trainingModule)}
    import { buildCompletedWorkout } from ${JSON.stringify(finishModule)}
    import { isoOf } from ${JSON.stringify(formatModule)}
    const S = ${JSON.stringify(S)}
    const before = JSON.stringify(S)
    const start = new Date('2026-10-01T03:59:00Z')
    const end = new Date('2026-10-01T04:05:00Z')
    const completed = buildCompletedWorkout({
      id: 'travelled-session', d: '2026-09-30', start: start.getTime(),
      sessionOrigin: { type: 'extra', routineId: null },
      entries: [{ sets: [{ done: true, r: 8 }] }],
    }, { end: end.getTime() })
    const now = new Date(${JSON.stringify(instant)})
    const streak = trainingStreak(S, now)
    console.log(JSON.stringify({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      today: isoOf(now), startCalendar: isoOf(start), finishCalendar: isoOf(end),
      recordedDate: completed.d, current: streak.current,
      rows: streak.rows.map(row => row.iso), preserved: JSON.stringify(S) === before,
    }))
  `
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: timezone }, encoding: 'utf8', timeout: 10000,
  }))
}

describe('training streak date and timezone semantics', () => {
  it.each([
    ['America/Santo_Domingo', '2026-10-02', '2026-09-30'],
    ['America/New_York', '2026-10-02', '2026-09-30'],
    ['UTC', '2026-10-03', '2026-10-01'],
    ['Asia/Tokyo', '2026-10-03', '2026-10-01'],
  ])('keeps stored workout dates stable with the device clock in %s', (timezone, today, startCalendar) => {
    expect(inTimezone(timezone, fixture(), '2026-10-03T02:00:00Z')).toMatchObject({
      timezone, today, startCalendar, finishCalendar: '2026-10-01', recordedDate: '2026-09-30',
      current: 4, rows: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'], preserved: true,
    })
  })

  it('counts calendar dates across a daylight-saving transition rather than elapsed 24-hour periods', () => {
    const S = { ...fixture(), trainingStartDate: '2026-10-30', week: {}, trainingPauses: [], workouts: [] }
    S.workouts = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']
      .map((d, i) => session('dst-extra-' + i, d))
    expect(inTimezone('America/New_York', S, '2026-11-02T17:00:00Z')).toMatchObject({
      today: '2026-11-02', current: 4,
      rows: ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'], preserved: true,
    })
  })
})
