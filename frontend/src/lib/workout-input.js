import { repBounds } from './training-plan.js'
import { isWarmupRow } from './workout-model.js'

export function actualRepValidation(entry, row, index) {
  const cfg = entry.target || {}
  if (isWarmupRow(row) || row.amrap || cfg.amrap || /^amrap$/i.test(String(cfg.reps).trim()) ||
      (entry.plan?.policy === 'greyskull' && index === entry.sets.findLastIndex(s=>!isWarmupRow(s))) ||
      ![cfg.reps,cfg.topRepsMax,cfg.backoffRepsMax].some(v=>Number(v)>0)) return {}
  const bounds = repBounds(cfg,row.role)
  return {min:Math.min(bounds.min,bounds.max),max:Math.max(bounds.min,bounds.max)}
}
