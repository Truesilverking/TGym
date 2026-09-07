import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compareVersions, parseUpdateManifest, checkForAppUpdate } from './app-update.js'
describe('app updates', () => {
  const values = new Map()
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), clear: () => values.clear() }
  beforeEach(() => { localStorage.clear() })
  it.each([['1.13.0','1.14.0',-1],['1.14.0','1.14.0',0],['2.0.0','1.99.99',1],['1.10.0','1.9.9',1]])('compares %s and %s', (a,b,want) => expect(compareVersions(a,b)).toBe(want))
  it('rejects absent versions and foreign or insecure downloads', () => {
    expect(() => parseUpdateManifest({ versionCode: 1 })).toThrow()
    expect(() => parseUpdateManifest({ version:'1.2.3',versionCode:1,android:{apk:'http://evil.test/a.apk'} }, { repository:'https://github.com/acme/tgym' })).toThrow('untrusted_update_url')
  })
  it('accepts a release asset from the configured repository', () => expect(parseUpdateManifest({ version:'1.14.0',versionCode:34,android:{apk:'https://github.com/acme/tgym/releases/download/v1.14.0/a.apk'} }, { repository:'https://github.com/acme/tgym' }).version).toBe('1.14.0'))
  it('accepts the repository GitHub Pages direct download', () => expect(parseUpdateManifest({ version:'1.15.1',versionCode:36,android:{apk:'https://acme.github.io/tgym/downloads/TGym-latest.apk'} }, { repository:'https://github.com/acme/tgym' }).android.apk).toContain('/downloads/TGym-latest.apk'))
  it('throttles automatic checks but force bypasses it', async () => {
    localStorage.setItem('tgym_update_checked_at','1000'); const fetcher=vi.fn(async()=>({ok:true,json:async()=>({version:'1.15.0',versionCode:35})}))
    expect((await checkForAppUpdate({currentVersion:'1.14.0',now:2000,manifestUrl:'https://x.test/latest.json',fetcher})).throttled).toBe(true)
    expect((await checkForAppUpdate({currentVersion:'1.14.0',now:2000,force:true,manifestUrl:'https://x.test/latest.json',fetcher})).update.version).toBe('1.15.0')
  })
})
