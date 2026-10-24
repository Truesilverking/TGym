import { afterAll, describe, expect, it } from 'vitest'
import { getLang, setLang, t } from './i18n.js'

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
})
