import { describe, expect, it } from 'vitest'
import { streakVisual } from './streak-visual.js'

describe('streakVisual', () => {
  it.each([[0,'yellow'],[6,'yellow'],[7,'orange'],[13,'orange'],[14,'redgold'],[29,'redgold'],[30,'blue'],[49,'blue'],[50,'purple'],[99,'purple'],[100,'legend'],[365,'legend']])('maps %s to %s', (n, tier) => expect(streakVisual(n).tier).toBe(tier))
  it('is empty at zero and resets progress at tier boundaries', () => {
    expect(streakVisual(0)).toMatchObject({ active: false, progress: 0, intensity: 0 })
    expect(streakVisual(7).progress).toBeLessThan(streakVisual(6).progress)
    expect(streakVisual(100).progress).toBeLessThan(streakVisual(99).progress)
  })
})
