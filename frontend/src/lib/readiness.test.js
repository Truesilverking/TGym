// @vitest-environment happy-dom
import { it, expect, beforeEach } from 'vitest'
import { calculateReadinessScore, getReadiness, logReadiness } from './readiness.js'
import { useStore, DEF } from '../store/useStore.js'

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: null })
})

it('calculates optimal readiness score for peak inputs', () => {
  const result = calculateReadinessScore({ sleep: 5, soreness: 1, energy: 5 })
  expect(result.score).toBe(100)
  expect(result.tier).toBe('high')
  expect(result.loadFactor).toBe(1.02)
})

it('calculates low readiness and suggests load reduction for exhausted inputs', () => {
  const result = calculateReadinessScore({ sleep: 1, soreness: 5, energy: 1 })
  expect(result.score).toBe(0)
  expect(result.tier).toBe('low')
  expect(result.loadFactor).toBe(0.95)
  expect(result.rirDelta).toBe(1)
})

it('stores and retrieves daily readiness in store', () => {
  const date = '2026-10-26'
  logReadiness(date, { sleep: 4, soreness: 2, energy: 4 })
  const saved = getReadiness(useStore.getState().S, date)
  expect(saved).not.toBeNull()
  expect(saved.score).toBeGreaterThan(60)
  expect(saved.sleep).toBe(4)
})
