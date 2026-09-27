// App data is deliberately outside service-worker caches. A serialized second copy
// protects against interrupted migrations; deleting the browser's site data still
// requires an exported/cloud backup to recover.
const DATABASE = 'tgym-profile', STORE = 'snapshots'
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
async function writeSnapshot(snapshot) {
    const db = await database()
    if (!db) return false
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE)
        store.put(snapshot, 'current')
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
export async function loadWebState() {
  try {
    await queue?.catch(() => {})
    const db = await database()
    if (!db) return null
    try { return await new Promise((resolve, reject) => {
      const tx=db.transaction(STORE), request=tx.objectStore(STORE).get('current')
      const timer=setTimeout(()=>{reject(new Error('Profile storage is busy'));try {tx.abort()} catch {}},5000)
      request.onsuccess=()=>{clearTimeout(timer);resolve(request.result||null)}
      request.onerror=tx.onabort=()=>{clearTimeout(timer);reject(request.error||tx.error)}
    }) } finally { db.close() }
  } catch { return null }
}
