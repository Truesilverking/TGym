import {describe, expect, it} from 'vitest'
import {anonymousQuotaExchange} from './routine-import-quota.fixture.js'
import {applyRoutineExchange, createRoutineExchange, validateRoutineExchange} from './routine-exchange.js'
import {buildSets} from './history.js'
import {customTransferIssues} from './routine-portability.js'
import {applyTrainingPlan, withBackoffRepsMode} from './training-plan.js'

const destination = unit => ({unit,routines:[],routineOrder:[],customEx:[],exerciseAliases:{},exNotes:{},exWeights:{},week:{},dayPlan:{},workouts:[{id:'existing-history',entries:[]}],active:{id:'existing-session'},effort:'rir'})
const choices = checked => Object.fromEntries(checked.conflicts.map(c=>[c.key,c.kind === 'unit' ? 'convert' : c.allowedChoices.includes('keep') ? 'keep' : c.allowedChoices[0]]))
const apply = (S,checked) => applyRoutineExchange(S,checked,{conflicts:choices(checked),schedule:true,acceptAdaptations:true})
const plannedRows = (S,ex) => applyTrainingPlan(buildSets(S,ex),withBackoffRepsMode(ex,S),ex.loadingStep)

describe('anonymous equivalent of a media-heavy version 2 transfer',()=>{
  it('validates large embedded resources and stores required definitions once without persisting the full catalogue',()=>{
    const data=anonymousQuotaExchange(), S=destination('lb'), original=structuredClone(S), checked=validateRoutineExchange(JSON.stringify(data),S)
    expect(data.routines).toHaveLength(6)
    expect(data.routines.flatMap(r=>r.ex)).toHaveLength(48)
    expect(new Set(data.routines.flatMap(r=>r.ex.map(e=>e.id))).size).toBe(32)
    expect(data.catalog.filter(ex=>ex.custom)).toHaveLength(7)
    expect(data.catalog.filter(ex=>ex.definition?.img)).toHaveLength(6)
    expect(data.catalog.filter(ex=>ex.custom).every(ex=>!customTransferIssues(ex.definition).length)).toBe(true)
    expect(checked.errors).toEqual([])
    expect(checked.valid).toBe(true)
    expect(checked.sourceUnit).toBe('lb')
    expect(checked.conflicts.some(c=>c.kind==='unit')).toBe(false)
    const next=apply(S,checked),serialized=JSON.stringify(next)
    expect(new TextEncoder().encode(serialized).length).toBeGreaterThan(4_700_000)
    expect(serialized.length*2).toBeGreaterThan(9_400_000)
    expect(Object.hasOwn(next,'catalog')).toBe(false)
    expect(next.customEx).toHaveLength(7)
    for (const ex of next.customEx.filter(ex=>ex.img)) expect(serialized.split(ex.img).length-1).toBe(1)
    expect(next.workouts).toEqual(original.workouts)
    expect(next.active).toEqual(original.active)
    expect(S).toEqual(original)
  },15000)

  it.each(['lb','kg'])('preserves explicit prescriptions, time goals, resources and Top/Back-off behavior after export and reimport in %s',unit=>{
    const data=anonymousQuotaExchange({largeMedia:false}), S=destination(unit),checked=validateRoutineExchange(data,S),next=apply(S,checked)
    expect(checked.sourceUnit).toBe('lb')
    expect(checked.conflicts.filter(c=>c.kind==='unit').map(c=>c.name)).toEqual(unit==='lb'?[]:['lb → kg'])
    const exported=createRoutineExchange(next), other=destination(unit), restored=apply(other,validateRoutineExchange(exported,other))
    expect(restored.routines).toEqual(next.routines)
    expect(restored.customEx).toEqual(next.customEx)
    expect(restored.exerciseAliases).toEqual(next.exerciseAliases)
    expect(restored.exNotes).toEqual(next.exNotes)
    expect(restored.week).toEqual(next.week)
    expect(restored.dayPlan).toEqual(next.dayPlan)
    for(const [ri,routine] of next.routines.entries()) for(const [ei,ex] of routine.ex.entries()) {
      expect(buildSets(restored,restored.routines[ri].ex[ei])).toEqual(buildSets(next,ex))
      expect(plannedRows(restored,restored.routines[ri].ex[ei])).toEqual(plannedRows(next,ex))
      if(ex.mode==='time') expect(ex.sec).toBe(data.routines[ri].ex[ei].sec)
      if(ex.setScheme==='topback') {
        expect(ex).toMatchObject({backoffRepsOverride:true,autoBackoffReps:true,topRepsMin:6,topRepsMax:8,topRirMin:1,topRirMax:2,backoffRirMin:2,backoffRirMax:3})
        expect(plannedRows(next,ex).map(row=>row.role)).toEqual(['top','backoff','backoff'])
        expect(plannedRows(next,ex).filter(row=>row.role==='backoff').map(row=>row.r)).toEqual(ex.backoffRepsMode==='same'?[8,8]:[10,10])
      }
    }
    const repeated=apply(next,validateRoutineExchange(data,next))
    expect(repeated).toEqual(next)
  })
})
