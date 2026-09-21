import { it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { validatePublishedManifest, verifyPublishedRelease } from '../../scripts/verify-published-update.mjs'
const bytes = Buffer.from('verified APK fixture')
const expected = {version:'1.15.19',versionCode:54,commit:'abc',android:{apk:'https://github.com/example/TGym/releases/download/v1.15.19/app.apk',sha256:createHash('sha256').update(bytes).digest('hex'),certificateSha256:'b'.repeat(64)}}
it.each(['version','versionCode','commit'])('rejects a mismatched published %s', key => {
  expect(()=>validatePublishedManifest({...expected,[key]:'wrong'},expected)).toThrow()
})
it.each(['apk','sha256','certificateSha256'])('rejects a mismatched published Android %s', key => {
  expect(()=>validatePublishedManifest({...expected,android:{...expected.android,[key]:'wrong'}},expected)).toThrow()
})
it('verifies artifact bytes, not just a successful HEAD', async () => {
  const args={expected,manifestUrl:'https://example.test/latest.json',assets:[{url:expected.android.apk,bytes}]}
  const fetcher=async url=>url.includes('latest.json')?{ok:true,json:async()=>expected}:{ok:true,arrayBuffer:async()=>bytes}
  await expect(verifyPublishedRelease({...args,fetcher})).resolves.toBeUndefined()
  await expect(verifyPublishedRelease({...args,fetcher:async url=>url.includes('latest.json')?fetcher(url):{ok:true,arrayBuffer:async()=>Buffer.from('corrupt')}})).rejects.toThrow('artifact differs')
})
