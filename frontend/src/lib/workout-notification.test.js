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

it('separates work progress, current set and daily routine order across paused/rest states',()=>{
 const now=50000,a={start:1000,name:'Upper',dailyPlanIndex:1,dailyPlanTotal:3,entries:[{id:'0025',sets:[{warmup:true,done:true},{done:true},{done:false}]}]}
 const running=workoutNotificationState(a,{endsAt:70000},now)
 expect(running).toMatchObject({completedSets:1,totalSets:2,dailyLabel:'Workout 2 of 3',restEndsAt:70000,openLabel:'Open workout'})
 expect(running.context).toContain('Set 3 of 3')
 expect(workoutNotificationState({...a,timerPausedAt:40000},null,now)).toMatchObject({paused:true,elapsedMs:39000,workoutLabel:'Workout paused',openLabel:'Resume',autoFinishAt:0})
 a.entries[0].sets[2].done=true
 expect(workoutNotificationState({...a,timerPausedAt:40000},null,now)).toMatchObject({completedSets:2,totalSets:2,workoutLabel:'Workout complete!'})
})
