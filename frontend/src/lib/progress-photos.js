import { uid, todayISO } from './format.js'

const DB_NAME = 'tgym_private_photos'
const STORE_NAME = 'photos'
const DB_VERSION = 1

let memStore = []

function openDB() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = ev => {
      const db = ev.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('date', 'date', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
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

  const db = await openDB()
  if (!db) {
    memStore = memStore.filter(p => !(p.date === date && p.pose === pose))
    memStore.push(entry)
    return entry
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(entry)
    tx.oncomplete = () => resolve(entry)
    tx.onerror = () => resolve(entry)
  })
}

export async function getProgressPhotos() {
  const db = await openDB()
  if (!db) {
    return [...memStore].sort((a, b) => b.createdAt - a.createdAt)
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      const items = req.result || []
      items.sort((a, b) => b.createdAt - a.createdAt)
      resolve(items)
    }
    req.onerror = () => resolve([])
  })
}

export async function deleteProgressPhoto(id) {
  const db = await openDB()
  if (!db) {
    memStore = memStore.filter(p => p.id !== id)
    return true
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}
