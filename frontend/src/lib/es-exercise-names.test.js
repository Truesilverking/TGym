import { afterEach, describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import es from '../exercise-names/es.js'
import { _setLangState, exerciseNameFor, exerciseNameSearchText } from './i18n-core.js'

describe('Spanish exercise catalogue names', () => {
  afterEach(() => _setLangState('en', {}, null, null))

  it('covers every built-in exercise', () => {
    expect(Object.keys(es)).toHaveLength(EXDB.length)
    for (const exercise of EXDB) expect(es[exercise.id]?.trim()).toBeTruthy()
  })

  it('shows only the Spanish title while retaining English search terms', () => {
    const benchPress = EXDB.find(exercise => exercise.id === '0025')
    _setLangState('es', {}, null, es)

    expect(exerciseNameFor(benchPress)).toBe('press de banca con barra')
    expect(exerciseNameFor(benchPress)).not.toContain(benchPress.n)
    expect(exerciseNameSearchText(benchPress)).toContain('press de banca con barra')
    expect(exerciseNameSearchText(benchPress)).toContain(benchPress.n)
  })

  it('also localizes catalogue entries outside the curated common list', () => {
    const sitUp = EXDB.find(exercise => exercise.id === '0001')
    _setLangState('es', {}, null, es)
    expect(exerciseNameFor(sitUp)).not.toBe(sitUp.n)
  })
})
