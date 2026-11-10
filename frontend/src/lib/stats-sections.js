// Stable IDs describe the existing Stats groups, in their presentation order.
export const STATS_SECTIONS = [
  ['history', 'Training history'],
  ['consistency', 'Consistency'],
  ['overview', 'Training overview'],
  ['duration', 'Routine duration'],
  ['muscles', 'Muscle balance'],
  ['effort', 'Effort'],
  ['bodyweight', 'Body Weight'],
  ['measurements', 'Body Measurements'],
  ['bmi', 'BMI — Body Mass Index'],
  ['exercise', 'Exercise progress'],
  ['recent', 'Recent workouts'],
]

// The dashboard retires its duplicate recent list; existing report exports keep it.
export const STATS_VIEW_SECTIONS = STATS_SECTIONS.filter(([id]) => id !== 'recent')

export function normalizeStatsSections(value) {
  const ids = STATS_VIEW_SECTIONS.map(([id]) => id)
  const selected = Array.isArray(value) ? [...new Set(value.filter(id => ids.includes(id)))] : []
  return selected.length ? selected : ['history', 'consistency']
}

// Read previous explicit orders without discarding a user's saved view. New
// selection writes store the same ordered IDs in both existing preference keys.
export function statsSelectionOrder(value, order) {
  const selected = normalizeStatsSections(value)
  const saved = Array.isArray(order) ? [...new Set(order.filter(id => selected.includes(id)))] : []
  return [...saved, ...selected.filter(id => !saved.includes(id))]
}

export function normalizeStatsSectionOrder(value) {
  const ids = STATS_VIEW_SECTIONS.map(([id]) => id)
  const saved = Array.isArray(value) ? value.filter(id => ids.includes(id)) : []
  return [...new Set([...saved, ...ids])]
}
