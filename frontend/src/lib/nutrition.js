import { useStore } from '../store/useStore.js'
import { todayISO, isoOf, uid } from './format.js'
import { loggedWorkouts, scheduledRoutineIds } from './daily-plan.js'
import { hasWorkoutActivity } from './session-activity.js'
import { LB_PER_KG } from './unit-conversion.js'
import { dayNumber } from './training-pause.js'
import { nutritionTotals } from './nutrition-totals.js'
export { nutritionTotals } from './nutrition-totals.js'

export const DEFAULT_NUTRITION_GOALS = { calories: 2200, protein: 140, carbs: 220, fat: 60, water: 2500 }
export const NUTRITION_GOAL_MINIMUMS = { calories: 800, protein: 20, carbs: 20, fat: 10, water: 500 }
const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat']
const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
const listOf = value => Array.isArray(value) ? value : []
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const positive = (value, fallback) => finite(value) > 0 ? Number(value) : fallback
const text = value => typeof value === 'string' ? value : ''
const validDate = iso => typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && isoOf(new Date(iso + 'T12:00:00')) === iso
const goalsOf = goals => ({ ...(record(goals) ? goals : {}), ...Object.fromEntries(Object.entries(DEFAULT_NUTRITION_GOALS).map(([key, fallback]) => [key, positive(goals?.[key], fallback)])) })
export const getNutritionGoals = state => goalsOf(state?.nutrition?.goals)
const ensureNutrition = s => {
  if (!record(s.nutrition)) s.nutrition = { goals: { ...DEFAULT_NUTRITION_GOALS }, logs: {}, customFoods: [] }
  return s.nutrition
}
const ensureDay = (s, iso) => {
  const nutrition = ensureNutrition(s)
  if (!record(nutrition.logs)) nutrition.logs = {}
  if (!record(nutrition.logs[iso])) nutrition.logs[iso] = { items: [], waterMl: 0 }
  const day = nutrition.logs[iso]
  day.items = listOf(day.items)
  return day
}
const qtyOf = item => positive(item?.qty, 1)

