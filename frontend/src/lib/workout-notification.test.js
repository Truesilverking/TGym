import {describe,it,expect} from 'vitest'
import {workoutNotificationState} from './workout-notification.js'
describe('native workout notification clock payload',()=>{
  it('uses timestamp elapsed and optional rest deadline',()=>{
    const a={start:1000,lastMeaningfulWorkoutActivityAt:2000,name:'Upper'}
    expect(workoutNotificationState(a,{endsAt:100000},50000)).toMatchObject({active:true,elapsedMs:49000,restEndsAt:100000,paused:false})
    expect(workoutNotificationState(a,{endsAt:30000},50000).restEndsAt).toBe(0)
  })
  it('freezes at completion until explicitly resumed and removes terminal sessions',()=>{
    const a={start:1000,timerPausedAt:6000}
    expect(workoutNotificationState(a,null,600000)).toMatchObject({elapsedMs:5000,paused:true,autoFinishAt:0})
    expect(workoutNotificationState(null,null)).toEqual({active:false})
    expect(workoutNotificationState({...a,end:6000},null)).toEqual({active:false})
  })
})

it('updates only the current phase set without resetting timers or exposing exercise data',()=>{
 const now=50000,a={start:1000,name:'Private routine',dailyPlanIndex:1,dailyPlanTotal:3,entries:[{id:'0025',sets:[{warmup:true,done:true},{done:true},{done:false},{done:false}]}]}
 const running=workoutNotificationState(a,{endsAt:70000},now)
 expect(running).toMatchObject({setNumber:2,setLabel:'SET 2',restEndsAt:70000,elapsedMs:49000,workoutLabel:'WORKOUT'})
 for(const key of ['name','exercise','context','progressLabel','dailyLabel','openLabel'])expect(running).not.toHaveProperty(key)
 a.entries[0].sets[2].done=true
 expect(workoutNotificationState(a,{endsAt:70000},now+1000)).toMatchObject({setNumber:3,elapsedMs:50000,restEndsAt:70000})
 expect(workoutNotificationState({...a,timerPausedAt:40000},null,now)).toMatchObject({paused:true,elapsedMs:39000,autoFinishAt:0})
 a.entries[0].sets[3].done=true
 expect(workoutNotificationState({...a,timerPausedAt:40000},null,now).setNumber).toBe(3)
 expect(workoutNotificationState({...a,end:40000},null,now)).toEqual({active:false})
})
it('handles empty/restored and warmup sessions without inventing a set',()=>{
 expect(workoutNotificationState({start:1000,entries:[]},null,2000).setLabel).toBe('')
 expect(workoutNotificationState({start:1000,entries:[{sets:[{warmup:true},{warmup:true},{done:false}]}]},null,2000).setLabel).toBe('SET 1')
})

it('restores the persisted deadline and uses compact Spanish copy',async()=>{
 const { _setLangState }=await import('./i18n-core.js')
 _setLangState('es',{})
 try {expect(workoutNotificationState({start:1000,restTimer:{endsAt:10000,total:90},entries:[{sets:[{done:false}]}]},null,5000)).toMatchObject({workoutLabel:'ENTRENO',restLabel:'DESCANSO',setLabel:'SERIE 1',restEndsAt:10000})}
 finally {_setLangState('en',{})}
})
