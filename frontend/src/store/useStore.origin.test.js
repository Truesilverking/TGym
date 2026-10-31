// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { beginWorkout } from '../sheets.jsx'
import { useStore, DEF } from './useStore.js'
import { buildCompletedWorkout } from '../lib/finish-workout.js'
import { consistencyStats } from '../lib/consistency.js'
import { trainingStreak } from '../lib/training-plan.js'
import { createBackup, readBackup } from '../lib/backup.js'
import { mergeTGymStates } from '../lib/state-merge.js'

const d='2026-09-21',now=new Date(d+'T12:00:00')
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);localStorage.clear();useStore.setState({user:null,S:{...structuredClone(DEF),trainingStartDate:d,trainingHistory:{trackedFrom:d,historicalWorkouts:0,workoutsPerWeek:3},routines:[{id:'r',name:'Routine',ex:[]}],week:{1:['r']}}})})
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers()})
it('captures origin at the real start, preserves it through edits/reopen/backup/cloud merge and finishes one session',()=>{
 beginWorkout('r',80)
 expect(useStore.getState().S.active.sessionOrigin).toEqual({type:'planned',routineId:'r'})
 useStore.getState().update(s=>{s.active.entries=['a','b','c'].map(id=>({id,sets:[{done:true,r:8,w:40}]}));s.active.sessionOrigin={type:'extra',routineId:null};s.active.routineId=null;s.active.name='Edited';s.week={};s.routines=[]})
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
 useStore.getState().replaceState(saved)
 const completed=buildCompletedWorkout(useStore.getState().S.active)
 useStore.getState().update(s=>{s.workouts.push(completed);s.active=null})
 const S=useStore.getState().S
 expect(consistencyStats(S,d,d,now)).toMatchObject({planned:1,completed:1,extra:0,activeDays:1,rate:1})
 expect(trainingStreak(S,now).current).toBe(1)
 const backup=readBackup(createBackup(S)),merged=mergeTGymStates(S,backup).merged
 expect(merged.workouts[0].sessionOrigin).toEqual({type:'planned',routineId:'r'})
 useStore.getState().update(s=>{s.workouts[0].sessionOrigin={type:'extra',routineId:null};s.workouts[0].entries.pop()})
 expect(useStore.getState().S.workouts[0].sessionOrigin.type).toBe('planned')
 beginWorkout(null,80)
 expect(useStore.getState().S.active.sessionOrigin.type).toBe('extra')
 useStore.getState().update(s=>{s.active.entries=[{id:'extra',sets:[{done:true,sec:30}]}]})
 const extra=buildCompletedWorkout(useStore.getState().S.active)
 useStore.getState().update(s=>{s.workouts.push(extra);s.active=null})
 expect(consistencyStats(useStore.getState().S,d,d,now)).toMatchObject({planned:1,extra:1,activeDays:1,rate:1})
 expect(trainingStreak(useStore.getState().S,now).current).toBe(1)
})
