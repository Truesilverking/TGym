import { describe, expect, it } from 'vitest'
import { bmiBand, bmiFor, measurementValue, routineConsistency, routineDurationSummary, sessionTimingSummary, validTimedSessions } from './stats-insights.js'

describe('body and session insights', () => {
  it('keeps legacy one-side measurements readable as left and right', () => {
    expect(measurementValue({ arm: 35 }, 'armLeft')).toBe(35)
    expect(measurementValue({ thigh: 60 }, 'thighRight')).toBe(60)
  })
  it('calculates BMI from kilograms and pounds', () => {
    expect(bmiFor(80, 'kg', 180)).toBe(24.7)
    expect(bmiFor(176.37, 'lb', 180)).toBe(24.7)
    expect(bmiBand(24.7)).toBe('Healthy range')
  })

  it('ignores missing timers without rejecting valid long sessions', () => {
    const start = new Date(2026, 7, 1, 18, 0).getTime()
    expect(validTimedSessions([{ start, end: start + 60 * 60000 }, { start, end: start + 14 * 3600000 }, { start }])).toHaveLength(2)
  })

  it('summarises duration and a usual start time across midnight', () => {
    const a = new Date(2026, 7, 1, 23, 30).getTime()
    const b = new Date(2026, 7, 2, 0, 30).getTime()
    const result = sessionTimingSummary([{ id: 'a', start: a, end: a + 60 * 60000 }, { id: 'b', start: b, end: b + 90 * 60000 }])
    expect(result.averageMs).toBe(75 * 60000)
    expect(result.usualStartMinutes === 0 || result.usualStartMinutes === 1440).toBe(true)
  })

  it('counts completed, missed and extra routine days', () => {
    const S = {
      routines: [{ id: 'r', name: 'Upper' }], week: { 1: 'r' }, dayPlan: {},
      workouts: [{ d: '2026-08-24', routineId: 'r', name: 'Upper' }, { d: '2026-08-25', routineId: null, name: 'Extra' }],
    }
    const result = routineConsistency(S, 7, new Date(2026, 7, 31, 12))
    expect(result).toMatchObject({ planned: 1, completed: 1, missed: 0, extra: 1, rate: 1 })
  })
})

describe('routine duration from corrected history', () => {
  const min=60000, now=Date.UTC(2026,8,20)
  const w=(id,routineId,duration,name='Upper')=>({id,routineId,name,start:now-86400000,end:now-86400000+duration*min})
  it('rejects future ends and non-timestamp types without losing valid legacy numbers', () => {
    const valid = w('valid','r',30)
    const rows = [valid, {...valid,id:'future',end:now+86400000}, {...valid,id:'boolean',start:true}, {...valid,id:'array',start:[]}]
    expect(routineDurationSummary(rows,{now})[0]).toMatchObject({count:1,meanMs:30*min})
  })
  it('groups by ID through renames and keeps same-name routines distinct', () => {
    const rows=routineDurationSummary([w('a','r1',60,'Old'),w('b','r1',90),w('c','r2',45),w('d',null,30)],{now,routines:[{id:'r1',name:'Renamed'}]})
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({routineId:'r1',name:'Renamed',count:2,meanMs:75*min,medianMs:75*min})
  })
  it('uses paused duration and includes corrected inactivity completion', () => {
    const a={...w('a','r',100),pausedDurationMs:40*min}
    const b={...w('b','r',72),finishReason:'inactivity'}
    expect(routineDurationSummary([a,b],{now})[0]).toMatchObject({count:2,meanMs:66*min,medianMs:66*min})
  })
  it('excludes active, cancelled, duplicate and technically invalid records', () => {
    const a=w('a','r',60)
    const rows=[a,{...a},w('active','r',90),{...w('cancel','r',30),cancelled:true},{start:now},w('negative','r',-1),{...w('pause','r',10),pausedDurationMs:11*min},{...w('nan','r',10),start:'bad'},{...w('blank','r',10),start:''},{...w('inf','r',10),end:Infinity}]
    expect(validTimedSessions(rows,{activeId:'active'}).map(w=>w.id)).toEqual(['a'])
  })
  it('deduplicates ID-less imports and computes odd median and the selected period', () => {
    const a=w(undefined,null,30), old={...w('old','r',60),start:now-100*86400000,end:now-100*86400000+60*min}
    expect(validTimedSessions([a,{...a}])).toHaveLength(1)
    const rows=routineDurationSummary([w('a','r',30),w('b','r',60),w('c','r',120),old],{now,days:90})
    expect(rows[0]).toMatchObject({count:3,meanMs:70*min,medianMs:60*min})
    expect(routineDurationSummary([old],{now,days:0})[0].count).toBe(1)
  })
})
