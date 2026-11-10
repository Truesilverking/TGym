// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  emitRestStart,
  emitRestEnd,
  emitWorkoutFinish,
  isSpotifreeSyncEnabled,
  launchSpotifree,
  SPOTIFREE_BUS_CHANNEL,
  SPOTIFREE_STORAGE_KEY_REST,
  clearSpotifreeRest,
} from './spotifree-sync.js'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

describe('spotifree-sync bridge', () => {
  let postedMessages = []
  let channels = []

  class MockBroadcastChannel {
    constructor(name) {
      this.name = name
      this.close = vi.fn()
      channels.push(this)
    }
    postMessage(data) {
      postedMessages.push(data)
    }
  }

  beforeEach(() => {
    clearSpotifreeRest()
    postedMessages = []
    channels = []
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    localStorage.clear()
    useStore.setState({
      S: {
        ...structuredClone(DEF),
        enableSpotifreeSync: true,
      },
      user: null,
    })
    useUI.setState({ timer: null })
  })

  afterEach(() => {
    useUI.getState().stopRest()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('emitRestStart posts REST_START and writes tgym_active_rest to localStorage', () => {
    const endsAt = Date.now() + 90000
    emitRestStart(90, endsAt, 90, 'Bench Press')

    expect(postedMessages).toHaveLength(1)
    expect(postedMessages[0]).toEqual({
      type: 'REST_START',
      seconds: 90,
      endsAt,
      total: 90,
      exerciseName: 'Bench Press',
    })

    const raw = localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw)
    expect(parsed.endsAt).toBe(endsAt)
    expect(parsed.total).toBe(90)
    expect(parsed.exerciseName).toBe('Bench Press')
    expect(typeof parsed.startedAt).toBe('number')
  })

  it('emitRestEnd posts REST_END and removes tgym_active_rest from localStorage', () => {
    localStorage.setItem(
      SPOTIFREE_STORAGE_KEY_REST,
      JSON.stringify({ endsAt: Date.now() + 60000, total: 60 })
    )

    emitRestEnd()

    expect(postedMessages).toHaveLength(1)
    expect(postedMessages[0]).toEqual({ type: 'REST_END' })
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
  })

  it('emitWorkoutFinish posts WORKOUT_FINISH with calculated elapsed duration', () => {
    const mockWorkout = {
      id: 'w-123',
      d: '2026-10-26',
      start: Date.now() - 3600000,
      end: Date.now(),
    }

    emitWorkoutFinish(mockWorkout)

    expect(postedMessages).toHaveLength(1)
    expect(postedMessages[0].type).toBe('WORKOUT_FINISH')
    expect(postedMessages[0].workout.id).toBe('w-123')
    expect(postedMessages[0].workout.d).toBe('2026-10-26')
    expect(postedMessages[0].workout.duration).toBeGreaterThan(0)
  })

  it('suppresses emissions and storage when enableSpotifreeSync is false', () => {
    useStore.setState({
      S: {
        ...structuredClone(DEF),
        enableSpotifreeSync: false,
      },
    })

    expect(isSpotifreeSyncEnabled()).toBe(false)

    emitRestStart(60, Date.now() + 60000, 60, 'Squat')
    emitRestEnd()
    emitWorkoutFinish({ id: 'w-1', d: '2026-10-26', start: Date.now() })

    expect(postedMessages).toHaveLength(0)
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
  })

  it('connects seamlessly with useUI startRest and stopRest', () => {
    postedMessages = []
    useUI.getState().startRest(45)

    expect(postedMessages.some(m => m.type === 'REST_START' && m.seconds === 45)).toBe(true)
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).not.toBeNull()

    postedMessages = []
    useUI.getState().stopRest()

    expect(postedMessages.some(m => m.type === 'REST_END')).toBe(true)
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
  })

  it('updates Spotifree rest on useUI addRest', () => {
    useUI.getState().startRest(60)
    postedMessages = []

    useUI.getState().addRest(30)
    expect(postedMessages.some(m => m.type === 'REST_START')).toBe(true)

    postedMessages = []
    useUI.getState().addRest(-120) // Cancels rest
    expect(postedMessages.some(m => m.type === 'REST_END')).toBe(true)
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
  })

  it('launchSpotifree opens spotifree uri or fallback without throwing', async () => {
    const originalOpen = window.open
    const openMock = vi.fn()
    window.open = openMock

    const res = await launchSpotifree('pl-workout')
    expect(res).toBe(true)

    window.open = originalOpen
  })

  it('never emits an end before first start or when replacing a running rest', () => {
    useUI.getState().stopRest()
    expect(postedMessages).toEqual([])
    useUI.getState().startRest(60)
    useUI.getState().startRest(90)
    expect(postedMessages.map(message => message.type)).toEqual(['REST_START', 'REST_START'])
    useUI.getState().stopRest()
    useUI.getState().stopRest()
    expect(postedMessages.map(message => message.type)).toEqual(['REST_START', 'REST_START', 'REST_END'])
  })

  it('cleans announced rest immediately on opt-out without stopping the TGym timer', () => {
    useUI.getState().startRest(60)
    const timer = useUI.getState().timer
    postedMessages = []
    useStore.getState().update(s => { s.enableSpotifreeSync = false })
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
    expect(useUI.getState().timer).toBe(timer)
    useUI.getState().stopRest()
    expect(postedMessages).toEqual([])
  })

  it('closes every send-only channel even if posting fails', () => {
    emitRestStart(60)
    expect(channels[0].name).toBe(SPOTIFREE_BUS_CHANNEL)
    expect(channels[0].close).toHaveBeenCalledOnce()
    vi.spyOn(MockBroadcastChannel.prototype, 'postMessage').mockImplementation(() => { throw new Error('closed') })
    expect(() => emitRestEnd()).not.toThrow()
    expect(channels[1].close).toHaveBeenCalledOnce()
  })

  it.each([Infinity, NaN, Symbol('invalid'), -1, 0])('rejects invalid bridge rest seconds %s', seconds => {
    expect(() => emitRestStart(seconds)).not.toThrow()
    expect(postedMessages).toEqual([])
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
  })

  it('rejects nonfinite deadlines/totals without writing a malformed rest', () => {
    emitRestStart(60, Infinity, 60)
    emitRestStart(60, Date.now() + 60000, NaN)
    expect(postedMessages).toEqual([])
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
  })

  it('clears stale rest metadata when no saved rest can be restored', () => {
    emitRestStart(60)
    postedMessages = []
    useUI.getState().restoreRest()
    expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
    expect(postedMessages).toEqual([])
  })

  it('cleans malformed or expired rest metadata without announcing a phantom end', () => {
    for (const value of ['bad JSON', JSON.stringify({ endsAt: Date.now() - 1000, total: 60 })]) {
      localStorage.setItem(SPOTIFREE_STORAGE_KEY_REST, value)
      emitRestEnd()
      expect(localStorage.getItem(SPOTIFREE_STORAGE_KEY_REST)).toBeNull()
      expect(postedMessages).toEqual([])
    }
  })

  it('announces a completed workout once and ignores active or invalid sessions', () => {
    const workout = { id: 'finish-dedupe', d: '2026-10-27', start: 100000, end: 160000 }
    emitWorkoutFinish({ ...workout, end: undefined })
    emitWorkoutFinish({ ...workout, end: Infinity })
    emitWorkoutFinish(workout)
    emitWorkoutFinish(structuredClone(workout))
    expect(postedMessages).toEqual([{ type: 'WORKOUT_FINISH', workout: { id: workout.id, d: workout.d, duration: 60000 } }])
  })

  it('opens HTTPS directly without navigating the training page or scheduling a popup', async () => {
    const initialUrl = window.location.href
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const timeout = vi.spyOn(globalThis, 'setTimeout')
    expect(await launchSpotifree()).toBe(true)
    expect(open).toHaveBeenCalledWith('https://spotifree.app', '_blank', 'noopener,noreferrer')
    expect(window.location.href).toBe(initialUrl)
    expect(timeout).not.toHaveBeenCalled()
    open.mockClear()
    expect(await launchSpotifree('../evil?token=secret')).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})
