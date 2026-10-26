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

import { recentFoods, customFoods, saveCustomFood, removeCustomFood, copiedItems, copyDayItems } from './nutrition.js'

it('lists recent foods newest first, once each, with per-serving values', () => {
  logFoodItem('2026-10-01', { name: 'Avena', calories: 190, protein: 7, qty: 2 })
  logFoodItem('2026-10-02', { name: 'Huevo', calories: 74, protein: 6 })
  logFoodItem('2026-10-02', { name: 'avena ', calories: 190, protein: 7 })
  const recent = recentFoods(useStore.getState().S)
  expect(recent.map(f => f.name)).toEqual(['avena', 'Huevo'])
  expect(recent[0].calories).toBe(190)
  expect(recentFoods(useStore.getState().S, 1)).toHaveLength(1)
})

it('saves custom foods by name and removes them', () => {
  saveCustomFood({ name: 'Batido', calories: 300, protein: 30 })
  saveCustomFood({ name: 'batido', calories: 320, protein: 32 })
  let mine = customFoods(useStore.getState().S)
  expect(mine).toHaveLength(1)
  expect(mine[0].calories).toBe(320)
  removeCustomFood(mine[0].id)
  expect(customFoods(useStore.getState().S)).toEqual([])
  expect(saveCustomFood({ name: '  ' })).toBeNull()
})

it('copies a day of meals with fresh ids and leaves water alone', () => {
  logFoodItem('2026-10-05', { name: 'Arroz', meal: 'lunch', calories: 130 })
  logWater('2026-10-05', 500)
  expect(copyDayItems('2026-10-05', '2026-10-06')).toBe(1)
  const day = getDailyNutrition(useStore.getState().S, '2026-10-06')
  expect(day.items).toHaveLength(1)
  expect(day.items[0].meal).toBe('lunch')
  expect(day.items[0].id).not.toBe(getDailyNutrition(useStore.getState().S, '2026-10-05').items[0].id)
  expect(day.waterMl).toBe(0)
  expect(copyDayItems('2026-10-09', '2026-10-10')).toBe(0)
  expect(copiedItems([{ id: 'x', name: 'a' }], 5)[0]).toMatchObject({ name: 'a', loggedAt: 5 })
})

import { calculateAdaptiveTDEE, getEffectiveDailyGoals } from './nutrition.js'

it('calculates adaptive TDEE based on calorie logs and scale weight delta', () => {
  const now = Date.now()
  const bodyweightLogs = [
    { t: now - 14 * 86400000, w: 80 },
    { t: now - 7 * 86400000, w: 79.5 },
    { t: now, w: 79.0 }, // lost 1 kg in 14 days = ~550 kcal/day deficit
  ]
  const nutritionLogs = {
    '2026-10-12': { items: [{ calories: 2000, qty: 1 }] },
    '2026-10-13': { items: [{ calories: 2000, qty: 1 }] },
    '2026-10-14': { items: [{ calories: 2000, qty: 1 }] },
    '2026-10-15': { items: [{ calories: 2000, qty: 1 }] },
    '2026-10-16': { items: [{ calories: 2000, qty: 1 }] },
  }

  const result = calculateAdaptiveTDEE({ bodyweightLogs, nutritionLogs, lookbackDays: 15 })
  expect(result.adaptive).toBe(true)
  expect(result.tdee).toBeGreaterThan(2400) // TDEE ~ 2000 + 550 = ~2550
  expect(result.weightChangeKg).toBe(-1)
})

it('differentiates targets between training and rest days when cycling is enabled', () => {
  const S = useStore.getState().S
  S.nutrition.goals = { calories: 2200, carbs: 200, protein: 150, fat: 60, cycleTrainingDays: true }
  S.week = { 0: ['routine-1'] } // Monday is training day

  const trainingDayGoals = getEffectiveDailyGoals(S, '2026-10-26') // 2026-10-26 is Monday
  expect(trainingDayGoals.isTrainingDay).toBe(true)
  expect(trainingDayGoals.calories).toBe(2400)
  expect(trainingDayGoals.carbs).toBe(240)

  const restDayGoals = getEffectiveDailyGoals(S, '2026-10-27') // Tuesday rest
  expect(restDayGoals.isTrainingDay).toBe(false)
  expect(restDayGoals.calories).toBe(2050)
  expect(restDayGoals.carbs).toBe(170)
})

