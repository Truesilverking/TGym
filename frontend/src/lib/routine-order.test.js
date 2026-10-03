import {it,expect} from 'vitest'
import {orderedRoutines,reorderRoutine} from './routine-order.js'
import {migrateState} from './state-migrations.js'
import {createBackup,readBackup} from './backup.js'
import {mergeTGymStates} from './state-merge.js'
const state=n=>({routines:Array.from({length:n},(_,i)=>({id:'r'+i,name:'Routine '+i,ex:[]})),workouts:[{id:'old',routineId:'r0',d:'2026-09-28',entries:[]}],week:{1:['r0','r1']},dayPlan:{'2026-09-29':['r1']},active:{id:'live',routineId:'r1',entries:[]}})
it.each([2,5,30])('persists %i routines through migration and backup without touching training data',n=>{
 const S=state(n),original=structuredClone(S);reorderRoutine(S,'r0','r'+(n-1));expect(S).toMatchObject(original)
 const restored=migrateState(readBackup(createBackup(S)));expect(orderedRoutines(restored).map(r=>r.id)).toEqual([...original.routines.slice(1).map(r=>r.id),'r0']);expect(restored.week).toEqual(original.week);expect(restored.workouts).toEqual(original.workouts);expect(restored.active).toEqual({...original.active,sessionOrigin:{type:'planned',routineId:'r1'}})
})
it('migrates missing, stale and duplicate IDs additively and appends new routines',()=>{
 const S=state(3);S.routineOrder=['gone','r2','r2'];const next=migrateState(S);expect(next.routineOrder).toEqual(['r2','r0','r1']);expect(S.routineOrder).toEqual(['gone','r2','r2']);expect(migrateState(next)).toEqual(next);next.routines.push({id:'new',ex:[]});expect(orderedRoutines(next).at(-1).id).toBe('new');reorderRoutine(next,'gone','r0');expect(next.routineOrder).toEqual(['r2','r0','r1'])
})
it('treats concurrent display orders as one cloud conflict, preserving schedule order',()=>{
 const a=migrateState(state(3)),b=structuredClone(a);reorderRoutine(b,'r2','r0');const r=mergeTGymStates(a,b);expect(r.conflicts.some(c=>c.path==='routineOrder')).toBe(true);expect(r.merged.routineOrder).toEqual(a.routineOrder);expect(r.merged.week).toEqual(a.week)
})
