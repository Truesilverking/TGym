// @vitest-environment happy-dom
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateTDEE, getDailyNutrition, logFoodItem, removeFoodItem, logWater, updateNutritionGoals } from './nutrition.js'
import { useStore, DEF } from '../store/useStore.js'

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: null })
})
afterEach(() => vi.restoreAllMocks())

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
  const now = new Date('2026-10-26T12:00:00').getTime()
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

  const result = calculateAdaptiveTDEE({ bodyweightLogs, nutritionLogs, lookbackDays: 15, now })
  expect(result.adaptive).toBe(true)
  expect(result.tdee).toBeGreaterThan(2400) // TDEE ~ 2000 + 550 = ~2550
  expect(result.weightChangeKg).toBe(-1)
})

it('differentiates targets between training and rest days when cycling is enabled', () => {
  const S = useStore.getState().S
  S.nutrition.goals = { calories: 2200, carbs: 200, protein: 150, fat: 60, cycleTrainingDays: true }
  S.routines = [{ id: 'routine-1', ex: [] }]
  S.week = { 1: ['routine-1'] } // The app's schedule uses Sunday=0.

  const trainingDayGoals = getEffectiveDailyGoals(S, '2026-10-26') // 2026-10-26 is Monday
  expect(trainingDayGoals.isTrainingDay).toBe(true)
  expect(trainingDayGoals.calories).toBe(2400)
  expect(trainingDayGoals.carbs).toBe(240)

  const restDayGoals = getEffectiveDailyGoals(S, '2026-10-27') // Tuesday rest
  expect(restDayGoals.isTrainingDay).toBe(false)
  expect(restDayGoals.calories).toBe(2050)
  expect(restDayGoals.carbs).toBe(170)
})

it('preserves fractional per-serving macros through logging and recent/custom foods', () => {
  const date = '2026-10-26'
  logFoodItem(date, { name: 'Rice', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, qty: 3 }, { saveFood: true })
  const S = useStore.getState().S, daily = getDailyNutrition(S, date)
  expect(daily.items[0]).toMatchObject({ protein: 2.7, fat: 0.3, qty: 3 })
  expect(daily.totals).toEqual({ calories: 390, protein: 8.1, carbs: 84, fat: 0.9 })
  expect(recentFoods(S)[0].fat).toBe(0.3)
  expect(customFoods(S)[0].protein).toBe(2.7)
})

it('uses numeric water increments and rejects invalid dates/nonfinite edits without changing the profile', () => {
  const date = '2026-10-26'
  logWater(date, 500)
  logWater(date, '250')
  expect(getDailyNutrition(useStore.getState().S, date).waterMl).toBe(750)
  const before = structuredClone(useStore.getState().S)
  expect(logWater(date, Infinity)).toBe(false)
  expect(logFoodItem('2026-02-31', { name: 'Invalid' })).toBeNull()
  expect(logFoodItem(date, { name: 'Invalid', calories: Infinity })).toBeNull()
  expect(logFoodItem(date, { name: 'Invalid', qty: 0 })).toBeNull()
  expect(saveCustomFood({ name: 'Invalid', fat: -3 })).toBeNull()
  expect(updateNutritionGoals({ calories: Infinity })).toBe(false)
  expect(useStore.getState().S).toEqual(before)
})

it('keeps unspecified targets and custom-food identity when updating', () => {
  updateNutritionGoals({ calories: 2500, protein: 180, cycleTrainingDays: true })
  updateNutritionGoals({ water: 3000 })
  expect(useStore.getState().S.nutrition.goals).toMatchObject({ calories: 2500, protein: 180, carbs: 220, fat: 60, water: 3000, cycleTrainingDays: true })
  const first = saveCustomFood({ name: ' Shake ', calories: 100 })
  const second = saveCustomFood({ name: 'shake', calories: 120 })
  expect(second.id).toBe(first.id)
  expect(customFoods(useStore.getState().S)).toHaveLength(1)
})

it('commits a custom food and meal together and rolls both back on failure', () => {
  const before = structuredClone(useStore.getState().S)
  const setter = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
  expect(() => logFoodItem('2026-10-26', { name: 'Saved once', calories: 123 }, { saveFood: true })).toThrow()
  expect(useStore.getState().S).toEqual(before)
  setter.mockRestore()
  logFoodItem('2026-10-26', { name: 'Saved once', calories: 123 }, { saveFood: true })
  expect(customFoods(useStore.getState().S)).toHaveLength(1)
  expect(getDailyNutrition(useStore.getState().S, '2026-10-26').items).toHaveLength(1)
})

it.each([null, 'legacy', [], { goals: null, logs: { '2026-10-26': { items: {} } } }, { goals: { calories: 'bad' }, logs: { '2026-10-26': { items: [null, { name: {}, calories: 'bad', qty: -1 }] } }, customFoods: {} }])('reads malformed optional nutrition data without mutation or invalid totals: %j', nutrition => {
  const state = { ...structuredClone(DEF), nutrition }, snapshot = JSON.stringify(state)
  const daily = getDailyNutrition(state, '2026-10-26')
  expect(daily.goals.calories).toBe(2200)
  expect(Object.values(daily.totals).every(Number.isFinite)).toBe(true)
  expect(() => recentFoods(state)).not.toThrow()
  expect(() => customFoods(state)).not.toThrow()
  expect(JSON.stringify(state)).toBe(snapshot)
})

