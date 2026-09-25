// @vitest-environment happy-dom
// useUI pulls in api.js, which reads navigator.userAgent at module scope.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { useUI } from './useUI.js'

// "Off" has to hold at the timer itself, not at the four places that start one — the same
// reason the rest-after-a-set rule is a shared condition rather than four copies.
describe('rest timer set to Off', () => {
  beforeEach(() => { vi.useFakeTimers(); useUI.setState({ timer: null }) })
  afterEach(() => { useUI.getState().stopRest(); vi.useRealTimers() })

  it('starts nothing', () => {
    useUI.getState().startRest(0)
    expect(useUI.getState().timer).toBe(null)
  })

  it('stops a rest that is already running', () => {
    useUI.getState().startRest(90)
    expect(useUI.getState().timer).not.toBe(null)
    useUI.getState().startRest(0)
    expect(useUI.getState().timer).toBe(null)
  })

  it('still runs for a real duration', () => {
    useUI.getState().startRest(90)
    expect(useUI.getState().timer.total).toBe(90)
  })
})

it('runs dismissal once only when a sheet is actually closed', () => {
  const onClose = vi.fn()
  const sheet = useUI.getState().openSheet(() => null, { onClose })
  expect(onClose).not.toHaveBeenCalled()
  sheet.close()
  sheet.close()
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('persists and restores the same rest deadline across reload without touching workout time', async () => {
  const {useStore,DEF}=await import('./useStore.js')
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-25T12:00:00Z'))
  const state=structuredClone(DEF);state.active={id:'restore-rest',start:Date.now()-60000,lastMeaningfulWorkoutActivityAt:Date.now()-10000,entries:[]}
  useStore.setState({S:state,user:null})
  try {
    useUI.getState().startRest(90)
    const saved=JSON.parse(localStorage.getItem('gym_state_v1'));const deadline=saved.active.restTimer.endsAt
    expect(saved.active.start).toBe(state.active.start);expect(saved.active.lastMeaningfulWorkoutActivityAt).toBe(state.active.lastMeaningfulWorkoutActivityAt)
    useUI.getState().stopRest();vi.advanceTimersByTime(20000);useStore.getState().replaceState(saved)
    useUI.getState().restoreRest();expect(useUI.getState().timer).toMatchObject({endsAt:deadline,left:70,total:90})
    useUI.getState().addRest(15);expect(useStore.getState().S.active.restTimer.endsAt).toBe(deadline+15000)
    vi.advanceTimersByTime(86000);expect(useUI.getState().timer).toBeNull();expect(useStore.getState().S.active.restTimer).toBeUndefined()
    useStore.getState().replaceState(saved);useUI.getState().restoreRest();expect(useUI.getState().timer).toBeNull();expect(useStore.getState().S.active.restTimer).toBeUndefined()
  } finally {useUI.getState().stopRest();vi.useRealTimers()}
})

it('edits rest against its deadline even if background rendering was suspended',()=>{
 vi.useFakeTimers();vi.setSystemTime(100000)
 try {useUI.getState().startRest(90);vi.setSystemTime(130000);useUI.getState().addRest(15);expect(useUI.getState().timer).toMatchObject({left:75,endsAt:205000});vi.setSystemTime(205100);useUI.getState().addRest(-15);expect(useUI.getState().timer).toBeNull()}
 finally {useUI.getState().stopRest();vi.useRealTimers()}
})
