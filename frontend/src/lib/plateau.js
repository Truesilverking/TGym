import { EXIDX, exOr } from './exercises.js'
import { isWarmupRow, modeForSet } from './workout-model.js'
import { estimate1RM } from './onerm.js'
import { loggedWorkouts } from './daily-plan.js'

export function detectExercisePlateau(workouts = [], exerciseId, { lookbackDays = 28, minSessions = 3 } = {}) {
  if (!exerciseId || !Array.isArray(workouts)) return { isPlateau: false }

  const now = Date.now()
  const cutoff = now - lookbackDays * 86400000

  // Filter workouts containing this exercise within lookback window
  const sessions = []
  for (const w of loggedWorkouts({ workouts })) {
    const timestamp = Number.isFinite(Number(w.start)) && Number(w.start) > 0 ? Number(w.start) : Number.isFinite(new Date(w.start).getTime()) ? new Date(w.start).getTime() : new Date(w.d + 'T12:00:00').getTime()
    if (!Number.isFinite(timestamp) || timestamp < cutoff || timestamp > now) continue

    const entry = (w.entries || []).find(e => e.id === exerciseId)
    if (!entry) continue

    // Find best e1RM in this workout
    let maxE1RM = 0
    let bestSet = null
    for (const s of entry.sets || []) {
      if (s.done && !isWarmupRow(s) && modeForSet(s, entry.target || entry) === 'reps') {
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

  // A plateau means no progress across the window. Small genuine increases count.
  const improvementPct = earlierMax > 0 ? ((recentMax - earlierMax) / earlierMax) * 100 : 0
  const isPlateau = improvementPct <= 0

  const ex = EXIDX[exerciseId] || exOr(exerciseId)
  const muscle = ex?.tg || ex?.m || ex?.bp || ex?.bodypart || 'general'

  return {
    isPlateau,
    exerciseId,
    exerciseName: ex?.n || exerciseId,
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
