import { describe, expect, it } from 'vitest'
import { parseTGymJson } from './json-import.js'

describe('automatic JSON import detection', () => {
  it('recognises an openGym shared plan', () => {
    const input = {
      opengym_plan: 1,
      name: 'Sahir',
      week: { 1: 'upper' },
      routines: [{ id: 'upper', name: 'Upper', ex: [{ id: '0025', sets: 4, reps: 6 }] }],
      customEx: [],
    }
    const result = parseTGymJson(input)
    expect(result.kind).toBe('plan')
    expect(result.bundle).toMatchObject({ name: 'Sahir', routineCount: 1, exerciseCount: 1, scheduledDays: 1 })
  })

  it('recognises a complete backup separately from a plan', () => {
    const result = parseTGymJson({ framegym_backup: 1, workouts: [], routines: [], week: {} })
    expect(result).toMatchObject({ kind: 'backup', data: { workouts: [], routines: [], week: {} } })
    expect(result.data).not.toHaveProperty('framegym_backup')
  })

  it('rejects unrelated valid JSON', () => {
    expect(() => parseTGymJson({ routines: [] })).toThrow()
  })
})
