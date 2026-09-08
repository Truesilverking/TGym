import { APP_DISTRIBUTION, APP_REPOSITORY, UPDATE_MANIFEST_URL } from './app-meta.js'

const semver = value => {
  const m = String(value || '').trim().match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/)
  return m ? { parts: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] || '' } : null
}
export function compareVersions(a, b) {
  const av = semver(a), bv = semver(b)
  if (!av || !bv) throw new Error('invalid_version')
  for (let i = 0; i < 3; i++) if (av.parts[i] !== bv.parts[i]) return av.parts[i] < bv.parts[i] ? -1 : 1
  if (av.pre === bv.pre) return 0
  if (!av.pre) return 1
  if (!bv.pre) return -1
  return av.pre.localeCompare(bv.pre, undefined, { numeric: true })
}
const trustedUrl = (value, repository = APP_REPOSITORY) => {
  if (!value) return null
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('untrusted_update_url')
  const repo = repository && new URL(repository)
  const githubRelease = repo && url.hostname === 'github.com' && url.pathname.startsWith(repo.pathname + '/releases/download/')
  const parts = repo?.pathname.split('/').filter(Boolean) || []
  const githubPages = parts.length === 2 && url.hostname === `${parts[0]}.github.io` && url.pathname.startsWith(`/${parts[1]}/downloads/`)
  const store = ['play.google.com', 'apps.apple.com', 'testflight.apple.com'].includes(url.hostname)
  if (!githubRelease && !githubPages && !store) throw new Error('untrusted_update_url')
  return url.href
}
export function parseUpdateManifest(raw, { repository = APP_REPOSITORY } = {}) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!data || !semver(data.version) || !Number.isInteger(Number(data.versionCode))) throw new Error('invalid_update_manifest')
  const android = data.android || {}, ios = data.ios || {}
  return { version: data.version.replace(/^v/, ''), versionCode: Number(data.versionCode), publishedAt: data.publishedAt || null,
    minimumVersion: data.minimumVersion || null, mandatory: data.mandatory === true, title: String(data.title || `TGym ${data.version}`),
    notes: Array.isArray(data.notes) ? data.notes.map(String).slice(0, 20) : [],
    android: { apk: trustedUrl(android.apk, repository), playStore: trustedUrl(android.playStore, repository), sha256: /^[a-f0-9]{64}$/i.test(android.sha256 || '') ? android.sha256.toLowerCase() : null },
    ios: { appStore: trustedUrl(ios.appStore, repository) } }
}
export const updateAvailable = (current, manifest) => compareVersions(current, manifest.version) < 0
export function updateUrlFor(manifest, distribution = APP_DISTRIBUTION) {
  if (distribution === 'play') return manifest.android.playStore
  if (distribution === 'ios') return manifest.ios.appStore
  return distribution === 'github' ? manifest.android.apk : null
}
export async function checkForAppUpdate({ currentVersion = __APP_VERSION__, force = false, fetcher = fetch, now = Date.now(), manifestUrl = UPDATE_MANIFEST_URL } = {}) {
  if (!manifestUrl) throw new Error('update_not_configured')
  const last = Number(localStorage.getItem('tgym_update_checked_at') || 0)
  // Do not make a newly published APK wait half a day before it can discover an update.
  // The manifest is fetched with no-store, and the foreground listener still prevents spam.
  if (!force && now - last < 60 * 60 * 1000) return { throttled: true, update: null }
  const response = await fetcher(manifestUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error('update_check_failed')
  const manifest = parseUpdateManifest(await response.json())
  localStorage.setItem('tgym_update_checked_at', String(now))
  const dismissed = localStorage.getItem('tgym_update_dismissed')
  return { throttled: false, manifest, update: updateAvailable(currentVersion, manifest) && (force || dismissed !== manifest.version) ? manifest : null }
}
export const dismissUpdate = version => localStorage.setItem('tgym_update_dismissed', version)
