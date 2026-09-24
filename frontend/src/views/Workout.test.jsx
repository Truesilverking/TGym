import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { workoutCompleteSheet } from '../sheets.jsx'

const mocks = vi.hoisted(() => {
  const state = {
    S: null,
    startRest: vi.fn(),
    stopRest: vi.fn(),
    topWeightSheet: vi.fn(),
  }
  state.storeSnapshot = () => ({
    S: state.S,
    user: null,
    update: mut => mut(state.S),
  })
  state.uiSnapshot = () => ({
    work: null,
    startRest: state.startRest,
    stopRest: state.stopRest,
    startWork: vi.fn(),
    toast: vi.fn(),
  })
  return state
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.storeSnapshot())
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.uiSnapshot()) : mocks.uiSnapshot()
  useUI.getState = mocks.uiSnapshot
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  startFlow: vi.fn(),
  exercisePicker: vi.fn(),
  exConfigSheet: vi.fn(),
  exerciseDetailSheet: vi.fn(),
  topWeightSheet: mocks.topWeightSheet,
  finishWorkout: vi.fn(),
  workoutCompleteSheet: vi.fn(),
  confirmSheet: vi.fn(),
  // Both note sheets belong here even though the tests never open one: Workout.jsx reads
  // sessionNoteSheet during render, so a missing export is a render crash, not a no-op.
  exerciseNoteSheet: vi.fn(),
  sessionNoteSheet: vi.fn(),
}))
vi.mock('../components/Media.jsx', () => ({ default: () => null }))
// api.js reads navigator.userAgent at module scope. This file installs its own DOM inside the
// tests rather than declaring a vitest environment, so it must not depend on an ambient one.
vi.mock('../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})),
  IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))

let dom
let root
let container

function exercise(id, sets, extra = {}) {
  return {
    id,
    target: { mode: 'reps', reps: 5, weight: 60, bodyweight: false },
    sets: sets.map(done => ({ w: 60, r: 5, done })),
    ...extra,
  }
}

function workout(entries, cur = 0) {
  return {
    unit: 'kg', restSec: 90, sound: false, effort: 'none', gifSize: 'full',
    workouts: [], exWeights: {}, routines: [],
    active: { id: 'active', name: 'Test workout', start: Date.now(), cur, entries },
  }
}

function installDom() {
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'Blob']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
}

async function mount(entries, cur = 0, configure = null) {
  mocks.S = workout(entries, cur)
  configure?.(mocks.S)
  installDom()
  await act(async () => { root.render(React.createElement(Workout)) })
}

async function unmount() {
  if (!root) return
  await act(async () => { root.unmount() })
  root = null
  container = null
  dom = null
}