it('uses scheduled routine identities, rest overrides, pauses and recorded activity for cycling', () => {
  const S = structuredClone(DEF)
  S.nutrition.goals.cycleTrainingDays = true
  S.routines = [{ id: 'r', ex: [] }]
  S.week = { 1: 'r', 2: ['missing'] }
  expect(getDailyNutrition(S, '2026-10-26').goals.calories).toBe(2400)
  S.dayPlan = { '2026-10-26': [] }
  expect(getEffectiveDailyGoals(S, '2026-10-26').isTrainingDay).toBe(false)
  expect(getEffectiveDailyGoals(S, '2026-10-27').isTrainingDay).toBe(false)
  S.dayPlan = {}; S.trainingPauses = [{ start: '2026-10-25', end: null }]
  expect(getEffectiveDailyGoals(S, '2026-10-26').isTrainingDay).toBe(false)
  S.workouts = [{ id: 'empty', d: '2026-10-27', ex: [] }, { id: 'cancelled', d: '2026-10-27', cancelled: true, ex: [{ id: 'x', sets: [{ w: 10, r: 5, done: true }] }] }]
  expect(getEffectiveDailyGoals(S, '2026-10-27').isTrainingDay).toBe(false)
  S.workouts.push({ id: 'actual', d: '2026-10-27', entries: [{ id: 'x', sets: [{ w: 10, r: 5, done: true }] }] })
  expect(getEffectiveDailyGoals(S, '2026-10-27').isTrainingDay).toBe(true)
  S.workouts = []; S.active = { d: '2026-10-27', entries: [{ id: 'x', sets: [{ w: 10, r: 5, done: true }] }] }
  expect(getEffectiveDailyGoals(S, '2026-10-27').isTrainingDay).toBe(true)
})

it('keeps adaptive estimates on local measurement dates, rejects duplicate/future/water-only data, and converts pounds', () => {
  const now = new Date('2026-10-26T12:00:00').getTime()
  const bodyweightLogs = [{ d: '2026-10-12', w: 80 }, { d: '2026-10-19', w: 79.5 }, { d: '2026-10-26', w: 79 }]
  const nutritionLogs = Object.fromEntries(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map(d => [d, { items: [{ calories: 2000 }] }]))
  const options = { bodyweightLogs, nutritionLogs, lookbackDays: 15, now }
  const kg = calculateAdaptiveTDEE(options)
  expect(kg).toMatchObject({ adaptive: true, tdee: 2550, weightChangeKg: -1, daysAnalyzed: 14 })
  const lb = calculateAdaptiveTDEE({ ...options, unit: 'lb', bodyweightLogs: bodyweightLogs.map(w => ({ ...w, w: w.w * 2.2046226218487757 })) })
  expect(lb).toEqual(kg)
  const mixed = calculateAdaptiveTDEE({ ...options, unit: 'kg', bodyweightLogs: [{ d: '2026-10-12', w: 80 * 2.2046226218487757, unit: 'lb' }, { d: '2026-10-19', w: 79.5 }, { d: '2026-10-26', w: 79 }] })
  expect(mixed).toEqual(kg)
  expect(calculateAdaptiveTDEE({ ...options, bodyweightLogs: [bodyweightLogs[0], bodyweightLogs[0], bodyweightLogs[0]] }).adaptive).toBe(false)
  expect(calculateAdaptiveTDEE({ ...options, nutritionLogs: Object.fromEntries(Object.keys(nutritionLogs).map(d => [d, { waterMl: 500 }])) }).adaptive).toBe(false)
  expect(calculateAdaptiveTDEE({ ...options, bodyweightLogs: [...bodyweightLogs, { d: '2026-10-27', w: 20 }], nutritionLogs: { ...nutritionLogs, '2026-10-27': { items: [{ calories: 90000 }] } } })).toEqual(kg)
})

it('removes visible foods from malformed imported arrays without removing unrelated entries', () => {
  const date = '2026-10-26', S = structuredClone(DEF)
  const retained = { id: 'retained', name: 'Other', calories: 5 }
  S.nutrition.logs[date] = { waterMl: 500, items: [null, { id: 'remove', name: 'Meal', calories: 30 }, retained] }
  S.nutrition.customFoods = [null, { id: 'remove', name: 'Saved' }, retained]
  useStore.setState({ S })
  removeFoodItem(date, 'remove')
  removeCustomFood('remove')
  expect(useStore.getState().S.nutrition.logs[date]).toEqual({ waterMl: 500, items: [null, retained] })
  expect(useStore.getState().S.nutrition.customFoods).toEqual([null, retained])
})

it('requires an explicit boolean to enable imported training-day cycling', () => {
  const S = structuredClone(DEF)
  S.nutrition.goals.cycleTrainingDays = 'false'
  S.routines = [{ id: 'r', ex: [] }]; S.week = { 1: 'r' }
  expect(getEffectiveDailyGoals(S, '2026-10-26').calories).toBe(2200)
  expect(getDailyNutrition(S, '2026-10-26').goals.calories).toBe(2200)
})

