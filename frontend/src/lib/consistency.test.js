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
      if (i <= 20) S.workouts.push({ id: String(i), d, routineId: 'r', name: 'Old name' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]})
    }
    expect(consistencyStats(S, '2026-09-01', '2026-10-05', now)).toEqual({ planned: 35, completed: 20, missed: 5, pending: 10, extra: 0, activeDays:20, missedDays:5, rate: .8 })
    expect(calendarPeriod(S, now, 'year', now).completion).toBe(80)
  })
  it('excludes rest days, respects overrides and matches IDs before names', () => {
    const S = base(); S.week = { 3: 'r', 4: 'r' }; S.dayPlan['2026-09-24'] = 'rest'
    S.workouts = [{ d: '2026-09-23', routineId: 'r', name: 'Old' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}, { d: '2026-09-24', routineId: 'r' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}]
    expect(consistencyStats(S, '2026-09-23', '2026-09-24', now)).toMatchObject({ planned: 2, completed: 2, missed: 0, extra: 0, rate: 1 })
  })
  it('excludes today from missed and does not count cancelled or active sessions', () => {
    const S = base(); S.dayPlan['2026-09-26'] = 'r'; S.active = { id: 'a' }
    S.workouts = [{ id: 'a', d: '2026-09-26', routineId: 'r' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}, { id: 'b', d: '2026-09-26', routineId: 'r', cancelled: true , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}]
    expect(consistencyStats(S, '2026-09-26', '2026-09-26', now)).toMatchObject({ completed: 0, missed: 0, pending: 1, rate: null })
  })
  it('preserves legacy identity and separates off-schedule planned activity from missed slots', () => {
    const S = base(); S.week = { 3: 'r', 4: 'r' }
    S.workouts = [{ d: '2026-09-23', name: 'Renamed' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}, { d: '2026-09-24', routineId: 'other', name: 'Renamed' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}]
    expect(consistencyStats(S, '2026-09-23', '2026-09-24', now)).toMatchObject({ completed: 2, missed: 1, extra: 0, rate: 1 })
  })
  it('uses the identical window calculation for cards and report data', () => {
    const S = base(); S.week = { 1: 'r' }
    const report = calendarPeriod(S, new Date(2026, 7, 1), 'month', now)
    expect(routineConsistency(S, 32, new Date(2026, 8, 1, 12))).toEqual(report.stats)
  })
})

describe('next scheduled workout', () => {
  it('ignores malformed, active and duplicate rows while retaining off-schedule origin', () => {
    const S = base(); S.week = {6:'r'}
    S.workouts = [null, {id:'active',active:true,d:'2026-09-26',routineId:'r', entries:[{id:'exercise',sets:[{done:true,r:8}]}]}, {id:'extra',d:'2026-09-26',routineId:'other', entries:[{id:'exercise',sets:[{done:true,r:8}]}]}, {id:'extra',d:'2026-09-26',routineId:'other', entries:[{id:'exercise',sets:[{done:true,r:8}]}]}]
    expect(consistencyStats(S,'2026-09-26','2026-09-26',now)).toMatchObject({completed:1,extra:0,pending:1})
    expect(nextScheduledWorkout(S,now)).toBe('2026-09-26')
  })
  it('shows pending today then immediately advances after matching completion, skipping rest', () => {
    const S = base(); S.week = { 6: 'r', 1: 'r' }
    expect(nextScheduledWorkout(S, now)).toBe('2026-09-26')
    S.workouts.push({ d: '2026-09-26', routineId: 'r', name: 'Old' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]})
    expect(nextScheduledWorkout(S, now)).toBe('2026-09-28')
    S.dayPlan['2026-09-28'] = 'rest'
    expect(nextScheduledWorkout(S, now)).toBe('2026-10-03')
  })
  it('does not mistake an unrelated workout for the scheduled workout', () => {
    const S = base(); S.week = { 6: 'r' }; S.workouts = [{ d: '2026-09-26', routineId: 'other' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}]
    expect(nextScheduledWorkout(S, now)).toBe('2026-09-26')
  })
  it('finds distant overrides and returns null when no upcoming workout exists', () => {
    const S = base(); expect(nextScheduledWorkout(S, now)).toBeNull()
    S.dayPlan['2027-03-01'] = 'r'
    expect(nextScheduledWorkout(S, now)).toBe('2027-03-01')
    S.workouts = [{ d: '2027-03-01', routineId: 'r' , entries:[{id:'exercise',sets:[{done:true,r:8}]}]}]
    expect(nextScheduledWorkout(S, now)).toBeNull()
  })
})

it('keeps extra-session totals finite when the period includes untracked days',()=>{
 const S={routines:[],workouts:[{id:'w',d:'2026-09-26',entries:[{id:'exercise',sets:[{done:true,r:8}]}]}],trainingHistory:{trackedFrom:'2026-09-26',historicalWorkouts:0,workoutsPerWeek:3}}
 expect(consistencyStats(S,'2026-09-01','2026-09-26',new Date('2026-09-26T12:00:00'))).toMatchObject({extra:1,planned:0})
})
