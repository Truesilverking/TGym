import { isWarmupRow } from './workout-model.js'

const LOAD = { 1: [.5], 2: [.4, .7], 3: [.35, .6, .8], 4: [.3, .5, .7, .85], 5: [.25, .45, .6, .75, .9] }
const REPS = { 1: [5], 2: [6, 3], 3: [6, 4, 2], 4: [8, 5, 3, 2], 5: [8, 5, 3, 2, 1] }
const TIME = { 1: [.5], 2: [.4, .6], 3: [.35, .5, .7], 4: [.3, .45, .6, .75], 5: [.25, .4, .5, .65, .8] }
const countOf = n => Math.max(0, Math.min(5, Math.round(Number(n)) || 0))
export const warmupLoadProfile = n => [...(LOAD[countOf(n)] || [])]
export const warmupRepCaps = n => [...(REPS[countOf(n)] || [])]
export const warmupTimeProfile = n => [...(TIME[countOf(n)] || [])]

export function warmupPrescription({ workWeight = 0, workReps = 1, count = 0, step = 2.5, mode = 'reps', workSec = 0, side = false }) {
  const n = countOf(count)
  if (!n || mode === 'cardio') return []
  const increment = Number(step) > 0 ? Number(step) : 2.5
  const weights = warmupLoadProfile(n).map(p => workWeight > 0 ? Math.min(workWeight, Math.floor((workWeight * p + 1e-9) / increment) * increment) : 0)
  if (mode === 'time') return warmupTimeProfile(n).map((p, i) => ({ sec: Math.min(Math.max(0, Math.round(workSec || 0)), Math.max(5, Math.round((workSec || 0) * p))), w: weights[i], ...(side ? { side: true } : {}), done: false, phase: 'warmup', warmup: true }))
  const max = workReps > 1 ? Math.max(1, Math.round(workReps) - 1) : 1
  let prev = Infinity
  const reps = warmupRepCaps(n).map(cap => { let value = Math.max(1, Math.min(max, cap, prev)); if (value === prev && value > 1) value--; prev = value; return value })
  return reps.map((r, i) => ({ w: weights[i], r, done: false, phase: 'warmup', warmup: true }))
}

export function recalculatePendingWarmups(rows, { step = 2.5, mode = 'reps', side = false } = {}) {
  const firstWork = rows.findIndex(row => !isWarmupRow(row))
  if (firstWork <= 0) return rows
  const work = rows[firstWork]
  const generated = warmupPrescription({ workWeight: work.w || 0, workReps: work.r || 1, workSec: work.sec || 0, count: firstWork, step, mode, side })
  return rows.map((row, i) => i >= firstWork || row.done ? row : { ...row, ...generated[i], done: false })
}
