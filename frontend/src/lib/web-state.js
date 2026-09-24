// App data is deliberately outside service-worker caches. A serialized second copy
// protects against interrupted migrations; deleting the browser's site data still
// requires an exported/cloud backup to recover.
const DATABASE = 'tgym-profile', STORE = 'snapshots'
let queue = Promise.resolve()
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
export function saveWebState(state) {
  const snapshot = structuredClone(state)
  queue = queue.catch(() => false).then(async () => {
    const db = await database()
    if (!db) return false
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE)
        store.put(snapshot, 'current')
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error)
      })
      return true
    } finally { db.close() }
  })
  return queue
}
export async function loadWebState() {
  try {
    await queue.catch(() => {})
    const db = await database()
    if (!db) return null
    try { return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get('current')
      request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error)
    }) } finally { db.close() }
  } catch { return null }
}
