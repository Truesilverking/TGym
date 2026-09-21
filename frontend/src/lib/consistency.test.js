import { describe, expect, it } from 'vitest'
import { consistencyStats, nextScheduledWorkout } from './consistency.js'
import { calendarPeriod } from './calendar-data.js'
import { routineConsistency } from './stats-insights.js'
import { isoOf } from './format.js'
const now = new Date(2026, 8, 26, 12)
const base = () => ({ routines: [{ id: 'r', name: 'Renamed' }], week: {}, dayPlan: {}, workouts: [] })

describe('shared consistency', () => {
  it('counts 20 completed, 5 missed, 10 future as 35 planned and 80%', () => {
    const S = base()
    for (let i = 1; i <= 35; i++) {
      const d = isoOf(new Date(2026, 8, i, 12)); S.dayPlan[d] = 'r'
      if (i <= 20) S.workouts.push({ id: String(i), d, routineId: 'r', name: 'Old name' })
    }
    expect(consistencyStats(S, '2026-09-01', '2026-10-05', now)).toEqual({ planned: 35, completed: 20, missed: 5, pending: 10, extra: 0, rate: .8 })
    expect(calendarPeriod(S, now, 'year', now).completion).toBe(80)
  })
  it('excludes rest days, respects overrides and matches IDs before names', () => {
    const S = base(); S.week = { 3: 'r', 4: 'r' }; S.dayPlan['2026-09-24'] = 'rest'
    S.workouts = [{ d: '2026-09-23', routineId: 'r', name: 'Old' }, { d: '2026-09-24', routineId: 'r' }]
    expect(consistencyStats(S, '2026-09-23', '2026-09-24', now)).toMatchObject({ planned: 1, completed: 1, missed: 0, extra: 1, rate: 1 })
  })
  it('excludes today from missed and does not count cancelled or active sessions', () => {
    const S = base(); S.dayPlan['2026-09-26'] = 'r'; S.active = { id: 'a' }
    S.workouts = [{ id: 'a', d: '2026-09-26', routineId: 'r' }, { id: 'b', d: '2026-09-26', routineId: 'r', cancelled: true }]
    expect(consistencyStats(S, '2026-09-26', '2026-09-26', now)).toMatchObject({ completed: 0, missed: 0, pending: 1, rate: null })
  })
  it('preserves legacy name matching and reports nonmatching work as extra', () => {
    const S = base(); S.week = { 3: 'r', 4: 'r' }
    S.workouts = [{ d: '2026-09-23', name: 'Renamed' }, { d: '2026-09-24', routineId: 'other', name: 'Renamed' }]
    expect(consistencyStats(S, '2026-09-23', '2026-09-24', now)).toMatchObject({ completed: 1, missed: 1, extra: 1, rate: .5 })
  })
  it('uses the identical window calculation for cards and report data', () => {
    const S = base(); S.week = { 1: 'r' }
    const report = calendarPeriod(S, new Date(2026, 7, 1), 'month', now)
    expect(routineConsistency(S, 31, new Date(2026, 8, 1, 12))).toEqual(report.stats)
  })
})

describe('next scheduled workout', () => {
  it('ignores malformed, explicitly active and duplicate rows', () => {
    const S = base(); S.week = {6:'r'}
    S.workouts = [null, {id:'active',active:true,d:'2026-09-26',routineId:'r'}, {id:'extra',d:'2026-09-26',routineId:'other'}, {id:'extra',d:'2026-09-26',routineId:'other'}]
    expect(consistencyStats(S,'2026-09-26','2026-09-26',now)).toMatchObject({completed:0,extra:1,pending:1})
    expect(nextScheduledWorkout(S,now)).toBe('2026-09-26')
  })
  it('shows pending today then immediately advances after matching completion, skipping rest', () => {
    const S = base(); S.week = { 6: 'r', 1: 'r' }
    expect(nextScheduledWorkout(S, now)).toBe('2026-09-26')
    S.workouts.push({ d: '2026-09-26', routineId: 'r', name: 'Old' })
    expect(nextScheduledWorkout(S, now)).toBe('2026-09-28')
    S.dayPlan['2026-09-28'] = 'rest'
    expect(nextScheduledWorkout(S, now)).toBe('2026-10-03')
  })
  it('does not mistake an unrelated workout for the scheduled workout', () => {
    const S = base(); S.week = { 6: 'r' }; S.workouts = [{ d: '2026-09-26', routineId: 'other' }]
    expect(nextScheduledWorkout(S, now)).toBe('2026-09-26')
  })
  it('finds distant overrides and returns null when no upcoming workout exists', () => {
    const S = base(); expect(nextScheduledWorkout(S, now)).toBeNull()
    S.dayPlan['2027-03-01'] = 'r'
    expect(nextScheduledWorkout(S, now)).toBe('2027-03-01')
    S.workouts = [{ d: '2027-03-01', routineId: 'r' }]
    expect(nextScheduledWorkout(S, now)).toBeNull()
  })
})
