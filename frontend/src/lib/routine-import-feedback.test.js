import { expect, it } from 'vitest'
import { routineAdaptationMessage, routineImportDiagnostics, routineImportErrorKind } from './routine-import-feedback.js'
import es from '../locales/es.js'
import { _setLangState, t } from './i18n-core.js'

it('retains the original storage exception, stack and exact operation without copying profile resources', () => {
  const cause = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  const error = new Error('Profile write failed', { cause })
  error.diagnostics = { stage: 'profile-write', backend: 'localStorage', key: 'gym_state_v1', attemptedBytes: 3000, previousBytes: 1000, profile: { image: 'secret' } }
  const result = routineImportDiagnostics(error, { fileBytes: 4000 })
  expect(result.failures[0]).toMatchObject({ stage: 'profile-write', backend: 'localStorage', key: 'gym_state_v1', attemptedBytes: 3000, previousBytes: 1000 })
  expect(result.failures[1]).toMatchObject({ name: 'QuotaExceededError', message: cause.message, stack: cause.stack })
  expect(JSON.stringify(result)).not.toContain('secret')
  expect(routineImportErrorKind(error)).toBe('quota')
})

it('classifies an ordinary persistence failure separately from conversion and browser permissions', () => {
  expect(routineImportErrorKind(new Error('not saved'), 'persist')).toBe('persist')
  expect(routineImportErrorKind(new Error('not converted'), 'conversion')).toBe('conversion')
  expect(routineImportErrorKind(new DOMException('denied', 'SecurityError'), 'read')).toBe('permission')
  expect(routineImportErrorKind(new SyntaxError('not JSON'), 'read')).toBe('validation')
})

it('retains the first localStorage failure separately when resource staging later fails', () => {
  const initialCause = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  const initial = new Error('Primary quota exceeded', { cause: initialCause })
  initial.diagnostics = { stage: 'profile-write', backend: 'localStorage', key: 'gym_state_v1', attemptedBytes: 5000000 }
  const failure = new Error('Resource write denied', { cause: new DOMException('Denied', 'SecurityError') })
  failure.initialStorageFailure = initial
  failure.diagnostics = { stage: 'resource-write', backend: 'indexedDB', transaction: { profile: 'private media' } }
  const result = routineImportDiagnostics(failure)
  expect(result.initialFailure[0]).toMatchObject({ stage: 'profile-write', key: 'gym_state_v1', attemptedBytes: 5000000 })
  expect(result.initialFailure[1].stack).toBe(initialCause.stack)
  expect(result.failures[0].transaction).toBe('[detail unavailable]')
  expect(routineImportErrorKind(failure)).toBe('permission')
  expect(JSON.stringify(result)).not.toContain('private media')
})

it('translates dynamic effort and static legacy adaptation messages in Spanish', () => {
  _setLangState('es', es)
  try {
    expect(routineAdaptationMessage({ key: 'effort', source: 'RPE', destination: 'RIR' }, t)).toContain('La escala de esfuerzo difiere (RPE → RIR).')
    const source = 'Legacy version 1: source preferences were applied only to the imported prescriptions. Review the preview before accepting.'
    expect(routineAdaptationMessage({ key: 'legacy-defaults', message: source }, t)).toBe(es[source])
    expect(es[source]).not.toBe(source)
  } finally { _setLangState('en', {}) }
})