async function toggleSet(index) {
  const checkbox = container.querySelectorAll('[role="checkbox"]')[index]
  expect(checkbox).toBeTruthy()
  await act(async () => { checkbox.dispatchEvent(new dom.Event('click', { bubbles: true })) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await unmount()
})

describe('Workout set completion flow', () => {
  it('reopens the finish decision once for restored completed work, ignoring unchecked warmups', async () => {
    await mount([exercise('restored', [false, true])], 0, S => {
      S.active.entries[0].sets[0].phase = 'warmup'
      S.active.timerPausedAt = Date.now()
    })
    expect(workoutCompleteSheet).toHaveBeenCalledOnce()
    await act(async () => { root.render(React.createElement(Workout)) })
    expect(workoutCompleteSheet).toHaveBeenCalledOnce()
  })

  it('does not reopen the finish decision after explicit Continue survives restore', async () => {
    await mount([exercise('continued', [true])], 0, S => {
      S.active.timerContinuedAt = Date.now()
    })
    expect(workoutCompleteSheet).not.toHaveBeenCalled()
  })

  it('pauses on completion out of order and only continues after the explicit button', async () => {
    await mount([exercise('first', [false], { asked: true }), exercise('last', [true])])
    await toggleSet(0)
    const pausedAt = mocks.S.active.timerPausedAt
    expect(pausedAt).toBeGreaterThan(0)
    await toggleSet(0)
    expect(mocks.S.active.timerPausedAt).toBe(pausedAt)
    await act(async () => { root.render(React.createElement(Workout)) })
    const resume = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Continue workout'))
    expect(resume).toBeTruthy()
    await act(async () => { resume.dispatchEvent(new dom.Event('click', { bubbles: true })) })
    expect(mocks.S.active.timerPausedAt).toBeUndefined()
    expect(mocks.S.active.pausedDurationMs).toBeGreaterThanOrEqual(0)
  })

  it('does not pause just because the last listed exercise is done', async () => {
    await mount([exercise('first', [false]), exercise('last', [false], { asked: true })], 1)
    await toggleSet(0)
    expect(mocks.S.active.timerPausedAt).toBeUndefined()
  })

  it('starts rest after a non-final ordinary set, but stops rest without restarting it on the final set', async () => {
    await mount([exercise('plain-bench', [false, false, false])])
    await toggleSet(0)

    expect(mocks.startRest).toHaveBeenCalledOnce()
    expect(mocks.startRest).toHaveBeenCalledWith(90)
    expect(mocks.stopRest).not.toHaveBeenCalled()

    await unmount()
    vi.clearAllMocks()
    await mount([exercise('plain-treadmill', [false], {
      target: { mode: 'cardio', min: 20, speed: 8 },
    })])
    await toggleSet(0)

    expect(mocks.stopRest).toHaveBeenCalledOnce()
    expect(mocks.startRest).not.toHaveBeenCalled()
  })

  it('leaves a completed superset selected while its top-weight sheet owns the advance choice', async () => {
    const group = 'superset-1'
    await mount([
      exercise('superset-a', [true, true, true], { sg: group, asked: true }),
      exercise('superset-b', [true, true, false], { sg: group }),
      exercise('next-exercise', [false, false, false]),
    ], 1)
    await toggleSet(5)

    expect(mocks.topWeightSheet).toHaveBeenCalledWith(1)
    expect(mocks.S.active.cur).toBe(1)
    expect(mocks.startRest).toHaveBeenCalledWith(90)
  })
})

describe('Top and back-off targets', () => {
  it('names zero effort and targets Failure while storing and stepping numeric RIR', async () => {
    await mount([{ id: 'squat', target: { mode: 'reps', reps: 6, targetRirMin: 0, targetRirMax: 0 }, sets: [{ w: 50, r: 6, rir: 0, done: false }] }], 0, S => { S.effort = 'rir' })
    const input = container.querySelector('.stp.eff input')
    expect(input.value).toBe('Failure')
    expect(input.getAttribute('aria-label')).toBe('RIR')
    expect(container.querySelector('.set-metric.eff label').textContent).toContain('Failure')
    expect(mocks.S.active.entries[0].sets[0].rir).toBe(0)
    await act(async () => { container.querySelector('.stp.eff button[aria-label="Increase"]').click() })
    expect(mocks.S.active.entries[0].sets[0].rir).toBe(0.5)
  })

  it('shows the full target range even when a legacy profile has effort disabled', async () => {
    await mount([{ id: 'squat', target: { mode: 'reps', reps: 6, targetRirMin: 1, targetRirMax: 2 }, sets: [{ w: 50, r: 6, rir: 2, done: true }] }], 0, S => { S.effort = 'none' })
    expect(container.querySelector('.set-metric.eff label').textContent).toContain('1–2')
    expect(container.querySelector('.set-metric.eff label').textContent).toContain('RIR')
  })
  it('aligns each rep range and RIR value below its matching column heading', async () => {
    const target = { mode: 'reps', sets: 3, repsMin: 4, reps: 6, backoffRepsMin: 6, backoffRepsMax: 8,
      weight: 100, setScheme: 'topback', topRir: 1, backoffRir: 3 }
    await mount([{ id: 'topback-squat', target, sets: [
      { role: 'top', w: 100, r: 6, rir: null, done: false },
      { role: 'backoff', w: 90, r: 8, rir: null, done: false },
      { role: 'backoff', w: 90, r: 8, rir: null, done: false },
    ] }], 0, S => { S.effort = 'rir' })

    const rows = [...container.querySelectorAll('.set-console')]
    expect([...container.querySelectorAll('.set-phase')].map(x=>x.textContent)).toEqual(['Top set','Back-off sets'])
    expect(rows.map(row=>[row.querySelector('.set-metric.r label').textContent,row.querySelector('.set-metric.eff label').textContent])).toEqual([['Reps4–6','RIR1'],['Reps6–8','RIR3'],['Reps6–8','RIR3']])
    expect(rows[0].querySelector('.set-metric.w label').textContent).toBe('Weight (kg)')

  })
})

describe('superset flow survives an exercise being removed mid-session', () => {
  // removeActiveExercise splices A.entries, shifting every index above the removal down.
  // The high-water marks are index-keyed, so without re-baselining the shifted exercise
  // inherits its predecessor's mark and its next completed set reads as an uncheck/re-check
  // — no advance, and no rest at the end of the round.
  it('still advances and rests for sets completed after a removal', async () => {
    // warm(2 sets, both done) ahead of a bench/row superset with nothing done yet.
    await mount([
      exercise('warm', [true, true]),
      exercise('bench', [false, false], { sg: 'g1' }),
      exercise('row', [false, false], { sg: 'g1' }),
    ], 1)

    // Drop the first exercise: bench moves 1 -> 0, row moves 2 -> 1.
    // Stale marks would be [2, 0, 0] against entries that are now [bench, row].
    await act(async () => {
      mocks.S.active.entries.splice(0, 1)
      mocks.S.active.cur = 0
      root.render(React.createElement(Workout))
    })
    mocks.startRest.mockClear()

    // First member of the group: real progress, so the flow advances to the partner.
    await toggleSet(0)
    await act(async () => { root.render(React.createElement(Workout)) })
    expect(mocks.S.active.cur).toBe(1)

    // Partner closes the round (each still has a second set), which is what starts the rest.
    await toggleSet(2)
    expect(mocks.startRest).toHaveBeenCalledWith(90)
  })
})

describe('independent per-side confirmations',()=>{
  it('retains 10 reps and only completes after both sides; undo preserves the other side',async()=>{
    await mount([{id:'one-arm',target:{mode:'reps',side:true,repsPerSide:true,reps:10},sets:[{w:20,r:10,done:false}]}])
    const buttons=()=>[...container.querySelectorAll('.set-sides button')]
    await act(async()=>buttons()[0].click())
    expect(mocks.S.active.entries[0].sets[0]).toMatchObject({r:10,leftDone:true,rightDone:false,done:false})
    expect(mocks.startRest).not.toHaveBeenCalled()
    // The mocked store mutates in place; explicitly rerender to reflect the saved state.
    await act(async()=>root.render(<Workout />))
    await act(async()=>buttons()[1].click())
    expect(mocks.S.active.entries[0].sets[0]).toMatchObject({r:10,leftDone:true,rightDone:true,done:true})
    await act(async()=>root.render(<Workout />))
    await act(async()=>buttons()[0].click())
    expect(mocks.S.active.entries[0].sets[0]).toMatchObject({r:10,leftDone:false,rightDone:true,done:false})
  })
})
