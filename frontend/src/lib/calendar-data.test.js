import { describe, it, expect, vi, afterEach } from 'vitest'
import { calendarPeriod, calendarFilename } from './calendar-data.js'
const state = { workouts: [{ d:'2026-09-02', name:'Upper' }], routines:[{id:'r',name:'Upper'}], week:{3:'r',4:'r'}, dayPlan:{} }
afterEach(() => vi.useRealTimers())
describe('calendar export periods', () => {
  it('exports seven Monday to Sunday days without changing input', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,8,2,12))
    const before = JSON.stringify(state)
    const result = calendarPeriod(state, new Date(2026,8,2), 'week')
    expect(result.start).toBe('2026-08-31'); expect(result.end).toBe('2026-09-06')
    expect(result.days).toHaveLength(7); expect(result.counts.completed).toBe(1)
    expect(result.counts.pending).toBe(1); expect(JSON.stringify(state)).toBe(before)
  })
  it('handles leap years and filenames', () => {
    expect(calendarPeriod(state,new Date(2024,1,10),'month').days).toHaveLength(29)
    expect(calendarPeriod(state,new Date(2024,1,10),'year').days).toHaveLength(366)
    expect(calendarFilename('full','2026-01-01','2026-12-31','pdf')).toBe('TGym-Training-Calendar-Report-2026.pdf')
  })
})
