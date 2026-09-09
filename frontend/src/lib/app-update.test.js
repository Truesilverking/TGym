import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compareVersions, parseUpdateManifest, checkForAppUpdate } from './app-update.js'
import { signingCertificate } from '../../scripts/signing-certificate.mjs'

it('reads verified signer fingerprints across Android build-tools versions', () => {
  const sha = '8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082'
  for (const label of ['Signer #1', 'V2 Signer:', 'V3 Signer:']) {
    expect(signingCertificate(`${label} certificate SHA-256 digest: ${sha}\nWARNING: metadata\n`)).toBe(sha)
  }
  expect(() => signingCertificate('No signer')).toThrow()
  expect(() => signingCertificate(`Signer #1 certificate SHA-256 digest: ${sha}\nSigner #2 certificate SHA-256 digest: ${'a'.repeat(64)}`)).toThrow()
})
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
  it('checks again after four hours', async () => {
    localStorage.setItem('tgym_update_checked_at','1000')
    const fetcher=vi.fn(async()=>({ok:true,json:async()=>({version:'1.15.5',versionCode:40})}))
    const result = await checkForAppUpdate({currentVersion:'1.15.3',now:14401001,manifestUrl:'https://x.test/latest.json',fetcher})
    expect(result.update.version).toBe('1.15.5')
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0][0]).toBe('https://x.test/latest.json?check=14401001')
  })
})

it('accepts the official mixed-case owner and detects the next version', async () => {
  const raw={version:'1.15.10',versionCode:45,android:{apk:'https://Truesilverking.github.io/TGym/downloads/TGym-latest.apk'}}
  expect(parseUpdateManifest(raw,{repository:'https://github.com/Truesilverking/TGym'}).version).toBe('1.15.10')
  const result=await checkForAppUpdate({currentVersion:'1.15.9',force:true,fetcher:async()=>({ok:true,json:async()=>raw})})
  expect(result.update.version).toBe('1.15.10')
})
