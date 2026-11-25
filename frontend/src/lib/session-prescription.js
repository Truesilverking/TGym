import { applyIntensifierPlan, buildSets, modeOf, rerampWarmups } from './history.js'
import { applyPrescription, loadingStepFor, nextPrescription, sessionsFor } from './progression.js'
import { applyTrainingPlan, backoffRepsFor, backoffWeightFor, deloadStatus, deloadTargetFor, repBounds, withBackoffRepsMode } from './training-plan.js'
import { isWarmupRow, nextDropWeight } from './workout-model.js'

const keepWeightPlan = (prescription, weight, why) => ({ policy: prescription.policy, kind: 'hold', weight, why: [why] })

/** Build a new exercise without applying a suggested load increase before consent. */
export function buildSessionExercise(S, cfg, routine = null, { deload = deloadStatus(S), freestyle = false } = {}) {
  let prescription = freestyle ? null : nextPrescription(S, cfg, routine)
  const previous = prescription?.kind === 'up' && Number(prescription.weight) > 0
    ? sessionsFor(S, cfg.id, cfg).filter(session => session.mode === modeOf(cfg)).at(-1) : null
  if (previous && prescription.weight > previous.weight && prescription.reps != null) {
    if (cfg.intensifier?.type === 'restpause') {
      const { reps, ...loadOnly } = prescription
      prescription = { ...loadOnly, why: ['Every rep last time — {0} {1} more.', Math.round((prescription.weight - previous.weight) * 1000) / 1000, S.unit || 'kg'] }
    } else if (cfg.setScheme === 'topback') {
      const bounds = repBounds(cfg, 'top')
      const reps = Math.max(bounds.min, Math.min(bounds.max, prescription.reps))
      prescription = { ...prescription, reps, ...(prescription.policy === 'double' && prescription.why?.length === 4
        ? { why: [...prescription.why.slice(0, 3), reps] } : {}) }
    }
  }
  const pending = !deload.active && previous && prescription.weight > previous.weight
  const loadProgression = pending ? {
    status: 'pending', previousWeight: previous.weight, nextWeight: prescription.weight,
    prescription,
  } : null
  const plan = pending
    ? keepWeightPlan(prescription, previous.weight, 'Keep your previous load until you confirm the increase.')
    : prescription
  const step = loadingStepFor(cfg, S.unit)
  const rows = buildSets(S, cfg, { step, ...(freestyle ? { preferLast: true } : {}) })
  const prescribed = freestyle ? rows : applyPrescription(rows, plan, step)
  const target = deloadTargetFor(withBackoffRepsMode(cfg, S), deload)
  const plannedSets = applyIntensifierPlan(applyTrainingPlan(prescribed, target, step, deload), target)
  // Keep each editable drop's baseline with that drop. Rows and drops can be
  // inserted/removed before consent, and converting units changes rounding.
  const sets = loadProgression ? plannedSets.map(row => Array.isArray(row.drops)
    ? { ...row, drops: row.drops.map(drop => ({ ...drop, progressionWeight: drop.w })) } : row) : plannedSets
  const shownPlan = deload.active
    ? { kind: 'deload', why: ['Deload session — load, working sets and effort are reduced for recovery.'] }
    : plan
  return { id: cfg.id, ...(cfg.sg ? { sg: cfg.sg } : {}), target, plan: shownPlan, sets, ...(loadProgression ? { loadProgression } : {}) }
}

const performed = row => row.done || row.leftDone || row.rightDone

function updatePlannedDrops(row, next, cfg) {
  if (!Array.isArray(row.drops) || cfg.intensifier?.type !== 'dropset') return next
  let before = Number(row.w) || 0, after = Number(next.w) || 0
  next.drops = row.drops.map(drop => {
    const expected = drop.progressionWeight ?? nextDropWeight(before, cfg.intensifier.pct)
    const weight = Number(drop.w) === expected ? nextDropWeight(after, cfg.intensifier.pct) : drop.w
    before = Number(drop.w) || 0; after = Number(weight) || 0
    return { ...drop, w: weight, ...(drop.r === row.r && next.r !== row.r ? { r: next.r } : {}) }
  })
  return next
}

/** Resolve one persisted decision. Completed/partial rows and explicit inputs stay intact. */
export function resolveLoadProgression(entry, accept, step = 2.5) {
  const decision = entry?.loadProgression
  if (decision?.status !== 'pending') return entry
  const status = accept ? 'accepted' : 'declined'
  if (!accept) return {
    ...entry, loadProgression: { ...decision, status },
    plan: keepWeightPlan(decision.prescription, decision.previousWeight, 'Kept the previous weight for this workout.'),
  }
  const cfg = entry.target || {}, prescription = decision.prescription
  let topWeight = null
  const original = entry.sets || []
  const weighted = original.map(row => {
    if (isWarmupRow(row)) return row
    if (row.role === 'top') topWeight = performed(row) || row.manualFields?.w ? row.w : prescription.weight
    if (performed(row)) return row
    const next = { ...row }
    if (!row.manualFields?.w) next.w = cfg.setScheme === 'topback' && row.role === 'backoff'
      ? backoffWeightFor(topWeight ?? prescription.weight, cfg, step) : prescription.weight
    return next
  })
  const hasLoadChange = weighted.some((row, index) => !isWarmupRow(row) && row.w !== original[index].w)
  const sets = hasLoadChange ? weighted.map((row, index) => {
    if (isWarmupRow(row) || performed(row)) return row
    const next = { ...row }
    if (prescription.reps != null && !row.manualFields?.r && row.type !== 'restpause') {
      const bounds = repBounds(cfg, cfg.setScheme === 'topback' ? 'top' : null)
      const reps = Math.max(bounds.min, Math.min(bounds.max, prescription.reps))
      next.r = cfg.setScheme === 'topback' && row.role === 'backoff' ? backoffRepsFor(reps, cfg) : reps
    }
    return updatePlannedDrops(original[index], next, cfg)
  }) : original
  const plan = hasLoadChange ? prescription
    : keepWeightPlan(prescription, decision.previousWeight, 'Your logged and manually entered weights were kept.')
  const finalSets = !hasLoadChange ? sets : cfg.intensifier?.type === 'restpause'
    ? sets.map(row => isWarmupRow(row) && !performed(row) && !row.manualFields?.w
      ? { ...row, w: sets.find(work => !isWarmupRow(work))?.w ?? row.w } : row)
    : rerampWarmups(sets, step)
  return { ...entry, loadProgression: { ...decision, status }, plan, sets: finalSets }
}
