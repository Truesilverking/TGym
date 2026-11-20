import { describe, expect, it } from 'vitest'
import { convertMeasurementState, convertWeightState, weightStepFor } from './unit-conversion.js'

describe('stored unit conversion', () => {
  it('converts portable loading grids without converting timed progression seconds', () => {
    const cfg = { id: 'timed', mode: 'time', weight: 20, inc: 5, loadingStep: 2.5 }
    const S = { unit: 'kg', routines: [{ ex: [cfg] }], active: { entries: [{ target: { ...cfg }, sets: [] }] } }
    convertWeightState(S, 'lb')
    expect(cfg.inc).toBe(5)
    expect(cfg.loadingStep).toBeCloseTo(2.5 * 2.2046226218487757, 5)
    expect(S.active.entries[0].target.inc).toBe(5)
    expect(S.active.entries[0].target.loadingStep).toBeCloseTo(cfg.loadingStep, 6)
    convertWeightState(S, 'kg')
    expect(cfg.loadingStep).toBeCloseTo(2.5, 5)
    expect(cfg.inc).toBe(5)
  })
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

it('converts explicit mixed measurement units once and retains dates and missing values', () => {
  const S={measurementUnit:'cm',measurements:[{id:'a',d:'2026-09-01',unit:'cm',neck:25.4,waist:null},{id:'b',d:'2026-09-02',unit:'in',neck:10}]}
  convertMeasurementState(S,'in')
  expect(S.measurements).toEqual([{id:'a',d:'2026-09-01',unit:'in',neck:10,waist:null},{id:'b',d:'2026-09-02',unit:'in',neck:10}])
  convertMeasurementState(S,'cm')
  expect(S.measurements.map(r=>[r.unit,r.neck])).toEqual([['cm',25.4],['cm',25.4]])
})
it('updates stamped bodyweight and samples together without converting pounds twice',()=>{
  const S={unit:'kg',bodyweight:[{unit:'lb',w:154,samples:[{w:153}]},{unit:'kg',w:70,samples:[{w:69}]}]}
  convertWeightState(S,'lb')
  expect(S.bodyweight[0]).toEqual({unit:'lb',w:154,samples:[{w:153}]})
  expect(S.bodyweight[1]).toEqual({unit:'lb',w:154.32,samples:[{w:152.12}]})
})

it('does not convert or round historical sessions already recorded in the destination unit', () => {
  const workout = {
    id:'already-lb', unit:'lb', bw:154.123456, vol:800.123456,
    entries:[{id:'bench',target:{weight:80.123456,loadingStep:2.5000005},sets:[{unit:'lb',w:'80.123456',r:10,done:true,drops:[{w:40.123456}]}]}],
    audit:{source:'portable history'},
  }
  const S={unit:'kg',workouts:[structuredClone(workout)]}
  convertWeightState(S,'lb')
  expect(S.workouts[0]).toEqual(workout)
  expect(S.unit).toBe('lb')
})

it('uses the authoritative session, entry, target and set units independently', () => {
  const S={unit:'kg',workouts:[{
    unit:'lb',bw:70,bwUnit:'kg',bodyweight:154.123456,bodyweightUnit:'lb',vol:800.123456,
    entries:[{unit:'kg',topW:20,target:{unit:'lb',weight:40.123456,inc:2.500005,loadingStep:5.5000005},sets:[
      {unit:'lb',w:80.123456,r:10,done:true,role:'top',drops:[{w:40.123456},{unit:'kg',w:10}],note:'keep'},
      {w:20,r:8,done:false,phase:'warmup'},
    ]}],
  }]}
  convertWeightState(S,'lb')
  const w=S.workouts[0],entry=w.entries[0]
  expect(w).toMatchObject({unit:'lb',bw:154.32,bwUnit:'lb',bodyweight:154.123456,bodyweightUnit:'lb',vol:800.123456})
  expect(entry).toMatchObject({unit:'lb',topW:44.09,target:{unit:'lb',weight:40.123456,inc:2.500005,loadingStep:5.5000005}})
  expect(entry.sets).toEqual([
    {unit:'lb',w:80.123456,r:10,done:true,role:'top',drops:[{w:40.123456},{unit:'lb',w:22.05}],note:'keep'},
    {w:44.09,r:8,done:false,phase:'warmup'},
  ])
})

it('converts a resume snapshot from its own unit and keeps timed progressions and legacy mode units intact', () => {
  const S={unit:'kg',active:{unit:'lb',bw:70,bodyweightUnit:'kg',entries:[{sets:[{w:80,r:10}]}]},workouts:[{
    unit:'lb',entries:[{sets:[{w:80,r:10}]}],
    resumeSnapshot:{unit:'kg',entries:[{mode:'time',target:{mode:'time',unit:'sec',weight:20,inc:5,loadingStep:2.5},sets:[{sec:60,w:20,done:true}]}]},
  }]}
  convertWeightState(S,'lb')
  expect(S.active).toMatchObject({unit:'lb',bw:154.32,bodyweightUnit:'lb',entries:[{sets:[{w:80,r:10}]}]})
  expect(S.workouts[0].entries[0].sets[0].w).toBe(80)
  const snapshot=S.workouts[0].resumeSnapshot,entry=snapshot.entries[0]
  expect(snapshot.unit).toBe('lb')
  expect(entry.target).toEqual({mode:'time',unit:'sec',weight:44.09,inc:5,loadingStep:5.511557})
  expect(entry.sets[0]).toEqual({sec:60,w:44.09,done:true})
})

it('round-trips mixed historical units without converting an already matching set twice', () => {
  const S={unit:'kg',workouts:[{unit:'lb',entries:[{unit:'kg',target:{unit:'lb',weight:80},sets:[{unit:'lb',w:80,r:10,done:true},{w:20,r:8}]}]}]}
  convertWeightState(S,'lb')
  expect(S.workouts[0].entries[0].sets.map(s=>s.w)).toEqual([80,44.09])
  convertWeightState(S,'kg')
  const entry=S.workouts[0].entries[0]
  expect(S.workouts[0].unit).toBe('kg')
  expect(entry.unit).toBe('kg');expect(entry.target).toEqual({unit:'kg',weight:36.29})
  expect(entry.sets).toEqual([{unit:'kg',w:36.29,r:10,done:true},{w:20,r:8}])
  const before=structuredClone(S)
  convertWeightState(S,'kg')
  expect(S).toEqual(before)
})

it('falls back through blank or unsupported load-unit stamps without reinterpreting legacy mode units', () => {
  const S={unit:'kg',workouts:[{unit:'legacy',bw:70,entries:[{
    unit:'',mode:'time',target:{unit:'sec',mode:'time',weight:20,inc:5},
    sets:[{unit:'unsupported',w:20,sec:60,done:true}],
  }]}]}
  convertWeightState(S,'lb')
  expect(S.workouts[0]).toMatchObject({unit:'lb',bw:154.32,entries:[{target:{unit:'sec',weight:44.09,inc:5},sets:[{w:44.09,sec:60,done:true}]}]})
})

it('converts each stamped bodyweight sample once and updates its own unit with the value', () => {
  const matching={unit:'kg',w:'70.123456789',t:1},S={unit:'lb',bodyweight:[{unit:'lb',w:154,samples:[matching,{unit:'lb',w:154,t:2},{w:154,t:3},{unit:'seconds',w:null,sec:30}]}]}
  convertWeightState(S,'kg')
  expect(S.bodyweight[0]).toEqual({unit:'kg',w:69.85,samples:[{unit:'kg',w:'70.123456789',t:1},{unit:'kg',w:69.85,t:2},{w:69.85,t:3},{unit:'seconds',w:null,sec:30}]})
  const saved=structuredClone(S);convertWeightState(S,'kg');expect(S).toEqual(saved)
})
