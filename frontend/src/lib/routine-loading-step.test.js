import { expect, it } from 'vitest'
import { CATALOGUE, imgSrc, gifSrc } from './exercises.js'
import { defaultIncrement, loadingStepFor } from './progression.js'
import { buildSets, cascadeTopBackWeight, insertWarmupRow } from './history.js'
import { applyTrainingPlan, withBackoffRepsMode } from './training-plan.js'

it('keeps a portable loading grid distinct from the progression increment through start and Top edits', () => {
  const id = CATALOGUE.find(ex => ex.bp === 'upper legs').id
  const cfg = { id, mode: 'reps', sets: 2, reps: 8, weight: 103, inc: 2.5, loadingStep: 5, setScheme: 'topback', topSets: 1, backoffSets: 1, backoffPct: 15, autoBackoffReps: true, backoffRepsMode: 'same', backoffRepsOverride: true }
  const S = { unit: 'kg', exWeights: {}, workouts: [], backoffRepsMode: 'increased' }, target = withBackoffRepsMode(cfg, S), step = loadingStepFor(cfg, S.unit)
  const rows = applyTrainingPlan(buildSets(S, cfg, { step }), target, step)
  expect(rows.map(row => [row.role, row.w, row.r])).toEqual([['top', 103, 8], ['backoff', 90, 8]])
  const edited = cascadeTopBackWeight(rows, 0, 107, target, step)
  expect(edited[1].w).toBe(90)
  const warm = insertWarmupRow(edited, 'reps', target, step)
  expect(warm[0].w % 5).toBe(0)
  expect(cfg.inc).toBe(2.5)
})

it('preserves catalogue defaults for legacy prescriptions and resolves source custom definitions without global registration', () => {
  const cfg = { id: CATALOGUE[0].id }
  expect(loadingStepFor(cfg, 'kg')).toBe(defaultIncrement(cfg.id, 'kg'))
  expect(loadingStepFor({ id: 'foreign', loadingStep: NaN }, 'lb', { bp: 'upper legs' })).toBe(10)
  expect(defaultIncrement('foreign', 'kg', { bp: 'chest' })).toBe(2.5)
})

it('opens portable HTTPS media and keeps embedded GIFs and bundled catalogue media resolvable', () => {
  expect(imgSrc({ img: 'https://media.example.org/movement.png' })).toBe('https://media.example.org/movement.png')
  expect(gifSrc({ gif: 'data:image/gif;base64,fixture' })).toBe('data:image/gif;base64,fixture')
  expect(gifSrc({ gif: '0025.gif' })).toMatch(/gif\/0025\.gif$/)
})
