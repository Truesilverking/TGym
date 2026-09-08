import { parseTGymJson } from './json-import.js'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { mergeTGymStates } from './state-merge.js'
import { createBackup } from './backup.js'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
export const DRIVE_FILE = 'framegym-weekly-backup.json'
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const TOKEN_KEY = 'framegym_google_drive_token_v1'

let gisPromise = null
let memoryToken = null
const NativeGoogleDriveAuth = registerPlugin('GoogleDriveAuth')
export const nativeDriveAuthAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

export const configuredGoogleClientId = state =>
  nativeDriveAuthAvailable()
    ? 'native-android'
    : String(state?.cloudSync?.clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()

export function cloudBackupDue(state, now = Date.now()) {
  if (!state?.cloudSync?.on || !configuredGoogleClientId(state)) return false
  if (state.cloudSync.needsAuth) return false
  const last = Number(state.cloudSync.lastBackupAt) || 0
  const attempted = Number(state.cloudSync.lastAttemptAt) || 0
  if (attempted && now - attempted < 5 * 60 * 1000) return false
  const dirty = Number(state.cloudSync.dirtyAt) || 0
  return dirty ? now - dirty >= 3 * 60 * 1000 : now - last >= WEEK_MS
}

function readToken() {
  if (memoryToken?.accessToken && memoryToken.expiresAt > Date.now() + 30000) return memoryToken
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
    if (saved?.accessToken && saved.expiresAt > Date.now() + 30000) return (memoryToken = saved)
    sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* private browsing can deny storage; the in-memory token still works */ }
  return null
}

function saveToken(response) {
  memoryToken = {
    accessToken: response.access_token,
    expiresAt: Date.now() + Math.max(60, Number(response.expires_in) || 3600) * 1000,
  }
  try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(memoryToken)) } catch { /* optional */ }
  return memoryToken
}

function loadGoogleIdentity() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve(globalThis.google)
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-framegym-gis]')
    const script = existing || document.createElement('script')
    const done = () => globalThis.google?.accounts?.oauth2
      ? resolve(globalThis.google)
      : reject(new Error('Google Identity Services did not load'))
    script.addEventListener('load', done, { once: true })
    script.addEventListener('error', () => reject(new Error('Google Identity Services could not load')), { once: true })
    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true; script.defer = true; script.dataset.framegymGis = '1'
      document.head.appendChild(script)
    }
  })
  return gisPromise
}

async function accessToken(clientId, prompt, interactive) {
  const cached = readToken()
  if (cached) return cached.accessToken
  if (nativeDriveAuthAvailable()) {
    try {
      const result = await NativeGoogleDriveAuth.authorize({ interactive })
      return saveToken({ access_token: result.accessToken, expires_in: result.expiresIn || 3000 }).accessToken
    } catch (error) {
      throw Object.assign(new Error(error?.message || 'Google Drive authorization failed'), { code: error?.code || 'auth_failed' })
    }
  }
  if (!clientId) throw Object.assign(new Error('Google OAuth client ID is required'), { code: 'configuration_required' })
  const google = await loadGoogleIdentity()
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (response?.error) reject(Object.assign(new Error(response.error_description || response.error), { code: response.error }))
        else resolve(saveToken(response).accessToken)
      },
      error_callback: error => reject(Object.assign(new Error(error?.message || error?.type || 'Google authorization failed'), { code: error?.type || 'auth_failed' })),
    })
    // Once the user has granted access, prompt:'' normally renews a short-lived token without
    // another consent screen. If the browser blocks that, Settings shows a reconnect action.
    client.requestAccessToken({ prompt })
  })
}

async function driveFetch(path, token, init = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const error = new Error(`Google Drive ${response.status}${body ? ': ' + body.slice(0, 180) : ''}`)
    error.code = response.status === 401 ? 'auth_required' : 'drive_error'
    throw error
  }
  return response
}

async function latestFile(token) {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`)
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,name,modifiedTime)`
  const data = await (await driveFetch(url, token)).json()
  return data.files?.[0] || null
}

