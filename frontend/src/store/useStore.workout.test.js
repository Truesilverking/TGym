// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useStore, DEF } from './useStore.js'
import { resumeWorkoutClock, workoutElapsedMs } from '../lib/workout-time.js'
import {workoutNotificationState} from '../lib/workout-notification.js'
import * as exercises from '../lib/exercises.js'
import * as resources from '../lib/profile-resources.js'

const min = 60000
const session = () => ({id:'w',start:360*min,entries:[{id:'ex',sets:[{done:false}]}]})
describe('persisted workout clock boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(432*min)
    localStorage.clear()
    useStore.setState({S:{...structuredClone(DEF),active:session()},user:null})
  })
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })
  it('writes the final-set pause synchronously before a process can reopen', () => {
    useStore.getState().update(s=>Object.assign(s.active.entries[0].sets[0],{done:true,doneAt:Date.now()}))
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active.timerPausedAt).toBe(432*min)
    expect(workoutElapsedMs(saved.active,540*min)).toBe(72*min)
  })
  it('pagehide repairs a missed completion, but respects explicit Continue', () => {
    const a=session(); Object.assign(a.entries[0].sets[0],{done:true,doneAt:432*min})
    useStore.setState({S:{...structuredClone(DEF),active:a}})
    vi.setSystemTime(540*min)
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.timerPausedAt).toBe(432*min)
    useStore.getState().update(s=>{s.active=resumeWorkoutClock(s.active)})
    window.dispatchEvent(new Event('pagehide'))
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active.timerPausedAt).toBeUndefined()
    expect(workoutElapsedMs(saved.active,541*min)).toBe(73*min)
  })
  it('restores completed imports without counting time since the last logged set', () => {
    const a=session(); Object.assign(a.entries[0].sets[0],{done:true,doneAt:432*min})
    vi.setSystemTime(540*min)
    useStore.getState().replaceState({...structuredClone(DEF),active:a})
    expect(workoutElapsedMs(useStore.getState().S.active)).toBe(72*min)
  })
  it('persists explicit session metadata and ignores automatic timer edits as activity',()=>{
    const a=session();a.lastActivityAt=400*min;a.lastMeaningfulWorkoutActivityAt=400*min
    useStore.setState({S:{...structuredClone(DEF),active:a}})
    useStore.getState().update(s=>{s.active.entries[0].sets[0].sec=30},false,false)
    let saved=JSON.parse(localStorage.getItem('gym_state_v1')).active
    expect(saved).toMatchObject({sessionStartedAt:360*min,lastActivityAt:400*min,sessionStatus:'paused',pauseReason:'inactivity',timerPausedAt:430*min,endedAt:null})
    useStore.getState().update(s=>{s.active.note='A real note'})
    saved=JSON.parse(localStorage.getItem('gym_state_v1')).active
    expect(saved.lastActivityAt).toBe(400*min)
    expect(saved.accumulatedActiveDuration).toBe(70*min)
  })

  it('reconciles the original inactivity cutoff before a returning user can extend it',()=>{
    const a={...session(),lastUserInteractionAt:400*min}
    useStore.setState({S:{...structuredClone(DEF),active:a}})
    useStore.getState().recordInteraction()
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active).toMatchObject({timerPausedAt:430*min,pauseReason:'inactivity',lastUserInteractionAt:432*min,accumulatedActiveDuration:70*min})
    expect(saved.workouts).toEqual([])
    useStore.getState().recordInteraction(440*min)
    expect(useStore.getState().S.active.timerPausedAt).toBe(430*min)
    vi.setSystemTime(500*min)
    useStore.getState().update(s=>{s.active=resumeWorkoutClock(s.active)})
    const resumed=JSON.parse(localStorage.getItem('gym_state_v1')).active
    expect(resumed.pausedDurationMs).toBe(70*min)
    expect(resumed.timerPausedAt).toBeUndefined()
    expect(workoutElapsedMs(resumed,501*min)).toBe(71*min)
  })

  it('background/offline restore uses the same deadline without creating history or changing rows',()=>{
    const a={...session(),lastUserInteractionAt:400*min}
    a.entries[0].sets.push({done:false,r:8})
    useStore.setState({S:{...structuredClone(DEF),active:a}})
    vi.setSystemTime(429*min)
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.timerPausedAt).toBeUndefined()
    const snapshot=JSON.parse(localStorage.getItem('gym_state_v1'))
    vi.setSystemTime(800*min)
    useStore.getState().replaceState(snapshot)
    const restored=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(restored.active).toMatchObject({id:a.id,timerPausedAt:430*min,pauseReason:'inactivity',accumulatedActiveDuration:70*min})
    expect(restored.active.entries).toEqual(a.entries)
    expect(restored.workouts).toEqual([])
    expect(useStore.getState().reconcileActiveClock()).toBe(useStore.getState().S.active)
  })
  it('coalesces touch metadata after the first paint while retaining the original input time',async()=>{
    const active={...session(),lastUserInteractionAt:430*min}
    useStore.setState({S:{...structuredClone(DEF),active,workouts:[{id:'keep',entries:[]}]}})
    const before=useStore.getState().S
    const save=vi.spyOn(localStorage,'setItem')
    try{
      useStore.getState().recordInteraction(432*min,{defer:true})
      useStore.getState().recordInteraction(432*min+10,{defer:true})
      expect(save).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(900)
      const writes=save.mock.calls.filter(([key])=>key==='gym_state_v1')
      expect(writes).toHaveLength(1)
      expect(JSON.parse(writes[0][1]).active.lastUserInteractionAt).toBe(432*min+10)
      expect(useStore.getState().S.workouts).toEqual([{id:'keep',entries:[]}])
      for(const key of ['workouts','routines','customEx','bodyweight','measurements','sounds','reminder'])expect(useStore.getState().S[key]).toBe(before[key])
    }finally{save.mockRestore()}
  })
  it('waits for an input burst while using its latest timestamp for inactivity checks',async()=>{
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:430*min}}})
    const save=vi.spyOn(localStorage,'setItem')
    try{
      useStore.getState().recordInteraction(432*min,{defer:true})
      await vi.advanceTimersByTimeAsync(220)
      useStore.getState().recordInteraction(432*min+220,{defer:true})
      await vi.advanceTimersByTimeAsync(220)
      expect(save).not.toHaveBeenCalled()
      expect(useStore.getState().reconcileActiveClock(432*min+230).lastUserInteractionAt).toBe(432*min+220)
      await vi.advanceTimersByTimeAsync(700)
      expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(1)
    }finally{save.mockRestore()}
  })
  it('flushes queued touch metadata on background before a suspended frame can run',()=>{
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:430*min}}})
    useStore.getState().recordInteraction(432*min,{defer:true})
    window.dispatchEvent(new Event('pagehide'))
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active.lastUserInteractionAt).toBe(432*min)
    expect(saved.workouts).toEqual([])
  })
  it('allows an 1800ms gesture quiet period while using the actual input deadline immediately',async()=>{
    const start=Date.now(),captured=start
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start-50}}})
    const writes=[],original=localStorage.setItem
    const save=vi.spyOn(localStorage,'setItem').mockImplementation(function(key,text){
      if(key==='gym_state_v1')writes.push({at:Date.now(),state:JSON.parse(text)})
      return original.call(this,key,text)
    })
    try{
      useStore.getState().recordInteraction(captured,{defer:true,quietMs:1800})
      const pending=useStore.getState().reconcileActiveClock(captured)
      expect(pending.lastUserInteractionAt).toBe(captured)
      expect(workoutNotificationState(pending,null,captured).autoPauseAt).toBe(captured+30*min)
      await vi.advanceTimersByTimeAsync(800)
      expect(writes).toHaveLength(0)
      await vi.advanceTimersByTimeAsync(1040)
      expect(writes).toHaveLength(1)
      expect(writes[0].at).toBeGreaterThanOrEqual(start+1800)
      expect(writes[0].at).toBeLessThan(start+2000)
      expect(writes[0].state.active.lastUserInteractionAt).toBe(captured)
      expect(writes[0].state.workouts).toEqual([])
    }finally{save.mockRestore()}
  })
  it.each([[0,900],[5000,1840],[Infinity,900]])('sanitizes quietMs %s without escaping its bounded quiet period',async(quietMs,settleAfter)=>{
    const start=Date.now()
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start}}})
    const save=vi.spyOn(localStorage,'setItem')
    try{
      useStore.getState().recordInteraction(start,{defer:true,quietMs})
      await vi.advanceTimersByTimeAsync(799)
      expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(0)
      await vi.advanceTimersByTimeAsync(settleAfter-799)
      expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(1)
    }finally{save.mockRestore()}
  })
  it('keeps the hard two-second limit for continuous input using the extended quiet period',async()=>{
    const start=Date.now()
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start}}})
    const save=vi.spyOn(localStorage,'setItem'),frame=vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
    try{
      for(let input=0;input<20;input++){
        useStore.getState().recordInteraction(Date.now(),{defer:true,quietMs:1800})
        await vi.advanceTimersByTimeAsync(100)
      }
      const writes=save.mock.calls.filter(([key])=>key==='gym_state_v1')
      expect(writes).toHaveLength(1)
      expect(JSON.parse(writes[0][1]).active.lastUserInteractionAt).toBe(start+1900)
      expect(frame).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(2000)
      expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(1)
    }finally{save.mockRestore();frame.mockRestore()}
  })
  it('flushes an extended gesture quiet period before the old native deadline',async()=>{
    const start=Date.now()
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start+100-30*min}}})
    useStore.getState().recordInteraction(start,{defer:true,quietMs:1800})
    await vi.advanceTimersByTimeAsync(1)
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active.lastUserInteractionAt).toBe(start)
    expect(saved.active.timerPausedAt).toBeUndefined()
    expect(workoutNotificationState(saved.active,null).autoPauseAt).toBe(start+30*min)
  })
  it.each(['pagehide','edit'])('does not postpone %s for an extended gesture quiet period',async action=>{
    const start=Date.now()
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start-50}}})
    useStore.getState().recordInteraction(start,{defer:true,quietMs:1800})
    if(action==='pagehide')window.dispatchEvent(new Event('pagehide'))
    else useStore.getState().update(s=>{s.active.note='normal edit'},true,false)
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active.lastUserInteractionAt).toBe(start)
    if(action==='edit')expect(saved.active.note).toBe('normal edit')
    const save=vi.spyOn(localStorage,'setItem')
    try{
      await vi.advanceTimersByTimeAsync(2500)
      expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(0)
    }finally{save.mockRestore()}
  })
  it('coalesces successive navigation taps while exposing their captured clock immediately',async()=>{
    const start=Date.now()
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start}}})
    const save=vi.spyOn(localStorage,'setItem')
    try{
      for(let input=0;input<10;input++){
        useStore.getState().recordInteraction(Date.now(),{defer:true})
        expect(useStore.getState().reconcileActiveClock(Date.now()).lastUserInteractionAt).toBe(start+input*350)
        await vi.advanceTimersByTimeAsync(350)
        if(input<4)expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(0)
      }
      expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(900)
      const writes=save.mock.calls.filter(([key])=>key==='gym_state_v1')
      expect(writes).toHaveLength(2)
      expect(JSON.parse(writes.at(-1)[1]).active.lastUserInteractionAt).toBe(start+3150)
      expect(useStore.getState().S.active.entries).toEqual(session().entries)
    }finally{save.mockRestore()}
  })
  it('merges pending input into the next ordinary edit without replacing its newer activity or rows',async()=>{
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:430*min}}})
    useStore.getState().recordInteraction(432*min,{defer:true})
    vi.setSystemTime(433*min)
    useStore.getState().update(s=>{s.active.entries[0].sets[0].r=12})
    await vi.advanceTimersByTimeAsync(400)
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active.lastUserInteractionAt).toBe(433*min)
    expect(saved.active.entries[0].sets[0].r).toBe(12)
  })

  it('bounds continuous input to two seconds without waiting for RAF or substituting the flush time',async()=>{
    const start=Date.now()
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start}}})
    const save=vi.spyOn(localStorage,'setItem'),frame=vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
    try{
      for(let input=0;input<20;input++){
        useStore.getState().recordInteraction(Date.now(),{defer:true})
        await vi.advanceTimersByTimeAsync(100)
      }
      const writes=save.mock.calls.filter(([key])=>key==='gym_state_v1')
      expect(writes).toHaveLength(1)
      expect(JSON.parse(writes[0][1]).active.lastUserInteractionAt).toBe(start+1900)
      expect(useStore.getState().S.active.timerPausedAt).toBeUndefined()
      expect(frame).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(500)
      expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(1)
    }finally{save.mockRestore();frame.mockRestore()}
  })

  it('flushes before the old native inactivity deadline even during continuous input',async()=>{
    const start=Date.now(),oldDeadline=start+500
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:oldDeadline-30*min}}})
    const save=vi.spyOn(localStorage,'setItem'),frame=vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
    try{
      for(let input=0;input<3;input++){
        useStore.getState().recordInteraction(Date.now(),{defer:true})
        await vi.advanceTimersByTimeAsync(100)
      }
      const writes=save.mock.calls.filter(([key])=>key==='gym_state_v1')
      expect(writes).toHaveLength(1)
      expect(JSON.parse(writes[0][1]).active.lastUserInteractionAt).toBe(start+200)
      expect(workoutNotificationState(useStore.getState().S.active,null).autoPauseAt).toBe(start+200+30*min)
      expect(useStore.getState().S.active.timerPausedAt).toBeUndefined()
      expect(frame).not.toHaveBeenCalled()
    }finally{save.mockRestore();frame.mockRestore()}
  })

  it('does not wait for a quiet period when input arrives immediately before the published deadline',async()=>{
    const start=Date.now()
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start+100-30*min}}})
    useStore.getState().recordInteraction(start,{defer:true})
    await vi.advanceTimersByTimeAsync(1)
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.active.lastUserInteractionAt).toBe(start)
    expect(saved.active.timerPausedAt).toBeUndefined()
    expect(workoutNotificationState(saved.active,null).autoPauseAt).toBe(start+30*min)
  })

  it.each(['edit','background','replace','finish'])('cancels both delayed paths after %s, including a suspended frame',async action=>{
    const start=Date.now()
    useStore.setState({S:{...structuredClone(DEF),active:{...session(),lastUserInteractionAt:start}}})
    const save=vi.spyOn(localStorage,'setItem'),frame=vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999),cancel=vi.spyOn(window,'cancelAnimationFrame')
    try{
      useStore.getState().recordInteraction(start,{defer:true})
      await vi.advanceTimersByTimeAsync(900)
      expect(frame).toHaveBeenCalledOnce()
      if(action==='edit')useStore.getState().update(s=>{s.active.note='kept'})
      if(action==='background')window.dispatchEvent(new Event('pagehide'))
      if(action==='replace')useStore.getState().replaceState({...useStore.getState().S,active:{...session(),id:'replacement',lastUserInteractionAt:Date.now()}})
      if(action==='finish')useStore.getState().update(s=>{s.workouts.push({...s.active,end:Date.now()});s.active=null})
      const writes=save.mock.calls.filter(([key])=>key==='gym_state_v1').length
      expect(writes).toBeGreaterThan(0);expect(cancel).toHaveBeenCalledWith(999)
      await vi.advanceTimersByTimeAsync(2500)
      expect(save.mock.calls.filter(([key])=>key==='gym_state_v1')).toHaveLength(writes)
      if(action==='finish')expect(useStore.getState().S.workouts).toHaveLength(1)
      else expect(useStore.getState().S.workouts).toEqual([])
    }finally{save.mockRestore();frame.mockRestore();cancel.mockRestore()}
  })

  it('keeps global exercise/resource registries current while avoiding rebuilding unchanged collections for clock metadata',()=>{
    useStore.getState().replaceState({...structuredClone(DEF),active:{...session(),lastUserInteractionAt:Date.now()},customEx:[{id:'custom-cached',n:'Cached'}]})
    const before=useStore.getState().S,register=vi.spyOn(exercises,'registerCustom'),retain=vi.spyOn(resources,'retainProfileResources')
    try{
      useStore.getState().recordInteraction()
      expect(register).not.toHaveBeenCalled();expect(retain).not.toHaveBeenCalled()
      for(const key of ['customEx','inbody','customSounds'])expect(useStore.getState().S[key]).toBe(before[key])
      useStore.getState().update(s=>{s.customEx.push({id:'custom-added',n:'Added'})})
      expect(register).toHaveBeenCalledOnce();expect(retain).toHaveBeenCalledOnce()
      expect(exercises.EXIDX['custom-added'].n).toBe('Added')
      useStore.getState().recordInteraction()
      expect(register).toHaveBeenCalledOnce();expect(retain).toHaveBeenCalledOnce()
    }finally{register.mockRestore();retain.mockRestore()}
  })

})
