// App data is deliberately outside service-worker caches. A serialized second copy
// protects against interrupted migrations; deleting the browser's site data still
// requires an exported/cloud backup to recover.
import { readBackup } from './backup.js'

const DATABASE = 'tgym-profile', STORE = 'snapshots'
const PRE_UPDATE = 'pre-update', LEGACY_PRE_UPDATE = 'tgym_pre_update_backup'
let queue = null, pending = null
function database() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { resolve(null); return }
    const request = indexedDB.open(DATABASE, 1)
    let settled = false
    const timer = setTimeout(() => { settled = true; reject(new Error('Profile storage is busy')) }, 5000)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE) }
    request.onerror = () => { clearTimeout(timer); settled = true; reject(request.error) }
    request.onsuccess = () => { clearTimeout(timer); if (settled) request.result.close(); else { settled = true; resolve(request.result) } }
  })
}
async function writeSnapshot(snapshot, key = 'current') {
    const db = await database()
    if (!db) return false
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE)
        store.put(snapshot, key)
        const timer=setTimeout(()=>{ reject(new Error('Profile storage is busy')); try {tx.abort()} catch {} },5000)
        tx.oncomplete=()=>{clearTimeout(timer);resolve()}
        tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(tx.error||new Error('Profile storage failed'))}
      })
      return true
    } finally { db.close() }
}
export function saveWebState(state) {
  pending = structuredClone(state)
  // The primary save is synchronous. Coalesce the secondary mirror so rapid edits
  // never retain an unbounded queue of full profiles (including local images).
  if (!queue) queue = Promise.resolve().then(async () => {
    let result=false, error=null
    while (pending) {
      const snapshot=pending; pending=null
      try {result=await writeSnapshot(snapshot);error=null} catch(e) {error=e}
    }
    if(error)throw error
    return result
  }).finally(()=>{queue=null})
  return queue
}
async function readSnapshot(key) {
  const db = await database()
  if (!db) return null
  try { return await new Promise((resolve, reject) => {
      const tx=db.transaction(STORE), request=tx.objectStore(STORE).get(key)
      const timer=setTimeout(()=>{reject(new Error('Profile storage is busy'));try {tx.abort()} catch {}},5000)
      request.onsuccess=()=>{clearTimeout(timer);resolve(request.result||null)}
      request.onerror=tx.onabort=()=>{clearTimeout(timer);reject(request.error||tx.error)}
  }) } finally { db.close() }
}
export async function loadWebState() {
  try {
    await queue?.catch(() => {})
    return await readSnapshot('current')
  } catch { return null }
}

// A large but valid localStorage profile can leave no room for another full copy.
// Keep the portable safety backup beside, never over, the normal profile mirror.
export async function savePreUpdateBackup(backup) {
  try { if (await writeSnapshot(backup, PRE_UPDATE)) return true } catch { /* Try the legacy browser store. */ }
  try { localStorage.setItem(LEGACY_PRE_UPDATE, backup); return true }
  catch (cause) { throw Object.assign(new Error('pre_update_backup_failed', {cause}), {code:'pre_update_backup_failed'}) }
}
export async function loadPreUpdateBackup() {
  let backup = null, legacy = null
  try { backup = await readSnapshot(PRE_UPDATE) } catch { /* Older installations used localStorage. */ }
  try { legacy = localStorage.getItem(LEGACY_PRE_UPDATE) || null } catch { /* IndexedDB may still be readable. */ }
  // A later fallback wins over an older IndexedDB copy only if its full checksum
  // and portable schema remain valid. Either store can recover the other copy.
  const candidate = value => {
    try {
      const parsed = JSON.parse(value)
      if (!readBackup(parsed)) return null
      return {value, createdAt:Date.parse(parsed.createdAt) || 0}
    } catch { return null }
  }
  const stored = candidate(backup), fallback = candidate(legacy)
  if (!stored) return fallback?.value || null
  return fallback && fallback.createdAt > stored.createdAt ? fallback.value : stored.value
}
