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
    expect(finished.end).toBe(48 * min)
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
