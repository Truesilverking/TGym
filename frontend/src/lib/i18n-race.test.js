import { afterAll, describe, expect, it } from 'vitest'
import { getLang, setLang } from './i18n.js'

describe('language selection', () => {
  afterAll(async () => { await setLang('en') })

  it('keeps the newest choice when an older locale is still loading', async () => {
    const older = setLang('es')
    const newest = setLang('en')
    await Promise.all([older, newest])
    expect(getLang()).toBe('en')
  })
})
