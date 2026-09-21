import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export function validatePublishedManifest(actual, expected) {
  for (const key of ['version', 'versionCode', 'commit']) {
    if (actual?.[key] !== expected[key]) throw new Error(`Published ${key} differs from built release`)
  }
  for (const key of ['apk', 'sha256', 'certificateSha256']) {
    if (!expected.android?.[key] || actual.android?.[key] !== expected.android[key]) throw new Error(`Published android.${key} differs from built release`)
  }
  if (!/^[a-f0-9]{64}$/i.test(expected.android.sha256) || !/^[a-f0-9]{64}$/i.test(expected.android.certificateSha256)) throw new Error('Invalid release fingerprints')
}

export async function verifyPublishedRelease({ expected, manifestUrl, assets, fetcher = fetch }) {
  const get = async url => {
    const response = await fetcher(url, {cache:'no-store'})
    if (!response.ok) throw new Error(`Published asset HTTP ${response.status}`)
    return response
  }
  const manifest = await (await get(`${manifestUrl}?verify=${Date.now()}`)).json()
  validatePublishedManifest(manifest, expected)
  for (const {url, bytes} of assets) {
    const downloaded = Buffer.from(await (await get(url)).arrayBuffer())
    if (sha256(downloaded) !== sha256(bytes)) throw new Error('Published artifact differs from verified local artifact')
    if (url === expected.android.apk && sha256(downloaded) !== expected.android.sha256) throw new Error('Published APK checksum mismatch')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expected = JSON.parse(readFileSync(new URL('../updates/latest.json', import.meta.url)))
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version
  const [owner, repo] = (process.env.REPOSITORY || '').split('/')
  if (!owner || !repo || expected.version !== version || expected.commit !== process.env.GITHUB_SHA) throw new Error('Release metadata does not match checkout')
  const base = `https://github.com/${owner}/${repo}/releases/download/v${version}/`
  const names = [`TGym-Android-v${version}.apk`, `TGym-Android-v${version}.aab`, 'checksums.txt', 'latest.json']
  if (expected.android.apk !== base + names[0]) throw new Error('Unexpected official APK URL')
  const assets = names.map(name => ({url:base+name,bytes:readFileSync(new URL(name === 'latest.json' ? '../updates/latest.json' : `../release/${name}`, import.meta.url))}))
  let error
  for (let attempt=0; attempt<12; attempt++) {
    try {
      await verifyPublishedRelease({expected, manifestUrl:`https://${owner.toLowerCase()}.github.io/${repo}/updates/latest.json`, assets})
      console.log(`Verified published ${version}: commit, versionCode, certificate metadata and identical APK/AAB/checksums/manifest bytes`)
      error = null; break
    } catch (e) { error=e; console.log(e.message); if(attempt<11) await new Promise(resolve=>setTimeout(resolve,10000)) }
  }
  if (error) throw new Error('Published release verification failed; notification must not be sent', {cause:error})
}
