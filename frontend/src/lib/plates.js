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
  const invalid = () => ({ perSide: [], achieved: Number.isFinite(barC) && barC >= 0 ? barC / 100 : 0, remainder: 0, belowBar: false, bar: Number.isFinite(barC) && barC >= 0 ? barC / 100 : 0, invalid: true })
  // Bound hypothetical/custom inputs before allocating reachability states or
  // rendering a plate per item. These limits are far beyond a physical barbell.
  if (!Number.isSafeInteger(target) || !Number.isSafeInteger(barC) || barC < 0 || target > 100_000_000 || !Array.isArray(plates) || plates.length > 64) return invalid()
  if (!Number.isFinite(target) || target <= barC) {
    return { perSide: [], achieved: bar, remainder: Number.isFinite(target) ? Math.max(0, target - barC) / 100 : 0, belowBar: Number.isFinite(target) && target < barC, bar }
  }
  const side = Math.floor((target - barC) / 2)
  const perSide = []
  const available = [...new Set(plates.map(cents).filter(p => Number.isSafeInteger(p) && p > 0 && p <= side))].sort((a, b) => b - a)
  if (available.length) {
    if (side / available.at(-1) > 10000) return invalid()
    const gcd = (a, b) => b ? gcd(b, a % b) : a
    const step = available.reduce(gcd), coins = available.map(p => p / step)
    const limit = Math.floor(side / step), smallest = coins.at(-1)
    // The smallest reachable amount for each residue tells us whether a tail
    // can be filled. Greedy alone misses exact loads, e.g. 4 kg per side:
    // 2.5 + 1.25 leaves 0.25, while 2.5 + 0.5 + 0.5 + 0.5 is exact.
    const distances = new Map([[0, 0]]), queue = [[0, 0]]
    let examined = 0
    while (queue.length) {
      queue.sort((a, b) => b[1] - a[1])
      const [residue, distance] = queue.pop()
      if (distance !== distances.get(residue)) continue
      for (const coin of coins) {
        if (++examined > 100000) return invalid()
        const next = distance + coin, nextResidue = next % smallest
        if (next <= limit && next < (distances.get(nextResidue) ?? Infinity)) {
          distances.set(nextResidue, next); queue.push([nextResidue, next])
          if (distances.size > 10000 || queue.length > 4096) return invalid()
        }
      }
    }
    let remaining = 0
    for (const [residue, distance] of distances) {
      const candidate = limit - ((limit - residue) % smallest + smallest) % smallest
      if (candidate >= distance) remaining = Math.max(remaining, candidate)
    }
    for (const coin of coins) {
      while (remaining >= coin && (distances.get((remaining - coin) % smallest) ?? Infinity) <= remaining - coin) {
        perSide.push(coin * step / 100); remaining -= coin
      }
    }
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
