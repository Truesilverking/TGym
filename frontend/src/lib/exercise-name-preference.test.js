import { afterEach, expect, it } from 'vitest'
import { _setLangState, exerciseNameFor, originalExerciseNameFor, exerciseNameModeOf, exerciseNameSearchText } from './i18n-core.js'

afterEach(() => _setLangState('en', {}, null, null))
const exercise = { id: 'bench', n: 'barbell bench press' }

it('defaults to aliases and falls back for absent, blank and malformed aliases without changing data', () => {
  for (const alias of [undefined, '', '   ', null, 123, {}]) {
    const S = { exerciseAliases: { bench: alias }, workouts: [{ entries: [{ id: 'bench', n: exercise.n }] }] }
    const before = JSON.stringify(S)
    expect(exerciseNameModeOf(S)).toBe('aliases')
    expect(exerciseNameFor(exercise, S)).toBe(exercise.n)
    expect(JSON.stringify(S)).toBe(before)
  }
  expect(exerciseNameModeOf({ exerciseNameMode: 'obsolete' })).toBe('aliases')
})

it('uses the selected mode, preserves original lookup and search, and reflects edits and removal', () => {
  _setLangState('es', {}, null, { bench: 'press de banca con barra' })
  const S = { exerciseAliases: { bench: '  Mi banca  ' } }
  expect(exerciseNameFor(exercise, S)).toBe('Mi banca')
  expect(originalExerciseNameFor(exercise)).toBe('press de banca con barra')
  expect(exerciseNameSearchText(exercise)).toContain('barbell bench press')
  expect(exerciseNameSearchText(exercise)).toContain('press de banca con barra')
  S.exerciseNameMode = 'original'
  expect(exerciseNameFor(exercise, S)).toBe('press de banca con barra')
  S.exerciseAliases.bench = 'Banca nueva'
  expect(exerciseNameFor(exercise, S)).toBe('press de banca con barra')
  S.exerciseNameMode = 'aliases'
  expect(exerciseNameFor(exercise, S)).toBe('Banca nueva')
  delete S.exerciseAliases.bench
  expect(exerciseNameFor(exercise, S)).toBe('press de banca con barra')
})

it('keeps duplicate and long aliases independent by ID and preserves custom and historical base names', () => {
  const long = 'Press de banca personal '.repeat(12)
  const S = { exerciseAliases: { bench: long, squat: long, removed: 'Viejo apodo' }, customEx: [{ id: 'mine', n: 'Mi ejercicio base', custom: true }] }
  expect(exerciseNameFor(exercise, S)).toBe(long.trim())
  expect(exerciseNameFor({ id: 'squat', n: 'squat' }, S)).toBe(long.trim())
  expect(exerciseNameFor({ id: 'mine', n: 'Old snapshot' }, S)).toBe('Mi ejercicio base')
  const orphan = { id: 'removed', n: 'Unknown exercise', missing: true }
  const context = { routineId: 'routine', entry: { id: 'removed', n: 'Deleted exercise base' } }
  expect(exerciseNameFor(orphan, S, context)).toBe('Viejo apodo')
  S.exerciseNameMode = 'original'
  expect(exerciseNameFor(orphan, S, context)).toBe('Deleted exercise base')
  expect(exerciseNameFor({ id: 'removed' }, S, { entry: { muscleSnapshot: { n: 'Stored muscle name' } } })).toBe('Stored muscle name')
  expect(exerciseNameFor({ id: 'unavailable' }, S)).toBe('unavailable')
})
