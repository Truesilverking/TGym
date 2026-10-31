import {describe,it,expect} from 'vitest'
import {migrateState} from './state-migrations.js'
describe('non-destructive onboarding migration',()=>{
 it('shows onboarding only for a genuinely new profile',()=>{expect(migrateState({workouts:[],routines:[]})).toMatchObject({hasCompletedOnboarding:false,hasCompletedAppTour:false})})
 it('honors the existing completion marker and training history',()=>{expect(migrateState({}, {onboarded:true}).hasCompletedOnboarding).toBe(true);expect(migrateState({workouts:[{id:'old'}]}).hasCompletedOnboarding).toBe(true)})
 it('keeps completed tour and onboarding across older backup restore',()=>{expect(migrateState({}, {onboarded:true,toured:true})).toMatchObject({hasCompletedOnboarding:true,hasCompletedAppTour:true})})
 it('preserves records, images, routine IDs, theme, pauses and unknown fields',()=>{const old={workouts:[{id:'a',routineId:'r'}],inbody:[{image:'ref'}],accent:'cyan',trainingPauses:[{start:'2026-09-01'}],extra:{x:1}};const copy=structuredClone(old);expect(migrateState(old)).toMatchObject(old);expect(old).toEqual(copy);expect(migrateState(migrateState(old))).toEqual(migrateState(old))})
 it('rejects invalid or future schemas instead of overwriting data',()=>{expect(()=>migrateState({storageVersion:99})).toThrow();expect(()=>migrateState([])).toThrow()})
 it('normalizes an owned persistence draft without cloning its unchanged training collections again',()=>{
  const draft={storageVersion:4,workouts:[{id:'history',entries:[{id:'ex',sets:[{r:8}]}]}],routines:[{id:'r',ex:[]}],week:{1:'r'},dayPlan:{},extra:{kept:true}}
  const rows=draft.workouts,routines=draft.routines
  const result=migrateState(draft,{cloneInput:false})
  expect(result).toBe(draft);expect(result.workouts).toBe(rows);expect(result.routines).toBe(routines)
  expect(result.week[1]).toEqual(['r']);expect(result.workouts[0].entries[0].sets[0].r).toBe(8)
 })
 it('retains valid schedule/order references but still repairs duplicate and legacy assignments',()=>{
  const week={1:['r']},dayPlan={'2026-10-22':[]},routineOrder=['r']
  const result=migrateState({routines:[{id:'r'}],week,dayPlan,routineOrder},{cloneInput:false})
  expect(result.week).toBe(week);expect(result.dayPlan).toBe(dayPlan);expect(result.routineOrder).toBe(routineOrder)
  const legacy=migrateState({...result,week:{1:['r','r'],2:'r',3:'rest'},routineOrder:['missing','r','r']},{cloneInput:false})
  expect(legacy.week).toEqual({1:['r'],2:['r'],3:[]});expect(legacy.routineOrder).toEqual(['r'])
  const imported=migrateState(result)
  expect(imported.week).not.toBe(week);expect(imported.week).toEqual(week)
 })
})
