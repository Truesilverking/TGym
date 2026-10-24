const TIERS = [
  { min: 0, max: 6, tier: 'yellow' },
  { min: 7, max: 13, tier: 'orange' },
  { min: 14, max: 29, tier: 'redgold' },
  { min: 30, max: 49, tier: 'blue' },
  { min: 50, max: 99, tier: 'purple' },
  { min: 100, max: 365, tier: 'legend' },
]

export function streakVisual(value) {
  const count = Math.max(0, Math.floor(Number(value) || 0))
  const band = TIERS.find(x => count <= x.max) || TIERS.at(-1)
  const active = count > 0
  return { tier: band.tier, progress: active ? 1 : 0, intensity: active ? 1 : 0, active }
}
