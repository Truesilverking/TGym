import { useStore } from '../store/useStore.js'
import { todayISO } from './format.js'

/**
 * Readiness levels:
 * Sleep: 1 (insomnia/poor) to 5 (great 8h+)
 * Soreness: 1 (no soreness) to 5 (extreme soreness/stiff)
 * Energy: 1 (exhausted) to 5 (fired up)
 */
export function calculateReadinessScore({ sleep = 3, soreness = 3, energy = 3 } = {}) {
  const level = value => Number.isFinite(Number(value)) ? Math.max(1, Math.min(5, Number(value))) : 3
  const s = level(sleep), sore = level(soreness), e = level(energy)
  // For soreness: 1 is best (0 penalty), 5 is worst
  const invertedSoreness = 6 - sore

  // Max score: 5 + 5 + 5 = 15; Min score: 1 + 1 + 1 = 3
  const total = s + invertedSoreness + e
  const pct = Math.round(((total - 3) / 12) * 100)

  let tier = 'normal'
  let loadFactor = 1.0
  let rirDelta = 0
  let suggestion = 'Entrenamiento normal según lo planificado'

  if (pct < 45) {
    tier = 'low'
    loadFactor = 0.95 // -5% load
    rirDelta = 1 // +1 RIR (leave 1 more rep in reserve)
    suggestion = 'Baja energía detectada. Se recomienda −5% de peso o dejar +1 RIR de margen'
  } else if (pct >= 85) {
    tier = 'high'
    loadFactor = 1.02 // +2% potential
    rirDelta = 0
    suggestion = 'Preparación óptima. Excelente día para buscar récords personales'
  }

  return {
    score: pct,
    tier,
    loadFactor,
    rirDelta,
    suggestion,
    sleep: s,
    soreness: sore,
    energy: e,
  }
}

export function getReadiness(state, dateIso = todayISO()) {
  const S = state || useStore.getState().S
  return S?.readiness?.[dateIso] || null
}

export function logReadiness(dateIso, values) {
  const evaluation = calculateReadinessScore(values)
  const update = useStore.getState().update
  update(s => {
    if (!s.readiness) s.readiness = {}
    s.readiness[dateIso] = {
      ...evaluation,
      date: dateIso,
      updatedAt: Date.now(),
    }
  })
  return evaluation
}
