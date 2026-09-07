import { describe, expect, it } from 'vitest'
import { shouldRestoreNative } from './native-state.js'

describe('mobile state restoration', () => {
  it('does not overwrite newer first-run preferences with an older native mirror', () => {
    expect(shouldRestoreNative(
      { _ts: 20, lang: 'en', unit: 'lb' },
      { _ts: 10, lang: 'es', unit: 'kg' },
    )).toBe(false)
  })

  it('restores the native copy when it is newer or local storage is empty', () => {
    expect(shouldRestoreNative({ _ts: 10 }, { _ts: 20 })).toBe(true)
    expect(shouldRestoreNative({}, { lang: 'en', unit: 'lb' })).toBe(true)
  })

  it('ignores a missing native copy', () => {
    expect(shouldRestoreNative({ _ts: 10 }, null)).toBe(false)
  })
})
