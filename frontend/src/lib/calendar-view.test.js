import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendarActivity, calendarActivityCount, calendarMonth } from './calendar-view.js'
import { calendarDay, calendarPeriod } from './calendar-data.js'
import { trainingStreak } from './training-plan.js'

const now = new Date('2026-09-16T12:00:00')
const workout = (id, d, routineId = null, set = { done: true, r: 8 }, patch = {}) => ({
  id, d, name: 'Synthetic calendar session', routineId,
  sessionOrigin: { type: routineId ? 'planned' : 'extra', routineId },
  entries: [{ id: 'synthetic-exercise', sets: [set] }], ...patch,
})
const fixture = () => ({
  trainingStartDate: '2026-01-01',
  trainingHistory: { trackedFrom: '2026-09-01', historicalWorkouts: 20, workoutsPerWeek: 3 },
  routines: [{ id: 'a', name: 'Synthetic A' }, { id: 'b', name: 'Synthetic B' }], week: {},
  dayPlan: { '2026-09-02': ['a', 'b'], '2026-09-03': ['a'], '2026-09-10': ['a'], '2026-09-16': ['a'], '2026-09-17': ['a'] },
  workouts: [
    workout('planned2', '2026-09-02', 'a'), workout('extra2', '2026-09-02'),
    workout('time3', '2026-09-03', 'a', { done: true, mode: 'time', sec: 30 }),
    workout('warm4', '2026-09-04', null, { done: true, warmup: true, r: 8 }),
    workout('zero5', '2026-09-05', null, { done: true, r: 0 }),
    workout('cancel6', '2026-09-06', null, undefined, { cancelled: true }),
    workout('active7', '2026-09-07', null, undefined, { active: true }),
    workout('unilateral8', '2026-09-08', null, { leftDone: true, r: 8 }),
    workout('future17', '2026-09-17', 'a'),
  ],
})
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
afterEach(() => vi.useRealTimers())

describe('calendar activity presentation counters', () => {
  it('counts actual activity dates once without reclassifying Partial or changing existing statistics', () => {
    const S = fixture()
    S.workouts.push(structuredClone(S.workouts[0]))
    const before = JSON.stringify(S), originalStats = calendarPeriod(S, now, 'month', now).stats
    const activity = calendarActivity(freeze(S), now)
    expect([...activity.dates]).toEqual(['2026-09-02', '2026-09-03', '2026-09-08'])
    expect(activity).toMatchObject({ today: '2026-09-16', trackedSince: '2026-09-01', current: 0, best: 3 })
    expect(calendarActivityCount(activity, '2026-09-01', '2026-09-30')).toBe(3)
    expect(calendarDay(S, '2026-09-02', now).status).toBe('partial')
    // Existing consistency data can contain future imported sessions. The new
    // actual-date counter follows Streak and does not rewrite those other rules.
    expect(originalStats.activeDays).toBe(4)
    expect(calendarPeriod(S, now, 'month', now).stats).toEqual(originalStats)
    expect(JSON.stringify(S)).toBe(before)
  })

  it('keeps period activity totals separate from the current streak and routine session totals', () => {
    const S = { trainingStartDate: '2026-08-31', routines: [{ id: 'a', name: 'Synthetic A' }, { id: 'b', name: 'Synthetic B' }],
      week: {}, dayPlan: { '2026-09-02': ['a', 'b'] }, workouts: [workout('aug', '2026-08-31'), workout('a', '2026-09-02', 'a'), workout('b', '2026-09-02', 'b'), workout('extra', '2026-09-02')] }
    const activity = calendarActivity(S, now)
    expect(activity.current).toBe(2)
    expect(calendarActivityCount(activity, '2026-09-01', '2026-09-30')).toBe(1)
    expect(calendarPeriod(S, now, 'month', now).stats.completed).toBe(2)
  })

  it('includes both endpoints and returns zero for empty or reversed periods', () => {
    const activity = calendarActivity(fixture(), now)
    expect(calendarActivityCount(activity, '2026-09-02', '2026-09-03')).toBe(2)
    expect(calendarActivityCount(activity, '2026-09-03', '2026-09-03')).toBe(1)
    expect(calendarActivityCount(activity, '2026-09-04', '2026-09-07')).toBe(0)
    expect(calendarActivityCount(activity, '2026-09-08', '2026-09-02')).toBe(0)
  })

  it('preserves neutral rest/pauses and pending today without adding them to activity', () => {
    const S = { trainingStartDate: '2026-09-01', routines: [{ id: 'a', name: 'Synthetic A' }], week: {},
      dayPlan: { '2026-09-16': ['a'] }, trainingPauses: [{ start: '2026-09-03', end: '2026-09-14' }],
      workouts: [workout('first', '2026-09-01'), workout('second', '2026-09-02')] }
    const activity = calendarActivity(S, now)
    expect(activity).toMatchObject({ current: 2, best: 2 })
    expect(calendarActivityCount(activity, '2026-09-01', '2026-09-30')).toBe(2)
    expect(calendarActivityCount(activity, '2026-09-03', '2026-09-16')).toBe(0)
  })

  it('does not turn historical estimates, invalid records or current active work into dated activity', () => {
    const S = { ...fixture(), trainingHistory: { trackedFrom: '2026-09-15', historicalWorkouts: 200, workoutsPerWeek: 3 },
      active: { id: 'same-active' }, workouts: [
        workout('invalid', '2026-02-30'), workout('not-a-date', 'not-a-date'),
        workout('before-start', '2025-12-31'), workout('same-active', '2026-09-15'),
        workout('cancelled-status', '2026-09-15', null, undefined, { status: 'cancelled' }),
        workout('cancelled-finish', '2026-09-15', null, undefined, { finishReason: 'canceled' }),
      ] }
    const activity = calendarActivity(S, now)
    expect([...activity.dates]).toEqual([])
    expect(activity).toMatchObject({ current: 0, best: 0 })
  })

  it('uses the effective tracking boundary and leaves historical training-start estimates intact', () => {
    const S = { ...fixture(), trainingHistory: { trackedFrom: '2026-09-15', historicalWorkouts: 200, workoutsPerWeek: 3 } }
    const before = JSON.stringify(S)
    expect(calendarActivity(S, now).trackedSince).toBe('2026-09-02')
    expect(S.trainingStartDate).toBe('2026-01-01')
    expect(JSON.stringify(S)).toBe(before)
  })

  it('uses the supplied clock for all counters and starts a new user at zero', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T12:00:00'))
    const supplied = new Date(now), S = fixture(), activity = calendarActivity(S, supplied)
    expect(activity.today).toBe('2026-09-16')
    expect(activity.dates.has('2026-09-17')).toBe(false)
    expect(+supplied).toBe(+now)
    expect(calendarActivity({}, supplied)).toEqual({ today: '2026-09-16', trackedSince: '2026-09-16', current: 0, best: 0, dates: new Set() })
    const nextDay = calendarActivity(S, new Date('2026-09-17T12:00:00'))
    expect(nextDay.dates.has('2026-09-17')).toBe(true)
    expect(activity.dates.has('2026-09-17')).toBe(false)
  })

  it('retains the authoritative streak values across serialized reopen', () => {
    const S = fixture(), activity = calendarActivity(S, now), reopened = JSON.parse(JSON.stringify(S))
    expect(calendarActivity(reopened, now)).toEqual(activity)
    expect(activity.current).toBe(trainingStreak(S, now).current)
    expect(activity.best).toBe(trainingStreak(S, now).best)
  })
})

