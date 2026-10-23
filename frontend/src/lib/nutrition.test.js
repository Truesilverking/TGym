// @vitest-environment happy-dom
import { it, expect, beforeEach } from 'vitest'
import { calculateTDEE, getDailyNutrition, logFoodItem, removeFoodItem, logWater, updateNutritionGoals } from './nutrition.js'
import { useStore, DEF } from '../store/useStore.js'

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: null })
})

it('calculates TDEE and recommended macros with Mifflin-St Jeor formula', () => {
  const result = calculateTDEE({
    weightKg: 80,
    heightCm: 180,
    sex: 'male',
    age: 25,
    activity: 'moderate',
    goal: 'maintain',
  })

  // BMR = 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
  expect(result.bmr).toBe(1805)
  // TDEE = 1805 * 1.55 = 2797.75 -> ~2798
  expect(result.tdee).toBe(2798)
  expect(result.calories).toBe(2798)
  expect(result.protein).toBeGreaterThan(120)
  expect(result.water).toBe(2800) // 80 * 35
})

it('adjusts calories according to goals (cut, bulk, maintain)', () => {
  const cut = calculateTDEE({ weightKg: 75, heightCm: 175, goal: 'cut' })
  const maintain = calculateTDEE({ weightKg: 75, heightCm: 175, goal: 'maintain' })
  const bulk = calculateTDEE({ weightKg: 75, heightCm: 175, goal: 'bulk' })

  expect(cut.calories).toBe(maintain.calories - 400)
  expect(bulk.calories).toBe(maintain.calories + 300)
})

it('logs food items and accumulates daily totals accurately', () => {
  const date = '2026-10-23'
  logFoodItem(date, {
    name: 'Pechuga de Pollo',
    meal: 'lunch',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 4,
    qty: 2,
  })

  let daily = getDailyNutrition(useStore.getState().S, date)
  expect(daily.items.length).toBe(1)
  expect(daily.totals.calories).toBe(330)
  expect(daily.totals.protein).toBe(62)
  expect(daily.totals.fat).toBe(8)

  // Remove the food item
  const itemId = daily.items[0].id
  removeFoodItem(date, itemId)
  daily = getDailyNutrition(useStore.getState().S, date)
  expect(daily.items.length).toBe(0)
  expect(daily.totals.calories).toBe(0)
})

it('tracks and clamps water intake', () => {
  const date = '2026-10-23'
  logWater(date, 500)
  let daily = getDailyNutrition(useStore.getState().S, date)
  expect(daily.waterMl).toBe(500)

  logWater(date, 250)
  daily = getDailyNutrition(useStore.getState().S, date)
  expect(daily.waterMl).toBe(750)

  // Clamps to zero on negative decrement
  logWater(date, -1000)
  daily = getDailyNutrition(useStore.getState().S, date)
  expect(daily.waterMl).toBe(0)
})

it('updates nutrition targets in store', () => {
  updateNutritionGoals({ calories: 2400, protein: 180, carbs: 250, fat: 70, water: 3000 })
  const daily = getDailyNutrition(useStore.getState().S, '2026-10-23')
  expect(daily.goals.calories).toBe(2400)
  expect(daily.goals.protein).toBe(180)
  expect(daily.goals.water).toBe(3000)
})
