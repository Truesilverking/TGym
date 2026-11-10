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
  const githubPages = parts.length === 2 && url.hostname === `${parts[0].toLowerCase()}.github.io` && url.pathname.startsWith(`/${parts[1]}/downloads/`)
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
export async function checkForAppUpdate({ currentVersion = __APP_VERSION__, force = false, fetcher = fetch, now = Date.now(), manifestUrl = UPDATE_MANIFEST_URL, distribution = APP_DISTRIBUTION, timeoutMs = 15000 } = {}) {
  const pwa = distribution === 'pwa'
  // Web checks only its own deployed build, never an Android release manifest.
  if (pwa) manifestUrl = new URL('build.json', document.baseURI).href
  if (!manifestUrl) throw new Error('update_not_configured')
  const checkedKey = pwa ? 'tgym_pwa_update_checked_at' : 'tgym_update_checked_at'
  const dismissedKey = pwa ? 'tgym_pwa_update_dismissed' : 'tgym_update_dismissed'
  const last = Number(localStorage.getItem(checkedKey) || 0)
  // Check every four hours automatically. The manifest is fetched with no-store, and the
  // foreground listener still prevents repeated prompts while manual checks bypass this limit.
  if (!force && now - last < 4 * 60 * 60 * 1000) return { throttled: true, update: null }
  // GitHub Pages can briefly serve a cached manifest after a release. Add a
  // request nonce as well as no-store so a newly published version is seen on
  // the first foreground check instead of waiting for the CDN cache to expire.
  const separator = manifestUrl.includes('?') ? '&' : '?'
  const controller = new AbortController()
  let timer
  const request = async () => {
    const response = await fetcher(`${manifestUrl}${separator}check=${now}`, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error('update_check_failed')
    return response.json()
  }
  let raw
  try {
    raw = await Promise.race([request(), new Promise((_, reject) => {
      timer = setTimeout(() => { reject(new Error('update_check_timeout')); controller.abort() }, timeoutMs)
    })])
  } finally { clearTimeout(timer) }
  const manifest = pwa ? parseUpdateManifest({version:raw.version, versionCode:0}) : parseUpdateManifest(raw)
  localStorage.setItem(checkedKey, String(now))
  const dismissed = localStorage.getItem(dismissedKey)
  return { throttled: false, manifest, update: updateAvailable(currentVersion, manifest) && (force || dismissed !== manifest.version) ? manifest : null }
}
export const dismissUpdate = (version, distribution = APP_DISTRIBUTION) => localStorage.setItem(distribution === 'pwa' ? 'tgym_pwa_update_dismissed' : 'tgym_update_dismissed', version)

// update() can resolve while the new worker is still installing. Never reload into
// the old cache; wait for installation and then for the new controller to take over.
export async function activatePwaUpdate(registration, serviceWorker, reload) {
  if (!registration) { reload(); return }
  let timer, installing, onState, onController, expired = false
  try {
    await Promise.race([(async () => {
      await registration.update()
      if (expired) return
      installing = registration.installing
      if (installing && installing.state !== 'installed' && installing.state !== 'activated') {
        await new Promise((resolve, reject) => {
          onState = () => {
            if (['installed', 'activated'].includes(installing.state)) resolve()
            else if (installing.state === 'redundant') reject(new Error('update_install_failed'))
          }
          installing.addEventListener('statechange', onState)
          onState()
        })
      }
      if (expired) return
      if (registration.waiting) {
        await new Promise(resolve => {
          onController = resolve
          serviceWorker.addEventListener('controllerchange', onController)
          registration.waiting.postMessage({type:'SKIP_WAITING'})
        })
      }
    })(), new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error('update_activation_timeout')) }, 30000) })])
    reload()
  } finally {
    clearTimeout(timer)
    if (onState) installing.removeEventListener('statechange', onState)
    if (onController) serviceWorker.removeEventListener('controllerchange', onController)
  }
}