export const COMMON_FOODS = [
  { id: 'f_chicken', name: 'Pechuga de Pollo', serving: '100g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'f_rice', name: 'Arroz Blanco cocido', serving: '100g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: 'f_egg', name: 'Huevo entero (L)', serving: '1 unidad', calories: 74, protein: 6.3, carbs: 0.4, fat: 5 },
  { id: 'f_eggwhite', name: 'Claras de Huevo', serving: '100g', calories: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { id: 'f_oats', name: 'Avena en copos', serving: '50g', calories: 190, protein: 6.5, carbs: 33, fat: 3.5 },
  { id: 'f_yogurt', name: 'Yogur Griego 0%', serving: '150g', calories: 85, protein: 15, carbs: 5.5, fat: 0 },
  { id: 'f_whey', name: 'Proteína Whey', serving: '1 scoop (30g)', calories: 120, protein: 24, carbs: 2, fat: 1.5 },
  { id: 'f_banana', name: 'Plátano / Banana', serving: '1 mediano (120g)', calories: 105, protein: 1.3, carbs: 27, fat: 0.3 },
  { id: 'f_salmon', name: 'Salmón fresco', serving: '150g', calories: 310, protein: 34, carbs: 0, fat: 18 },
  { id: 'f_tuna', name: 'Atún al natural', serving: '1 lata (80g)', calories: 88, protein: 20, carbs: 0, fat: 0.8 },
  { id: 'f_bread', name: 'Pan Integral', serving: '2 rebanadas (60g)', calories: 150, protein: 6, carbs: 26, fat: 2 },
  { id: 'f_avocado', name: 'Aguacate / Palta', serving: '100g', calories: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  { id: 'f_oliveoil', name: 'Aceite de Oliva', serving: '1 cda (14g)', calories: 120, protein: 0, carbs: 0, fat: 14 },
  { id: 'f_apple', name: 'Manzana', serving: '1 pieza (150g)', calories: 78, protein: 0.4, carbs: 21, fat: 0.2 },
  { id: 'f_nuts', name: 'Frutos Secos mixtos', serving: '30g', calories: 185, protein: 5, carbs: 6, fat: 16 },
]

export const ACTIVITY_MULTIPLIERS = {
  sedentary: { label: 'Sedentario (Poco o ningún ejercicio)', factor: 1.2 },
  light: { label: 'Ligero (1-3 días de entreno / semana)', factor: 1.375 },
  moderate: { label: 'Moderado (3-5 días de entreno / semana)', factor: 1.55 },
  active: { label: 'Muy Activo (6-7 días de entreno)', factor: 1.725 },
  extreme: { label: 'Atleta / Físico extremo', factor: 1.9 },
}

export const DIET_GOALS = {
  cut: { label: 'Definición (-400 kcal)', delta: -400 },
  maintain: { label: 'Mantenimiento (Recomposición)', delta: 0 },
  bulk: { label: 'Volumen muscular (+300 kcal)', delta: 300 },
}

/**
 * Calculates BMR and TDEE using the Mifflin-St Jeor formula
 */
export function calculateTDEE({ weightKg, heightCm, sex = 'male', age = 28, activity = 'moderate', goal = 'maintain' } = {}) {
  const w = positive(weightKg, 75)
  const h = positive(heightCm, 175)
  const a = positive(age, 28)

  // Mifflin-St Jeor BMR
  let bmr = 10 * w + 6.25 * h - 5 * a
  bmr += (sex === 'female' ? -161 : 5)

  const mult = ACTIVITY_MULTIPLIERS[activity]?.factor || 1.55
  const tdee = Math.round(bmr * mult)
  const targetCalories = Math.max(1200, Math.round(tdee + (DIET_GOALS[goal]?.delta || 0)))

  // Macro calculation:
  // High-protein fitness split:
  // Protein: ~2.0g per kg of bodyweight
  const proteinGrams = Math.round(Math.min(targetCalories * 0.4 / 4, Math.max(90, w * 2.0)))
  // Fat: ~25% of total calories (9 kcal/g)
  const fatGrams = Math.round((targetCalories * 0.25) / 9)
  // Carbs: Remaining calories (4 kcal/g)
  const remainingCals = targetCalories - (proteinGrams * 4 + fatGrams * 9)
  const carbsGrams = Math.max(50, Math.round(remainingCals / 4))

  // Water baseline: 35ml per kg of bodyweight
  const waterTarget = Math.max(2000, Math.round(w * 35))

  return {
    bmr: Math.round(bmr),
    tdee,
    calories: targetCalories,
    protein: proteinGrams,
    carbs: carbsGrams,
    fat: fatGrams,
    water: waterTarget,
  }
}

export function getDailyNutrition(state, dateIso = todayISO()) {
  const S = state || useStore.getState().S
  const baseGoals = getNutritionGoals(S)
  const goals = baseGoals.cycleTrainingDays === true ? getEffectiveDailyGoals(S, dateIso) : baseGoals
  const dayLog = S?.nutrition?.logs?.[dateIso] || {}
  const items = listOf(dayLog.items).filter(item => item && typeof item === 'object').map(item => ({ ...item, ...foodFields(item), meal: MEALS.has(item.meal) ? item.meal : 'lunch', qty: qtyOf(item) }))

  return {
    date: dateIso,
    goals,
    items,
    waterMl: Math.max(0, finite(dayLog.waterMl)),
    totals: nutritionTotals(items),
  }
}

export function logFoodItem(dateIso, item, { saveFood = false } = {}) {
  if (!validDate(dateIso) || !validFood(item) || item.qty != null && (!Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0) || NUTRIENTS.some(key => !Number.isFinite(finite(item[key]) * qtyOf(item)))) return null
  const entry = { id: uid(), ...foodFields(item), meal: MEALS.has(item.meal) ? item.meal : 'lunch', qty: qtyOf(item), loggedAt: Date.now() }
  useStore.getState().update(s => {
    const day = ensureDay(s, dateIso)
    if (saveFood) saveFoodDraft(s, item)
    day.items.push(entry)
  })
  return entry
}

export function removeFoodItem(dateIso, itemId) {
  const update = useStore.getState().update
  update(s => {
    if (!Array.isArray(s.nutrition?.logs?.[dateIso]?.items)) return
    s.nutrition.logs[dateIso].items = s.nutrition.logs[dateIso].items.filter(it => it?.id !== itemId)
  })
}

export function logWater(dateIso, deltaMl) {
  if (!validDate(dateIso) || !Number.isFinite(Number(deltaMl))) return false
  const update = useStore.getState().update
  update(s => {
    const day = ensureDay(s, dateIso)
    const next = finite(day.waterMl) + Number(deltaMl)
    if (!Number.isFinite(next)) throw new Error('Invalid water amount')
    day.waterMl = Math.max(0, next)
  })
  return true
}

export function updateNutritionGoals(newGoals = {}) {
  if (!record(newGoals)) return false
  if (Object.keys(DEFAULT_NUTRITION_GOALS).some(key => key in newGoals && !Number.isFinite(Number(newGoals[key])))) return false
  const update = useStore.getState().update
  update(s => {
    const nutrition = ensureNutrition(s), current = goalsOf(nutrition.goals)
    const minimums = NUTRITION_GOAL_MINIMUMS
    nutrition.goals = { ...current, ...Object.fromEntries(Object.keys(minimums).filter(key => key in newGoals).map(key => [key, Math.max(minimums[key], Math.round(Number(newGoals[key])))])) }
    if ('cycleTrainingDays' in newGoals) nutrition.goals.cycleTrainingDays = newGoals.cycleTrainingDays === true
  })
  return true
}

const foodKey = name => String(name || '').trim().toLowerCase()
const foodFields = (item = {}) => ({
  name: text(item.name).trim(),
  serving: text(item.serving),
  ...Object.fromEntries(NUTRIENTS.map(key => [key, Math.max(0, finite(item[key]))])),
})
const validFood = item => item && typeof item === 'object' && text(item.name).trim() && NUTRIENTS.every(key => item[key] == null || Number.isFinite(Number(item[key])) && Number(item[key]) >= 0)

/** Distinct foods from the newest logs first (per-serving values), for one-tap re-logging. */
export function recentFoods(state, limit = 8) {
  if (limit <= 0) return []
  const logs = state?.nutrition?.logs || {}
  const seen = new Set(), out = []
  for (const day of Object.keys(logs).sort().reverse()) {
    // newest first; items logged in the same millisecond keep their append order (later = newer)
    const items = listOf(logs[day]?.items).filter(item => item && typeof item === 'object').map((item, i) => ({ item, i }))
      .sort((a, b) => (b.item.loggedAt || 0) - (a.item.loggedAt || 0) || b.i - a.i).map(x => x.item)
    for (const item of items) {
      const key = foodKey(item.name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(foodFields(item))
      if (out.length >= limit) return out
    }
  }
  return out
}

/** The user's saved foods, alphabetical. */
export const customFoods = state => listOf(state?.nutrition?.customFoods).filter(f => f && typeof f.name === 'string').map(f => ({ ...f, ...foodFields(f) })).sort((a, b) => a.name.localeCompare(b.name))

function saveFoodDraft(s, food) {
  const nutrition = ensureNutrition(s), entry = foodFields(food), list = listOf(nutrition.customFoods)
  const previous = list.find(f => foodKey(f?.name) === foodKey(entry.name))
  const saved = { id: previous?.id || uid(), ...entry }
  nutrition.customFoods = [...list.filter(f => foodKey(f?.name) !== foodKey(entry.name)), saved]
  return saved
}

/** Saves (or replaces, by name) a food in "My foods". */
export function saveCustomFood(food) {
  if (!validFood(food)) return null
  let saved
  useStore.getState().update(s => { saved = saveFoodDraft(s, food) })
  return saved
}

export function removeCustomFood(id) {
  useStore.getState().update(s => {
    if (!Array.isArray(s.nutrition?.customFoods)) return
    s.nutrition.customFoods = s.nutrition.customFoods.filter(f => f?.id !== id)
  })
}

/** Pure: fresh copies of a day's items (new ids, same meals and quantities). Water is not copied. */
export function copiedItems(items, now = Date.now()) {
  return listOf(items).filter(item => item && typeof item === 'object').map((item, i) => ({ ...item, id: uid(), loggedAt: now + i }))
}

/** Appends every food logged on `fromIso` to `toIso`. Returns how many were copied. */
export function copyDayItems(fromIso, toIso) {
  if (!validDate(fromIso) || !validDate(toIso)) return 0
  const source = listOf(useStore.getState().S?.nutrition?.logs?.[fromIso]?.items)
  if (!source.length || fromIso === toIso) return 0
  const copies = copiedItems(source)
  useStore.getState().update(s => {
    ensureDay(s, toIso).items.push(...copies)
  })
  return copies.length
}

/**
 * Calculates adaptive TDEE by correlating actual calorie intake with scale weight changes.
 * 1 kg mass delta ≈ 7,700 kcal.
 */
export function calculateAdaptiveTDEE({ bodyweightLogs = [], nutritionLogs = {}, targetGoal = 'maintain', lookbackDays = 14, unit = 'kg', now = Date.now() } = {}) {
  const today = isoOf(new Date(now)), endDay = dayNumber(today)
  const cutoff = endDay - positive(lookbackDays, 14)
  const perDay = new Map()
  for (const weight of listOf(bodyweightLogs)) {
    if (!weight || !Number.isFinite(Number(weight.w)) || Number(weight.w) <= 0) continue
    // A backdated measurement's date is authoritative, not its recording timestamp.
    const date = validDate(weight.d) ? weight.d : isoOf(new Date(weight.t))
    const day = dayNumber(date)
    if (!Number.isFinite(day) || day < cutoff || day > endDay) continue
    const previous = perDay.get(date)
    if (!previous || finite(weight.t) >= finite(previous.t)) perDay.set(date, { ...weight, date, day, w: Number(weight.w) / (unit === 'lb' ? LB_PER_KG : 1) })
  }
  const weights = [...perDay.values()].sort((a, b) => a.day - b.day)

  if (weights.length < 3) {
    return { adaptive: false, reason: 'insufficient_weight_data' }
  }

  // Match intake to the same measurement interval. The final scale day is still partial.
  const first = weights[0], last = weights.at(-1)
  const loggedDays = Object.entries(record(nutritionLogs) ? nutritionLogs : {})
    .filter(([date, log]) => validDate(date) && date >= first.date && date < last.date && nutritionTotals(log?.items).calories > 0)

  if (loggedDays.length < 5) {
    return { adaptive: false, reason: 'insufficient_nutrition_data' }
  }

  let totalCals = 0
  for (const [, log] of loggedDays) {
    const dayTotal = nutritionTotals(log.items).calories
    totalCals += dayTotal
  }
  const avgCalories = totalCals / loggedDays.length

  const startWeight = first.w
  const endWeight = last.w
  const weightDeltaKg = endWeight - startWeight

  const daysElapsed = last.day - first.day
  if (daysElapsed < 3) return { adaptive: false, reason: 'insufficient_weight_data' }

  // Energy imbalance per day:
  const dailyImbalanceCals = (weightDeltaKg * 7700) / daysElapsed
  // TDEE = What you ate MINUS the surplus (or plus the deficit)
  let calculatedTDEE = Math.round(avgCalories - dailyImbalanceCals)
  calculatedTDEE = Math.max(1200, Math.min(4500, calculatedTDEE))

  const goalDelta = DIET_GOALS[targetGoal]?.delta || 0
  const recommendedCalories = Math.max(1200, calculatedTDEE + goalDelta)

  return {
    adaptive: true,
    tdee: calculatedTDEE,
    recommendedCalories,
    weightChangeKg: Math.round(weightDeltaKg * 10) / 10,
    avgLoggedCalories: Math.round(avgCalories),
    daysAnalyzed: Math.round(daysElapsed),
  }
}

/**
 * Returns daily targets tailored for Training vs Rest days
 */
export function getEffectiveDailyGoals(state, dateIso = todayISO()) {
  const S = state || useStore.getState().S
  const baseGoals = goalsOf(S?.nutrition?.goals)
  const safeState = { ...S, routines: listOf(S?.routines).filter(record), workouts: listOf(S?.workouts).filter(record) }
  // Reuse the app's Sunday-based schedule, explicit rest overrides, pauses and actual activity.
  const isTrainingDay = validDate(dateIso) && (scheduledRoutineIds(safeState, dateIso).length > 0 || loggedWorkouts(safeState).some(w => w.d === dateIso && hasWorkoutActivity(w)))

  if (baseGoals.cycleTrainingDays !== true) {
    return { ...baseGoals, isTrainingDay }
  }

  // Carb & Calorie cycling:
  // Training days: +200 kcal, +40g carbs for workout performance
  // Rest days: -150 kcal, -30g carbs (lower glycogen demand)
  if (isTrainingDay) {
    return {
      ...baseGoals,
      isTrainingDay: true,
      calories: baseGoals.calories + 200,
      carbs: baseGoals.carbs + 40,
    }
  } else {
    return {
      ...baseGoals,
      isTrainingDay: false,
      calories: Math.max(1200, baseGoals.calories - 150),
      carbs: Math.max(40, baseGoals.carbs - 30),
    }
  }
}

