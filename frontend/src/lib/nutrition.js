import { useStore } from '../store/useStore.js'
import { todayISO, uid } from './format.js'

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
export function calculateTDEE({ weightKg, heightCm, sex = 'male', age = 28, activity = 'moderate', goal = 'maintain' }) {
  const w = Number(weightKg) || 75
  const h = Number(heightCm) || 175
  const a = Number(age) || 28

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
  const nutrition = S?.nutrition || { goals: { calories: 2200, protein: 140, carbs: 220, fat: 60, water: 2500 }, logs: {} }
  const goals = nutrition.goals || { calories: 2200, protein: 140, carbs: 220, fat: 60, water: 2500 }
  const dayLog = nutrition.logs?.[dateIso] || { items: [], waterMl: 0 }

  const totals = (dayLog.items || []).reduce((acc, item) => {
    const qty = Number(item.qty) || 1
    acc.calories += Math.round((item.calories || 0) * qty)
    acc.protein += Math.round((item.protein || 0) * qty)
    acc.carbs += Math.round((item.carbs || 0) * qty)
    acc.fat += Math.round((item.fat || 0) * qty)
    return acc
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  return {
    date: dateIso,
    goals,
    items: dayLog.items || [],
    waterMl: Number(dayLog.waterMl) || 0,
    totals,
  }
}

export function logFoodItem(dateIso, item) {
  const update = useStore.getState().update
  update(s => {
    if (!s.nutrition) s.nutrition = { goals: { calories: 2200, protein: 140, carbs: 220, fat: 60, water: 2500 }, logs: {}, customFoods: [] }
    if (!s.nutrition.logs) s.nutrition.logs = {}
    if (!s.nutrition.logs[dateIso]) s.nutrition.logs[dateIso] = { items: [], waterMl: 0 }

    const entry = {
      id: uid(),
      name: item.name || 'Alimento',
      meal: item.meal || 'lunch',
      calories: Math.max(0, Math.round(Number(item.calories) || 0)),
      protein: Math.max(0, Math.round(Number(item.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(item.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(item.fat) || 0)),
      qty: Math.max(0.1, Number(item.qty) || 1),
      serving: item.serving || '1 porción',
      loggedAt: Date.now(),
    }

    s.nutrition.logs[dateIso].items.push(entry)
  })
}

export function removeFoodItem(dateIso, itemId) {
  const update = useStore.getState().update
  update(s => {
    if (!s.nutrition?.logs?.[dateIso]?.items) return
    s.nutrition.logs[dateIso].items = s.nutrition.logs[dateIso].items.filter(it => it.id !== itemId)
  })
}

export function logWater(dateIso, deltaMl) {
  const update = useStore.getState().update
  update(s => {
    if (!s.nutrition) s.nutrition = { goals: { calories: 2200, protein: 140, carbs: 220, fat: 60, water: 2500 }, logs: {}, customFoods: [] }
    if (!s.nutrition.logs) s.nutrition.logs = {}
    if (!s.nutrition.logs[dateIso]) s.nutrition.logs[dateIso] = { items: [], waterMl: 0 }
    const current = Number(s.nutrition.logs[dateIso].waterMl) || 0
    s.nutrition.logs[dateIso].waterMl = Math.max(0, current + deltaMl)
  })
}

export function updateNutritionGoals(newGoals) {
  const update = useStore.getState().update
  update(s => {
    if (!s.nutrition) s.nutrition = { goals: {}, logs: {}, customFoods: [] }
    s.nutrition.goals = {
      ...(s.nutrition.goals || {}),
      calories: Math.max(800, Math.round(Number(newGoals.calories) || 2200)),
      protein: Math.max(20, Math.round(Number(newGoals.protein) || 140)),
      carbs: Math.max(20, Math.round(Number(newGoals.carbs) || 220)),
      fat: Math.max(10, Math.round(Number(newGoals.fat) || 60)),
      water: Math.max(500, Math.round(Number(newGoals.water) || 2500)),
    }
  })
}

const foodKey = name => String(name || '').trim().toLowerCase()
const foodFields = item => ({
  name: String(item.name || '').trim(),
  serving: item.serving || '',
  calories: Math.max(0, Math.round(Number(item.calories) || 0)),
  protein: Math.max(0, Math.round(Number(item.protein) || 0)),
  carbs: Math.max(0, Math.round(Number(item.carbs) || 0)),
  fat: Math.max(0, Math.round(Number(item.fat) || 0)),
})

/** Distinct foods from the newest logs first (per-serving values), for one-tap re-logging. */
export function recentFoods(state, limit = 8) {
  const logs = state?.nutrition?.logs || {}
  const seen = new Set(), out = []
  for (const day of Object.keys(logs).sort().reverse()) {
    // newest first; items logged in the same millisecond keep their append order (later = newer)
    const items = (logs[day]?.items || []).map((item, i) => ({ item, i }))
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
export const customFoods = state => [...(state?.nutrition?.customFoods || [])].sort((a, b) => a.name.localeCompare(b.name))

/** Saves (or replaces, by name) a food in "My foods". */
export function saveCustomFood(food) {
  const entry = foodFields(food)
  if (!entry.name) return null
  const saved = { id: uid(), ...entry }
  useStore.getState().update(s => {
    if (!s.nutrition) s.nutrition = { goals: { calories: 2200, protein: 140, carbs: 220, fat: 60, water: 2500 }, logs: {}, customFoods: [] }
    const list = (s.nutrition.customFoods || []).filter(f => foodKey(f.name) !== foodKey(entry.name))
    s.nutrition.customFoods = [...list, saved]
  })
  return saved
}

export function removeCustomFood(id) {
  useStore.getState().update(s => {
    if (!s.nutrition?.customFoods) return
    s.nutrition.customFoods = s.nutrition.customFoods.filter(f => f.id !== id)
  })
}

/** Pure: fresh copies of a day's items (new ids, same meals and quantities). Water is not copied. */
export function copiedItems(items, now = Date.now()) {
  return (items || []).map((item, i) => ({ ...item, id: uid(), loggedAt: now + i }))
}

/** Appends every food logged on `fromIso` to `toIso`. Returns how many were copied. */
export function copyDayItems(fromIso, toIso) {
  const source = useStore.getState().S?.nutrition?.logs?.[fromIso]?.items || []
  if (!source.length || fromIso === toIso) return 0
  const copies = copiedItems(source)
  useStore.getState().update(s => {
    if (!s.nutrition) s.nutrition = { goals: { calories: 2200, protein: 140, carbs: 220, fat: 60, water: 2500 }, logs: {}, customFoods: [] }
    if (!s.nutrition.logs) s.nutrition.logs = {}
    if (!s.nutrition.logs[toIso]) s.nutrition.logs[toIso] = { items: [], waterMl: 0 }
    s.nutrition.logs[toIso].items.push(...copies)
  })
  return copies.length
}
