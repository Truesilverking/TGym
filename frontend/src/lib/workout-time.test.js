import { describe, expect, it } from 'vitest'
import { finishWorkoutClock, pauseWorkoutClock, resumeWorkoutClock, workoutElapsedMs } from './workout-time.js'

const min = 60000
describe('workout duration clock', () => {
  it('freezes while paused and resumes without a jump', () => {
    const paused = pauseWorkoutClock({ start: 0 }, 10 * min)
    expect(workoutElapsedMs(paused, 12 * min)).toBe(10 * min)
    const resumed = resumeWorkoutClock(paused, 12 * min)
    expect(workoutElapsedMs(resumed, 13 * min)).toBe(11 * min)
  })
  it('excludes the open finish dialog from final duration', () => {
    const finished = finishWorkoutClock(pauseWorkoutClock({ start: 0 }, 45 * min), 48 * min)
    expect(finished.end).toBe(45 * min)
    expect(workoutElapsedMs(finished)).toBe(45 * min)
  })
  it('is idempotent and supports historical workouts', () => {
    const active = pauseWorkoutClock({ start: min }, 5 * min)
    expect(pauseWorkoutClock(active, 6 * min)).toBe(active)
    expect(workoutElapsedMs({ start: min, end: 11 * min })).toBe(10 * min)
  })
  it('accumulates several pauses exactly once', () => {
    const first = resumeWorkoutClock(pauseWorkoutClock({ start: 0 }, 10 * min), 12 * min)
    const second = resumeWorkoutClock(pauseWorkoutClock(first, 15 * min), 16 * min)
    expect(workoutElapsedMs(second, 20 * min)).toBe(17 * min)
  })
})


it('preserves a pause at timestamp zero and freezes the actual end', () => {
  const paused = pauseWorkoutClock({ start: 0 }, 0)
  expect(workoutElapsedMs(paused, 60000)).toBe(0)
  const finished = finishWorkoutClock(paused, 60000)
  expect(finished.end).toBe(0)
  expect(finishWorkoutClock(finished, 120000)).toBe(finished)
})
it.each([[60, 65, 70, 65], [35, 40, 45, 40]])('excludes decision time %s to %s', (pause, resume, now, expected) => {
  const restored = JSON.parse(JSON.stringify(pauseWorkoutClock({ start: 0 }, pause * min)))
  expect(workoutElapsedMs(restored, resume * min)).toBe(pause * min)
  expect(workoutElapsedMs(resumeWorkoutClock(restored, resume * min), now * min)).toBe(expected * min)
})
it.each([[60,70],[35,40]])('saves the pause instant %s even when confirmed at %s', (pause, confirm) => {
  const finished = finishWorkoutClock(pauseWorkoutClock({start: 0}, pause * min), confirm * min)
  expect(finished.end).toBe(pause * min)
  expect(workoutElapsedMs(finished)).toBe(pause * min)
})
