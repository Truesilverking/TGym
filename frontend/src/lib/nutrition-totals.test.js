import { expect, it } from 'vitest'
import { nutritionTotals } from './nutrition-totals.js'

it('rounds fractional servings and aggregate ties with the same policy as displayed numbers', () => {
  expect(nutritionTotals([{ fat: 0.3, qty: 0.5 }]).fat).toBe(0.2)
  expect(nutritionTotals([{ protein: 2.7, qty: 1 }, { protein: 2.7, qty: 2.5 }]).protein).toBe(9.5)
})

it('keeps large finite macro totals finite when scaling for rounding would overflow', () => {
  const result = nutritionTotals([{ fat: Number.MAX_VALUE }, { fat: Number.MAX_VALUE }])
  expect(result.fat).toBe(Number.MAX_VALUE)
  expect(Number.isFinite(result.fat)).toBe(true)
})
