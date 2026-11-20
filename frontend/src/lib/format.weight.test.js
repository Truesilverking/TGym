import { afterEach, expect, it } from 'vitest'
import { fmtNum, fmtVol, fmtWeight } from './format.js'
import { _setLangState } from './i18n-core.js'

afterEach(() => { _setLangState('en', {}, {}, {}) })

it.each(['en', 'es'])('formats every mass in whole units without altering the source in %s', lang => {
  _setLangState(lang, {}, {}, {})
  const reading = { w: 187.75 }
  expect(fmtWeight(reading.w)).toBe('188')
  expect(fmtWeight(0)).toBe('0')
  expect(fmtWeight(-.25)).toBe('0')
  expect(fmtWeight(-1.5)).toBe('-2')
  expect(fmtWeight(1234.25)).toBe(lang === 'es' ? '1234' : '1,234')
  expect(fmtVol(187.75, 'lb')).toBe('188 lb')
  expect(reading.w).toBe(187.75)
  expect(fmtNum(12.5)).toBe(lang === 'es' ? '12,5' : '12.5')
})

it('keeps missing and invalid weights distinct from zero', () => {
  for (const value of [null, undefined, '', NaN, Infinity]) expect(fmtWeight(value)).toBe('—')
})
