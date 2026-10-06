// Stable IDs describe the existing Stats groups, in their presentation order.
export const STATS_SECTIONS = [
  ['history', 'Training history'],
  ['consistency', 'Consistency'],
  ['overview', 'Training overview'],
  ['duration', 'Routine duration'],
  ['muscles', 'Muscle balance'],
  ['effort', 'Effort'],
  ['bodyweight', 'Body Weight'],
  ['measurements', 'Body measurements'],
  ['bmi', 'BMI — Body Mass Index'],
  ['exercise', 'Exercise progress'],
  ['recent', 'Recent workouts'],
]

export function normalizeStatsSections(value) {
  const selected = STATS_SECTIONS.map(([id]) => id).filter(id => Array.isArray(value) && value.includes(id))
  return selected.length ? selected : ['history', 'consistency']
}
