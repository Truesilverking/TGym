import {describe,it,expect} from 'vitest'
import {migrateState} from './state-migrations.js'
describe('non-destructive onboarding migration',()=>{
 it('shows onboarding only for a genuinely new profile',()=>{expect(migrateState({workouts:[],routines:[]})).toMatchObject({hasCompletedOnboarding:false,hasCompletedAppTour:false})})
 it('honors the existing completion marker and training history',()=>{expect(migrateState({}, {onboarded:true}).hasCompletedOnboarding).toBe(true);expect(migrateState({workouts:[{id:'old'}]}).hasCompletedOnboarding).toBe(true)})
 it('keeps completed tour and onboarding across older backup restore',()=>{expect(migrateState({}, {onboarded:true,toured:true})).toMatchObject({hasCompletedOnboarding:true,hasCompletedAppTour:true})})
 it('preserves records, images, routine IDs, theme, pauses and unknown fields',()=>{const old={workouts:[{id:'a',routineId:'r'}],inbody:[{image:'ref'}],accent:'cyan',trainingPauses:[{start:'2026-09-01'}],extra:{x:1}};const copy=structuredClone(old);expect(migrateState(old)).toMatchObject(old);expect(old).toEqual(copy);expect(migrateState(migrateState(old))).toEqual(migrateState(old))})
 it('rejects invalid or future schemas instead of overwriting data',()=>{expect(()=>migrateState({storageVersion:99})).toThrow();expect(()=>migrateState([])).toThrow()})
})