describe('shared local calendar month geometry', () => {
  it.each([[2024, 366, 29], [2026, 365, 28], [2000, 366, 29], [2100, 365, 28]])('contains each date once in year %i', (year, total, february) => {
    const months = Array.from({ length: 12 }, (_, month) => calendarMonth(year, month))
    const dates = months.flatMap(month => month.days)
    expect(dates).toHaveLength(total)
    expect(new Set(dates).size).toBe(total)
    expect(dates[0]).toBe(`${year}-01-01`); expect(dates.at(-1)).toBe(`${year}-12-31`)
    expect(months[1].days).toHaveLength(february)
    for (let i = 0; i < 12; i++) {
      expect(months[i].start).toBe(months[i].days[0]); expect(months[i].end).toBe(months[i].days.at(-1))
      expect(months[i].days.every(day => day.startsWith(`${year}-${String(i + 1).padStart(2, '0')}-`))).toBe(true)
    }
  })
  it('uses Monday-first offsets for Monday, Thursday and Sunday starts', () => {
    expect(calendarMonth(2024, 0).offset).toBe(0)
    expect(calendarMonth(2024, 1).offset).toBe(3)
    expect(calendarMonth(2026, 1).offset).toBe(6)
  })
})

const helperModule = new URL('./calendar-view.js', import.meta.url).href
function inTimezone(timezone, instant, workouts, month = 9) {
  const script = `import { calendarActivity, calendarActivityCount, calendarMonth } from ${JSON.stringify(helperModule)};
    const S = ${JSON.stringify({ trainingStartDate: '2026-01-01', routines: [], week: {}, workouts })};
    const before = JSON.stringify(S), activity = calendarActivity(S, new Date(${JSON.stringify(instant)}));
    const month = calendarMonth(2026, ${month});
    console.log(JSON.stringify({today:activity.today,dates:[...activity.dates],count:calendarActivityCount(activity,month.start,month.end),month,preserved:JSON.stringify(S)===before}));`
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: timezone }, encoding: 'utf8', timeout: 10000 }))
}
describe('calendar presentation follows local dates across timezones', () => {
  it.each([['America/Santo_Domingo', '2026-10-19', 1], ['Europe/Zurich', '2026-10-20', 2]])('uses local today in %s without counting a local future date', (timezone, today, count) => {
    const actual = inTimezone(timezone, '2026-10-20T02:00:00Z', [workout('day19', '2026-10-19'), workout('day20', '2026-10-20')])
    expect(actual).toMatchObject({ today, count, preserved: true })
    expect(actual.month.days).toHaveLength(31)
    expect(actual.month.days[0]).toBe('2026-10-01'); expect(actual.month.days.at(-1)).toBe('2026-10-31')
  })
  it.each([[2, '2026-03-10T16:00:00Z', ['2026-03-07', '2026-03-08', '2026-03-09'], 31], [10, '2026-11-03T17:00:00Z', ['2026-10-31', '2026-11-01', '2026-11-02'], 30]])('does not lose or duplicate dates around New York DST in month %i', (month, instant, dates, length) => {
    const actual = inTimezone('America/New_York', instant, dates.map((date, index) => workout(`dst${index}`, date)), month)
    expect(actual.dates).toEqual(dates)
    expect(actual.month.days).toHaveLength(length); expect(new Set(actual.month.days).size).toBe(length)
    expect(actual.preserved).toBe(true)
    expect(actual.count).toBe(month === 2 ? 3 : 2)
  })
})
