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
