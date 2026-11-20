import { api, pairRedeem } from '../api.js'
import { MOBILE } from '../mobile.js'
import { STANDALONE } from '../demo.js'
import { useStore } from '../../store/useStore.js'
import { mergeScaleRecords } from './scale-records.js'

const KEY = 'tgym_withings_private_connection_v1'
let cached, loading, syncing, epoch = 0
const generation = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
export function scaleServerUrl(raw) {
  try {
    const url = new URL(String(raw).trim())
    if (url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname) || url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) return null
    return url.origin
  } catch { return null }
}
async function readPrivate() {
  if (MOBILE) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    try { return JSON.parse((await Filesystem.readFile({ path: 'withings-connection.json', directory: Directory.Data, encoding: Encoding.UTF8 })).data) } catch { return null }
  }
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}
async function writePrivate(config) {
  if (MOBILE) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path: 'withings-connection.json', directory: Directory.Data, encoding: Encoding.UTF8, data: JSON.stringify(config) })
  } else if (config) localStorage.setItem(KEY, JSON.stringify(config))
  else localStorage.removeItem(KEY)
  cached = config; epoch++
}
export async function scaleConnection() {
  if (cached !== undefined) return cached
  if (!loading) {
    const readEpoch = epoch
    loading = readPrivate().then(value => {
      if (readEpoch !== epoch) return cached ?? null
      cached = value && scaleServerUrl(value.base) === value.base && typeof value.token === 'string' && value.token.length > 0 && value.token.length < 4096 ? { base: value.base, token: value.token } : null
      return cached
    }).finally(() => { loading = null })
  }
  return loading
}
async function requestWith(config, path, { method = 'GET', body } = {}) {
  if (!config && STANDALONE && !useStore.getState().user) throw Error('Scale server is not connected')
  if (!config) return api('/api/withings/' + path, { method, ...(body ? { body: JSON.stringify(body) } : {}), timeoutMs: 60000 })
  const response = await fetch(config.base + '/api/withings/' + path, { method, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw Object.assign(Error('Scale request failed'), { status: response.status })
  return data
}
export async function scaleRequest(path, options) { return requestWith(await scaleConnection(), path, options) }
export async function createScalePairingCode() {
  const result = await api('/api/pair/create', { method: 'POST', body: '{}' })
  if (!/^[A-Za-z0-9-]{4,80}$/.test(String(result.code || ''))) throw Error('Invalid pairing code')
  return result.code
}
export async function pairScaleServer(raw, code) {
  const base = scaleServerUrl(raw)
  if (!base || !String(code).trim()) throw Error('Invalid scale server')
  const result = await pairRedeem(base, String(code).trim())
  if (typeof result.token !== 'string' || !result.token || result.token.length >= 4096 || typeof result.user?.id !== 'string') throw Error('Invalid pairing response')
  const config = { base, token: result.token }
  const status = await requestWith(config, 'status')
  if (typeof status.configured !== 'boolean' || typeof status.connected !== 'boolean') throw Error('Invalid scale server')
  await useStore.getState().updateAtomic(s => { s.smartScaleConnection = { enabled: false, lastSync: 0, generation: generation() } })
  await writePrivate(config)
  return status
}
export async function forgetScaleServer() {
  epoch++
  await useStore.getState().updateAtomic(s => { s.smartScaleConnection = { enabled: false, lastSync: 0, generation: generation() } })
  await writePrivate(null)
}
export async function beginScaleAuthorization() {
  // Open during the actual click, before awaiting a server request: Safari/PWA
  // otherwise treats the authorization window as an unsolicited popup.
  const popup = MOBILE ? null : window.open('about:blank', '_blank')
  if (!MOBILE && !popup) throw Error('Authorization window blocked')
  if (popup) popup.opener = null
  try {
    const result = await scaleRequest('connect', { method: 'POST' })
    const url = new URL(result.url)
    if (url.origin !== 'https://account.withings.com' || url.pathname !== '/oauth2_user/authorize2' || !url.searchParams.get('state')) throw Error('Invalid authorization URL')
    epoch++
    await useStore.getState().updateAtomic(s => { s.smartScaleConnection = { enabled: false, lastSync: 0, generation: generation() } })
    if (MOBILE) { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url: url.href }) }
    else popup.location.href = url.href
  } catch (error) { popup?.close(); throw error }
}
export async function syncScale({ automatic = false } = {}) {
  if (syncing) return syncing
  const operation = async () => {
    let settings = useStore.getState().S.smartScaleConnection
    if (automatic && (!settings?.enabled || Date.now() - (settings.lastSync || 0) < 15 * 60000)) return null
    if (!settings?.generation) {
      await useStore.getState().updateAtomic(s => { s.smartScaleConnection = { ...s.smartScaleConnection, generation: generation() } }, true, !automatic)
      settings = useStore.getState().S.smartScaleConnection
    }
    const requestEpoch = epoch
    const data = await scaleRequest('sync', { method: 'POST', body: { since: settings?.lastSync || 0 } })
    const unchanged = current => requestEpoch === epoch && current?.generation === settings?.generation && current?.lastSync === settings?.lastSync && current?.enabled === settings?.enabled
    if (!unchanged(useStore.getState().S.smartScaleConnection)) throw Error('Scale connection changed')
    if (!Number.isFinite(data.fetchedAt) || data.fetchedAt < 0 || data.fetchedAt > Date.now() + 60000 || !Array.isArray(data.records)) throw Error('Invalid scale response')
    let result
    await useStore.getState().updateAtomic(s => {
      if (!unchanged(s.smartScaleConnection)) throw Error('Scale connection changed')
      result = mergeScaleRecords(s, data.records)
      s.smartScaleConnection = { ...s.smartScaleConnection, enabled: Boolean(settings?.enabled), lastSync: data.fetchedAt }
    }, true, !automatic)
    await useStore.getState().flushPersistence()
    return result
  }
  syncing = operation().finally(() => { syncing = null })
  return syncing
}
export async function disconnectScale() {
  // Disable foreground imports first, even if the remote server is offline.
  epoch++
  await useStore.getState().updateAtomic(s => { s.smartScaleConnection = { ...s.smartScaleConnection, enabled: false } })
  await useStore.getState().flushPersistence()
  await scaleRequest('disconnect', { method: 'POST' })
}
