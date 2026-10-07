// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useStore, DEF } from './useStore.js'
import { resumeWorkoutClock, workoutElapsedMs } from '../lib/workout-time.js'

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

})
