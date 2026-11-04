import { describe, it, expect } from 'vitest'
import { personalRecords, recentRecords } from './personal-records.js'

const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
const workout = (id, d, entries) => ({ id, d, start: Date.parse(d + 'T10:00:00'), routineId: 'r', entries })

describe('personalRecords', () => {
  const S = {
    workouts: [
      workout('a', '2026-10-01', [{ id: 'squat', sets: [set(60, 10, { phase: 'warmup' }), set(100, 5), set(100, 5)] }, { id: 'pullup', sets: [set(0, 12)] }]),
      workout('b', '2026-10-08', [{ id: 'squat', sets: [set(110, 3), set(90, 8)] }]),
      workout('c', '2026-10-15', [{ id: 'squat', sets: [set(105, 6, { done: false })] }, { id: 'bench', sets: [set(80, 5)] }]),
    ],
  }

  it('keeps the heaviest working set and the best estimated 1RM per exercise', () => {
    const squat = personalRecords(S).find(r => r.id === 'squat')
    expect(squat.bestWeight).toEqual({ w: 110, d: '2026-10-08' })
    expect(squat.best1RM.d).toBe('2026-10-08')
    expect(squat.best1RM.w).toBe(110)
    expect(squat.sessions).toBe(3)
  })

  it('ignores warm-ups and unfinished sets', () => {
    const squat = personalRecords(S).find(r => r.id === 'squat')
    expect(squat.bestWeight.w).not.toBe(105)
  })

  it('omits exercises with nothing to rank and sorts by the latest record', () => {
    const records = personalRecords(S)
    expect(records.map(r => r.id)).toEqual(['bench', 'squat'])
    expect(records[0].recordDate).toBe('2026-10-15')
  })

  it('filters recent records by date', () => {
    expect(recentRecords(personalRecords(S), '2026-10-10').map(r => r.id)).toEqual(['bench'])
  })

  it('returns an empty list with no history', () => {
    expect(personalRecords({ workouts: [] })).toEqual([])
  })

  it('counts repeated entries once per session and dates ties by when the record was first earned', () => {
    const first = workout('a', '2026-10-01', [{ id: 'bench', sets: [set(80, 5)] }, { id: 'bench', sets: [set(70, 6)] }])
    const later = workout('b', '2026-10-08', [{ id: 'bench', sets: [set(80, 5)] }])
    const [record] = personalRecords({ workouts: [later, first] })
    expect(record.sessions).toBe(2)
    expect(record.recordDate).toBe('2026-10-01')
  })

  it('does not estimate a 1RM from stale reps on a timed entry', () => {
    const [record] = personalRecords({ workouts: [workout('t', '2026-10-01', [{ id: 'carry', target: { mode: 'time' }, sets: [set(30, 10, { sec: 60 })] }])] })
    expect(record.bestWeight.w).toBe(30)
    expect(record.best1RM).toBeNull()
  })
})
