import { describe, expect, it } from 'vitest'
import { streakVisual } from './streak-visual.js'

describe('streakVisual', () => {
  it.each([[0,'yellow'],[6,'yellow'],[7,'orange'],[13,'orange'],[14,'redgold'],[29,'redgold'],[30,'blue'],[49,'blue'],[50,'purple'],[99,'purple'],[100,'legend'],[365,'legend']])('maps %s to %s', (n, tier) => expect(streakVisual(n).tier).toBe(tier))
  it('is empty at zero and fully filled from the first activity date through every tier', () => {
    expect(streakVisual(0)).toMatchObject({ active: false, progress: 0, intensity: 0 })
    for (const count of [1, 6, 7, 14, 30, 50, 99, 100, 365, 1000]) {
      expect(streakVisual(count)).toMatchObject({ active: true, progress: 1, intensity: 1 })
    }
  })
})
