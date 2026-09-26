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

  it('exports only logged identities and retains session units and completion status', () => {
    const workout = { id: 'one', unit: 'lb', name: 'Lift', start: 100000, end: 160000, entries: [{ id: '0025', sets: [{ done: true, w: 80, r: 8 }, { done: false, w: 80, r: 8 }] }] }
    const csv = historyCsv({ unit: 'kg', workouts: [workout, workout, { ...workout, id: 'cancelled', cancelled: true }] })
    expect(csv.split('\r\n')).toHaveLength(3)
    expect(csv).toContain('"Completed"')
    expect(csv).toContain('"lb"')
    expect(csv).not.toContain('"kg"')
    expect(csv).toContain('"Completed"')
    expect(csv).toContain('"Pending"')
  })

  it('treats user-entered spreadsheet formulas as text, without changing the saved values', () => {
    const state = { unit: 'kg', exerciseAliases: { '0025': '+SUM(1,1)' }, workouts: [{ name: '=1+1', note: '@SUM(1,1)', entries: [{ id: '0025', sets: [] }] }] }
    const csv = historyCsv(state)
    expect(csv).toContain('"\'=1+1"')
    expect(csv).toContain('"\'+SUM(1,1)"')
    expect(csv).toContain('"\'@SUM(1,1)"')
    expect(state.workouts[0].name).toBe('=1+1')
  })
})