async function snapshotFiles(token) {
  const q = encodeURIComponent("trashed=false and appProperties has { key='app' and value='TGym' } and appProperties has { key='kind' and value='daily-snapshot' }")
  const data = await (await driveFetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&orderBy=name%20desc&pageSize=1000&fields=files(id,name,modifiedTime)`, token)).json()
  return data.files || []
}
async function retainDailySnapshot(token, content) {
  const name = `TGym-backup-${new Date().toISOString().slice(0,10)}.json`
  const files = await snapshotFiles(token)
  if (!files.some(f => f.name === name)) {
    const boundary = `tgym_snapshot_${Date.now()}`
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name, parents: ['appDataFolder'], appProperties: { app: 'TGym', kind: 'daily-snapshot' } })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`
    const created = await (await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', token, { method:'POST', headers:{'Content-Type':`multipart/related; boundary=${boundary}`}, body })).json()
    files.unshift(created)
  }
  for (const old of files.slice(10)) await driveFetch(`https://www.googleapis.com/drive/v3/files/${old.id}`, token, { method:'DELETE' })
}
export async function listGoogleDriveBackups(state) {
  const token = await accessToken(configuredGoogleClientId(state), '', true)
  return snapshotFiles(token)
}

export async function backupToGoogleDrive(state, { interactive = true, allowOverwrite = false } = {}) {
  const prompt = interactive && (!state?.cloudSync?.authorizedOnce || state?.cloudSync?.needsAuth) ? 'consent' : ''
  const token = await accessToken(configuredGoogleClientId(state), prompt, interactive)
  const existing = await latestFile(token)
  if (existing && !allowOverwrite && existing.modifiedTime !== state.cloudSync?.lastModifiedTime) {
    throw Object.assign(new Error('Synchronize all devices before replacing a changed cloud backup.'), { code: 'sync_required' })
  }
  const content = JSON.stringify(createBackup(state))
  let response
  if (existing) {
    response = await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,modifiedTime`, token, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content,
    })
  } else {
    const boundary = `framegym_${Date.now()}`
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: DRIVE_FILE, parents: ['appDataFolder'], appProperties: { app: 'TGym', kind: 'weekly-backup' } })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`
    response = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', token, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    })
  }
  const file = await response.json()
  await retainDailySnapshot(token, content)
  return { fileId: file.id || existing?.id, modifiedTime: file.modifiedTime, at: Date.now() }
}

export async function restoreFromGoogleDrive(state, { interactive = true, fileId } = {}) {
  const prompt = interactive && (!state?.cloudSync?.authorizedOnce || state?.cloudSync?.needsAuth) ? 'consent' : ''
  const token = await accessToken(configuredGoogleClientId(state), prompt, interactive)
  const file = fileId ? (await snapshotFiles(token)).find(f => f.id === fileId) : await latestFile(token)
  if (!file) throw Object.assign(new Error('No TGym backup was found in Google Drive'), { code: 'not_found' })
  const raw = await (await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, token)).text()
  const parsed = parseTGymJson(raw)
  if (parsed.kind !== 'backup') throw new Error('The Google Drive file is not a complete TGym backup')
  return { data: parsed.data, file, at: Date.now() }
}

// Full two-way synchronization for the hosted PWA and the mobile app. Drive remains
// an opaque private app-data file; independent records are merged locally and scalar
// conflicts are returned to the UI instead of silently overwriting either device.
export async function synchronizeWithGoogleDrive(state, { interactive = true } = {}) {
  const prompt = interactive && (!state?.cloudSync?.authorizedOnce || state?.cloudSync?.needsAuth) ? 'consent' : ''
  const token = await accessToken(configuredGoogleClientId(state), prompt, interactive)
  const file = await latestFile(token)
  if (!file) {
    const saved = await backupToGoogleDrive(state, { interactive: false })
    return { merged: structuredClone(state), conflicts: [], fileId: saved.fileId, at: saved.at, created: true }
  }
  const raw = await (await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, token)).text()
  const parsed = parseTGymJson(raw)
  if (parsed.kind !== 'backup') throw new Error('The Google Drive file is not a complete TGym backup')
  const { merged, conflicts } = mergeTGymStates(state, parsed.data)
  return { merged, conflicts, fileId: file.id, at: Date.now(), created: false }
}

export function forgetGoogleDriveToken() {
  const token = readToken()?.accessToken
  memoryToken = null
  try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* optional */ }
  if (token && globalThis.google?.accounts?.oauth2?.revoke) globalThis.google.accounts.oauth2.revoke(token, () => {})
}
