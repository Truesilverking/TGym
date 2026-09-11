import { describe, expect, it } from 'vitest'
import { convertMeasurementState, convertWeightState, weightStepFor } from './unit-conversion.js'

describe('stored unit conversion', () => {
  it('converts the auto-finish resume snapshot together with its history entry', () => {
    const S={unit:'kg',workouts:[{resumeSnapshot:{unit:'kg',entries:[{sets:[{w:100}]}]}}]}
    convertWeightState(S,'lb')
    expect(S.workouts[0].resumeSnapshot.entries[0].sets[0].w).toBe(220.46)
    expect(S.workouts[0].resumeSnapshot.unit).toBe('lb')
  })
  it('converts all load-bearing records and their unit stamps together', () => {
    const S = {
      unit: 'kg', targetW: 80,
      bodyweight: [{ w: 70, samples: [{ w: 69.5 }] }],
      exWeights: { bench: { w: 100 } }, exerciseGoals: { bench: { weight: 120, reps: 5 } },
      routines: [{ ex: [{ id: 'bench', sets: 4, weight: 90, inc: 2.5 }] }],
      workouts: [{ unit: 'kg', bw: 70, vol: 1000, entries: [{ topW: 100, target: { weight: 90, inc: 2.5 }, sets: [{ w: 90, drops: [{ w: 60 }], unit: 'kg' }] }] }],
      active: { unit: 'kg', bw: 70, entries: [{ target: { weight: 80 }, sets: [{ w: 80 }] }] },
    }
    convertWeightState(S, 'lb')
    expect(S.targetW).toBe(176.37)
    expect(S.bodyweight[0].w).toBe(154.32)
    expect(S.exWeights.bench.w).toBe(220.46)
    expect(S.routines[0].ex[0].inc).toBe(5.51)
    expect(S.routines[0].ex[0].sets).toBe(4)
    expect(S.workouts[0].entries[0].sets[0].drops[0].w).toBe(132.28)
    expect(S.workouts[0].unit).toBe('lb')
    expect(S.active.entries[0].sets[0].w).toBe(176.37)
    convertWeightState(S, 'kg')
    expect(S.targetW).toBeCloseTo(80, 2)
    expect(S.workouts[0].vol).toBeCloseTo(1000, 1)
  })

  it('switches units when routine prescriptions store sets as a number', () => {
    const S = { unit: 'kg', routines: [{ ex: [{ id: 'squat', sets: 4, weight: 100 }] }], workouts: [] }
    expect(() => convertWeightState(S, 'lb')).not.toThrow()
    expect(S).toMatchObject({ unit: 'lb', routines: [{ ex: [{ sets: 4, weight: 220.46 }] }] })
  })

  it('converts height, current fields and legacy tape measurements', () => {
    const S = { measurementUnit: 'cm', heightCm: 180, measurements: [{ waist: 80, arm: 40, armLeft: 39 }] }
    convertMeasurementState(S, 'in')
    expect(S.heightCm).toBe(70.87)
    expect(S.measurements[0].waist).toBe(31.5)
    expect(S.measurements[0].arm).toBe(15.75)
    convertMeasurementState(S, 'cm')
    expect(S.heightCm).toBeCloseTo(180, 1)
    expect(S.measurements[0].armLeft).toBeCloseTo(39, 1)
  })

  it('does not turn blank optional measurements into zero', () => {
    const S = { measurementUnit: 'cm', heightCm: '', measurements: [{ waist: null, chest: '' }] }
    convertMeasurementState(S, 'in')
    expect(S.heightCm).toBe('')
    expect(S.measurements[0]).toEqual({ waist: null, chest: '' })
  })

  it('uses practical weight steps for each unit', () => {
    expect(weightStepFor('kg')).toBe(2.5)
    expect(weightStepFor('lb')).toBe(5)
  })
})
