// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { historyCsv } from './History.jsx'

describe('history export', () => {
  it('includes workout times and duration alongside set data', () => {
    const start = new Date(2026, 7, 31, 18, 15).getTime()
    const csv = historyCsv({
      unit: 'kg', exerciseAliases: {},
      workouts: [{ d: '2026-08-31', start, end: start + 75 * 60000, name: 'Upper', entries: [{ id: '0025', sets: [{ done: true, w: 80, r: 8 }] }] }],
    })
    expect(csv).toContain('Workout duration (min)')
    expect(csv).toContain('Set duration (s)')
    expect(csv).toContain('"75"')
    expect(csv).toContain('"Upper"')
  })

  it('does not mutate an entry with no sets', () => {
    const entry = { id: '0025', sets: [] }
    historyCsv({ unit: 'kg', exerciseAliases: {}, workouts: [{ d: '2026-08-31', name: 'Upper', entries: [entry] }] })
    expect(entry.sets).toEqual([])
  })
})
