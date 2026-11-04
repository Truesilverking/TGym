const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat']
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0

// Pure shared reader: weekly reports and the nutrition screen must use the same
// serving quantities and round the final sum, rather than every individual food.
export function nutritionTotals(items) {
  const sums = Object.fromEntries(NUTRIENTS.map(key => [key, 0]))
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== 'object') continue
    const qty = finite(item.qty) > 0 ? Number(item.qty) : 1
    for (const key of NUTRIENTS) {
      const next = sums[key] + Math.max(0, finite(item[key])) * qty
      if (Number.isFinite(next)) sums[key] = next
    }
  }
  return Object.fromEntries(NUTRIENTS.map(key => {
    const value = sums[key]
    if (key === 'calories') return [key, Math.round(value)]
    // Match fmtNum's half-up rounding, without overflowing a valid large total.
    const scaled = value * 10
    return [key, Number.isFinite(scaled) ? Math.round(scaled) / 10 : value]
  }))
}
