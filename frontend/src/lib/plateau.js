import { EXIDX, exOr } from './exercises.js'
import { isWarmupRow } from './workout-model.js'

function estimate1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
  if (r === 1) return w
  return Math.round(w * (1 + r / 30) * 10) / 10 // Epley formula
}

export function detectExercisePlateau(workouts = [], exerciseId, { lookbackDays = 28, minSessions = 3 } = {}) {
  if (!exerciseId || !Array.isArray(workouts)) return { isPlateau: false }

  const now = Date.now()
  const cutoff = now - lookbackDays * 86400000

  // Filter workouts containing this exercise within lookback window
  const sessions = []
  for (const w of workouts) {
    const timestamp = Number(w.start || new Date(w.d).getTime())
    if (!Number.isFinite(timestamp) || timestamp < cutoff) continue

    const entry = (w.entries || []).find(e => e.id === exerciseId)
    if (!entry) continue

    // Find best e1RM in this workout
    let maxE1RM = 0
    let bestSet = null
    for (const s of entry.sets || []) {
      if (s.done && !isWarmupRow(s)) {
        const e1 = estimate1RM(s.w, s.r)
        if (e1 > maxE1RM) {
          maxE1RM = e1
          bestSet = { weight: s.w, reps: s.r, e1rm: e1 }
        }
      }
    }

    if (maxE1RM > 0) {
      sessions.push({ timestamp, date: w.d, maxE1RM, bestSet })
    }
  }

  sessions.sort((a, b) => a.timestamp - b.timestamp)

  if (sessions.length < minSessions) {
    return { isPlateau: false, sessionCount: sessions.length }
  }

  // Compare earliest sessions in window vs latest sessions
  const midPoint = Math.floor(sessions.length / 2)
  const earlierMax = Math.max(...sessions.slice(0, midPoint).map(s => s.maxE1RM))
  const recentMax = Math.max(...sessions.slice(midPoint).map(s => s.maxE1RM))

  // Plateau condition: recent e1RM has not improved over earlier e1RM by at least 1.5%
  const improvementPct = earlierMax > 0 ? ((recentMax - earlierMax) / earlierMax) * 100 : 0
  const isPlateau = improvementPct <= 0

  const ex = EXIDX[exerciseId] || exOr(exerciseId)
  const muscle = ex?.m || ex?.bodypart || 'general'

  return {
    isPlateau,
    exerciseId,
    exerciseName: ex?.name || exerciseId,
    muscle,
    sessionCount: sessions.length,
    earlierMax,
    recentMax,
    improvementPct: Math.round(improvementPct * 10) / 10,
    recommendations: isPlateau ? [
      {
        type: 'deload',
        title: 'Descarga activa de 1 semana',
        description: 'Reduce la carga un 10% y el volumen un 30% para disipar fatiga neural y articular acumulada.',
      },
      {
        type: 'rep_range',
        title: 'Modificar rango de repeticiones',
        description: 'Si trabajabas a 6-8 repeticiones, cambia a 8-12 reps durante 3 semanas para reclutar fibras por una vía metabólica distinta.',
      },
      {
        type: 'variation',
        title: 'Variante de ejercicio complementaria',
        description: `Rotar a una variante del mismo grupo muscular (${muscle}) para romper la adaptación motora.`,
      },
    ] : [],
  }
}
