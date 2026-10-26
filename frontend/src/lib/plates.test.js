import { describe, it, expect } from 'vitest'
import { platesPerSide, groupPlates, plateColor, roundToAvailablePlates, BAR_WEIGHTS } from './plates.js'

describe('platesPerSide', () => {
  it('loads the heaviest plates first on each side', () => {
    expect(platesPerSide(100, { unit: 'kg', bar: 20 })).toEqual({ perSide: [25, 15], achieved: 100, remainder: 0, belowBar: false, bar: 20 })
    expect(platesPerSide(142.5, { unit: 'kg', bar: 20 }).perSide).toEqual([25, 25, 10, 1.25])
  })

  it('handles change plates without float drift', () => {
    const r = platesPerSide(23.5, { unit: 'kg', bar: 20 })
    expect(r.perSide).toEqual([1.25, 0.5])
    expect(r.achieved).toBe(23.5)
    expect(r.remainder).toBe(0)
  })

  it('reports the closest reachable load when the target cannot be made', () => {
    const r = platesPerSide(101.2, { unit: 'kg', bar: 20 })   // 40.6 per side; smallest plate is 0.5
    expect(r.perSide).toEqual([25, 15, 0.5])
    expect(r.achieved).toBe(101)
    expect(r.remainder).toBe(0.2)
  })

  it('flags targets at or below the bar', () => {
    expect(platesPerSide(20, { bar: 20 })).toMatchObject({ perSide: [], achieved: 20, belowBar: false })
    expect(platesPerSide(15, { bar: 20 })).toMatchObject({ perSide: [], belowBar: true })
  })

  it('works in pounds with a 45 lb bar', () => {
    expect(platesPerSide(225, { unit: 'lb', bar: 45 }).perSide).toEqual([55, 35])
    expect(platesPerSide(135, { unit: 'lb', bar: BAR_WEIGHTS.lb[0] }).perSide).toEqual([45])
  })

  it('respects a restricted plate inventory', () => {
    expect(platesPerSide(100, { bar: 20, plates: [20, 10, 5] }).perSide).toEqual([20, 20])
  })
})

describe('roundToAvailablePlates', () => {
  it('snaps fractional weights down to what available plates can build', () => {
    // With smallest plate 2.5 kg, 102.5 kg cannot be loaded on a 20 kg bar (needs 41.25 per side)
    // Achieved is 100 kg (40 per side: 20+20)
    expect(roundToAvailablePlates(102.5, { bar: 20, plates: [20, 10, 5, 2.5] })).toBe(100)
    // If 1.25 kg plate is available: 102.5 can be made exactly (20 + 2*41.25 -> 20 + 2*(20+20+1.25) = 102.5)
    expect(roundToAvailablePlates(102.5, { bar: 20, plates: [20, 10, 5, 2.5, 1.25] })).toBe(102.5)
  })
})

describe('groupPlates / plateColor', () => {
  it('groups consecutive plates', () => {
    expect(groupPlates([25, 25, 10, 1.25])).toEqual([{ plate: 25, count: 2 }, { plate: 10, count: 1 }, { plate: 1.25, count: 1 }])
  })
  it('uses calibrated plate colours', () => {
    expect(plateColor(25, 'kg')).toBe('red')
    expect(plateColor(20, 'kg')).toBe('blue')
    expect(plateColor(45, 'lb')).toBe('blue')
    expect(plateColor(7, 'kg')).toBe('steel')
  })
})
