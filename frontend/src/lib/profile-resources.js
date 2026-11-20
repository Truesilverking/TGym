import { profileDatabase, WEB_RESOURCE_STORE } from './web-state.js'

// Version 1 of the browser profile representation. Runtime, native files, cloud
// state and portable backups keep the original strings. Only committed browser
// cores/mirrors use references to immutable, verified resources in IndexedDB.
const VERSION = 1, MIN_BYTES = 32768
const known = new Map()
const fields = { customEx: ['img', 'gif'], inbody: ['image'], customSounds: ['data'] }
const bytes = value => new TextEncoder().encode(value).length
export const isQuotaError = error => error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014 || error?.cause && isQuotaError(error.cause)
export function storageFailure(cause, diagnostics) {
  return Object.assign(new Error(cause?.message || 'Profile persistence failed', { cause }), {
    code: 'profile_persistence_failed', diagnostics: { ...diagnostics, errorName: cause?.name || 'Error' },
  })
}
function slots(state) {
  return Object.entries(fields).flatMap(([collection, names]) => (state[collection] || []).flatMap(record => names.map(field => ({ record, field }))))
}
const reference = value => value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, '$tgymResource')
export function hasProfileResources(state) { return !!state?._webStorage || slots(state).some(({record, field}) => reference(record[field])) }
export function compactProfile(state) {
  const copy = structuredClone(state)
  let used = false
  for (const {record, field} of slots(copy)) {
    const key = known.get(record[field])
    if (key) { record[field] = { $tgymResource: VERSION, key }; used = true }
  }
  delete copy._webStorage
  if (used) copy._webStorage = { version: VERSION }
  return copy
}
export function retainProfileResources(state) {
  const used = new Set(slots(state).map(({record,field})=>record[field]))
  for (const value of known.keys()) if (!used.has(value)) known.delete(value)
}
async function digest(value) {
  if (!globalThis.crypto?.subtle) throw new DOMException('Secure resource storage is unavailable', 'SecurityError')
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return `sha256:${Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('')}`
}
async function resourceTransaction(mode, operation, diagnostics) {
  let db
  try {
    db = await profileDatabase()
    if (!db) throw new DOMException('IndexedDB is unavailable', 'NotSupportedError')
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(WEB_RESOURCE_STORE, mode), store = tx.objectStore(WEB_RESOURCE_STORE)
      let result
      const timer = setTimeout(() => { try { tx.abort() } catch {} reject(new Error('Profile storage is busy')) }, 5000)
      tx.oncomplete = () => { clearTimeout(timer); resolve(result) }
      tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(tx._tgymFailure || tx.error || new Error('Profile resource transaction failed')) }
      try { result = operation(store, tx) } catch (error) { clearTimeout(timer); try { tx.abort() } catch {} reject(error) }
    })
  } catch (cause) { throw storageFailure(cause, { backend: 'indexedDB', database: 'tgym-profile', store: WEB_RESOURCE_STORE, ...diagnostics }) }
  finally { db?.close() }
}
async function readResources(keys) {
  const result = new Map()
  const diagnostics = { stage: 'resource-read', key: keys.join(','), operation:'get' }
  await resourceTransaction('readonly', (store, tx) => {
    for (const key of keys) {
      const request = store.get(key)
      request.onsuccess = () => result.set(key, request.result)
      request.onerror = () => { diagnostics.key = key; tx._tgymFailure = request.error }
    }
  }, diagnostics)
  return result
}
async function verifiedResources(keys) {
  const records = await readResources(keys)
  for (const key of keys) {
    const value = records.get(key)
    try {
      if (typeof value !== 'string' || await digest(value) !== key) throw new Error('A saved profile resource is missing or damaged')
    } catch (cause) { throw storageFailure(cause, { stage: 'resource-verify', backend: 'indexedDB', database: 'tgym-profile', store: WEB_RESOURCE_STORE, key }) }
  }
  return records
}
export async function stageProfileResources(state) {
  const values = [...new Set(slots(state).map(({record, field}) => record[field]).filter(value => typeof value === 'string' && bytes(value) >= MIN_BYTES && (value.startsWith('data:') || (state.customSounds || []).some(sound => sound.data === value))))]
  if (!values.length) return null
  const entries = []
  for (const value of values) {
    let key
    try { key = await digest(value) } catch (cause) { throw storageFailure(cause, { stage: 'resource-hash', backend: 'indexedDB', database: 'tgym-profile', store: WEB_RESOURCE_STORE }) }
    entries.push([key, value])
  }
  const resourceBytes = entries.reduce((sum, [,value]) => sum + bytes(value), 0)
  const diagnostics = { stage: 'resource-write', key: entries.map(([key]) => key).join(','), resourceBytes, operation:'put' }
  await resourceTransaction('readwrite', (store, tx) => {
    for (const [key, value] of entries) {
      diagnostics.key = key
      const request = store.put(value, key)
      if (request) request.onerror = () => { diagnostics.key = key; tx._tgymFailure = request.error }
    }
  }, diagnostics)
  const verified = await verifiedResources(entries.map(([key]) => key))
  // Cache identities only after the complete transaction and fresh read agree.
  for (const [key, value] of verified) known.set(value, key)
  return { state: compactProfile(state), resourceBytes, resourceCount: entries.length }
}
export async function hydrateProfile(state) {
  if (!hasProfileResources(state)) return state
  if (state._webStorage?.version !== VERSION) throw storageFailure(new Error('This profile needs a newer resource storage version'), { stage: 'resource-version', backend: 'localStorage', key: 'gym_state_v1' })
  const copy = structuredClone(state), refs = slots(copy).filter(({record, field}) => reference(record[field]))
  const keys = [...new Set(refs.map(({record, field}) => {
    const value = record[field]
    if (value.$tgymResource !== VERSION || typeof value.key !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.key)) throw storageFailure(new Error('Invalid saved profile resource reference'), { stage: 'resource-reference', backend: 'localStorage', key: 'gym_state_v1' })
    return value.key
  }))]
  const verified = await verifiedResources(keys)
  for (const {record, field} of refs) record[field] = verified.get(record[field].key)
  for (const [key, value] of verified) known.set(value, key)
  delete copy._webStorage
  return copy
}

// A recovery bundle is deliberately not a portable backup: it preserves the raw
// primary and every readable resource without pretending a missing item exists.
export async function exportProfileRecovery(rawProfile) {
  let keys = []
  try { keys = [...new Set(slots(JSON.parse(rawProfile)).filter(({record,field})=>reference(record[field])).map(({record,field})=>record[field].key))] } catch { /* Keep malformed source bytes for manual recovery. */ }
  let available = new Map(), storageError = null
  try { if (keys.length) available = await readResources(keys) } catch (error) { storageError = {name:error.cause?.name || error.name,message:error.cause?.message || error.message} }
  const resources = keys.filter(key=>typeof available.get(key)==='string').map(key=>[key,available.get(key)])
  return {tgym_profile_recovery:1,rawProfile,resources,unavailable:keys.filter(key=>typeof available.get(key)!=='string'),storageError}
}
