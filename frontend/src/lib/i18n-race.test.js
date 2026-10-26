import { afterAll, describe, expect, it } from 'vitest'
import { dateLocale, getLang, setLang, t } from './i18n.js'
import { _setLangState, exerciseNameSearchText, originalExerciseNameFor } from './i18n-core.js'

describe('language selection', () => {
  afterAll(async () => { await setLang('en') })

  it('keeps the newest choice when an older locale is still loading', async () => {
    const older = setLang('es')
    const newest = setLang('en')
    await Promise.all([older, newest])
    expect(getLang()).toBe('en')
  })

  it('does not overwrite Spanish data-safety messages with the English fallback', async () => {
    await setLang('es')
    expect(t('Could not sign out. Your local data was kept. Check your connection and try again.')).toMatch(/^No se pudo cerrar/)
    expect(t('Sign-out completed. Your local data was kept on this device.')).toMatch(/^La sesión se cerró/)
    expect(t('Synchronize all devices before replacing a changed cloud backup.')).toMatch(/^La copia en la nube/)
  })

  it.each(['constructor', 'toString', '__proto__', 'pt-BR'])('falls back safely for the unsupported saved language %s', async code => {
    await setLang('es')
    await setLang(code)
    expect(getLang()).toBe('en')
    expect(dateLocale()).toBe('en-GB')
    expect(() => new Intl.DateTimeFormat(dateLocale())).not.toThrow()
    _setLangState(code, { Today: 'Incorrect pack' })
    expect(getLang()).toBe('en')
    expect(t('Today')).toBe('Today')
  })

  it('uses a source label when its name only exists on the dictionary prototype', async () => {
    await setLang('es')
    expect(t('constructor')).toBe('constructor')
    expect(t('toString')).toBe('toString')
    expect(t('__proto__')).toBe('__proto__')
  })

  it('keeps names of exercises whose IDs match dictionary prototype properties', () => {
    _setLangState('es', {}, null, {})
    for (const id of ['constructor', 'toString', '__proto__']) {
      const exercise = { id, n: 'Original exercise' }
      expect(originalExerciseNameFor(exercise)).toBe('Original exercise')
      expect(exerciseNameSearchText(exercise)).toBe('Original exercise')
    }
  })
})
