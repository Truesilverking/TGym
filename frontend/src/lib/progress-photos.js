import { uid, todayISO } from './format.js'

const DB_NAME = 'tgym_private_photos'
const STORE_NAME = 'photos'
const DB_VERSION = 1

function openDB() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Photo storage is unavailable'))
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    let failed = false
    req.onupgradeneeded = ev => {
      const db = ev.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('date', 'date', { unique: false })
      }
    }
    req.onsuccess = () => { if (failed) req.result.close(); else resolve(req.result) }
    req.onerror = () => { failed = true; reject(req.error || new Error('Could not open photo storage')) }
    req.onblocked = () => { failed = true; reject(new Error('Photo storage is blocked')) }
  })
}

// Report success only after the durable transaction commits. A failed write must
// leave the previous photo intact and must not fall back to temporary memory.
async function transaction(mode, operation) {
  const db = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      let result
      tx.oncomplete = () => resolve(result)
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Photo storage operation failed'))
      operation(tx.objectStore(STORE_NAME), value => { result = value })
    })
  } finally { db.close() }
}

export async function saveProgressPhoto({ date = todayISO(), pose = 'front', dataUrl }) {
  if (!dataUrl) return null
  const entry = {
    id: 'photo_' + uid(),
    date,
    pose, // 'front' | 'side' | 'back'
    dataUrl,
    createdAt: Date.now(),
  }

  return transaction('readwrite', (store, result) => {
    const req = store.getAll()
    req.onsuccess = () => {
      const existing = req.result.find(p => p.date === date && p.pose === pose)
      if (existing) entry.id = existing.id
      store.put(entry)
      result(entry)
    }
  })
}

export async function getProgressPhotos() {
  return transaction('readonly', (store, result) => {
    const req = store.getAll()
    req.onsuccess = () => {
      const items = req.result || []
      items.sort((a, b) => b.createdAt - a.createdAt)
      result(items)
    }
  })
}

export async function deleteProgressPhoto(id) {
  return transaction('readwrite', (store, result) => {
    store.delete(id)
    result(true)
  })
}
