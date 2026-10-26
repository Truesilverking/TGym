// Plate math for a loaded barbell: which plates go on each side to reach a target.
// Pure and unit-agnostic; all arithmetic runs in hundredths so 1.25 kg plates never
// accumulate float error.

export const PLATE_SETS = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
  lb: [55, 45, 35, 25, 10, 5, 2.5],
}
export const BAR_WEIGHTS = { kg: [20, 15, 10], lb: [45, 35, 25] }

// Calibrated bumper/change-plate colours (IWF for kg, the common US scheme for lb).
const PLATE_COLORS = {
  kg: { 25: 'red', 20: 'blue', 15: 'yellow', 10: 'green', 5: 'white', 2.5: 'red', 1.25: 'steel', 0.5: 'white' },
  lb: { 55: 'red', 45: 'blue', 35: 'yellow', 25: 'green', 10: 'white', 5: 'steel', 2.5: 'steel' },
}
export const plateColor = (plate, unit = 'kg') => PLATE_COLORS[unit]?.[plate] || 'steel'

const cents = n => Math.round(Number(n) * 100)

/**
 * @param {number} total   target load including the bar
 * @param {{unit?: 'kg'|'lb', bar?: number, plates?: number[]}} options
 * @returns {{ perSide: number[], achieved: number, remainder: number, belowBar: boolean, bar: number }}
 *   perSide   plates for ONE side, heaviest first
 *   achieved  load actually reachable with those plates (bar included)
 *   remainder target minus achieved (0 when exact; positive when the plates can't make it)
 */
export function platesPerSide(total, { unit = 'kg', bar = BAR_WEIGHTS[unit]?.[0] ?? 20, plates = PLATE_SETS[unit] || PLATE_SETS.kg } = {}) {
  const target = cents(total), barC = cents(bar)
  if (!Number.isFinite(target) || target <= barC) {
    return { perSide: [], achieved: bar, remainder: Number.isFinite(target) ? Math.max(0, target - barC) / 100 : 0, belowBar: Number.isFinite(target) && target < barC, bar }
  }
  let side = Math.floor((target - barC) / 2)
  const perSide = []
  for (const plate of [...plates].map(cents).sort((a, b) => b - a)) {
    while (plate > 0 && side >= plate) { perSide.push(plate / 100); side -= plate }
  }
  const achievedC = barC + 2 * perSide.reduce((sum, p) => sum + cents(p), 0)
  return { perSide, achieved: achievedC / 100, remainder: (target - achievedC) / 100, belowBar: false, bar }
}

/**
 * Rounds any target load to the nearest weight realistically loadable
 * with the available plate inventory and bar.
 */
export function roundToAvailablePlates(target, options = {}) {
  const result = platesPerSide(target, options)
  return result.achieved
}

/** Groups a per-side list into [{ plate, count }] for compact display. */
export function groupPlates(perSide) {
  const out = []
  for (const plate of perSide) {
    const last = out[out.length - 1]
    if (last && last.plate === plate) last.count++
    else out.push({ plate, count: 1 })
  }
  return out
}
