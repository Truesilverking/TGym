import { afterEach, beforeEach, it, expect, vi } from 'vitest'
import { saveProgressPhoto, getProgressPhotos, deleteProgressPhoto } from './progress-photos.js'

const sample = 'data:image/png;base64,aW1hZ2U='
let records, abortWrite, closed
beforeEach(() => {
  records = new Map(); abortWrite = false; closed = vi.fn()
  vi.stubGlobal('indexedDB', {
    open() {
      const request = {}
      queueMicrotask(() => {
        request.result = {
          close: closed,
          transaction(_store, mode) {
            const tx = {}, draft = new Map(records)
            let pending = 0, failed = false, completed = false
            const issue = (work, writing = false) => {
              const req = {}; pending++
              queueMicrotask(() => {
                if (writing && abortWrite) { failed = true; tx.error = new Error('Quota exceeded'); tx.onabort?.() }
                else { req.result = work(); req.onsuccess?.() }
                pending--
                queueMicrotask(() => {
                  if (!pending && !failed && !completed) {
                    completed = true
                    if (mode === 'readwrite') records = draft
                    tx.oncomplete?.()
                  }
                })
              })
              return req
            }
            tx.objectStore = () => ({
              getAll: () => issue(() => [...draft.values()]),
              put: entry => issue(() => draft.set(entry.id, structuredClone(entry)), true),
              delete: id => issue(() => draft.delete(id), true),
            })
            return tx
          },
        }
        request.onsuccess?.()
      })
      return request
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

it('commits, reads and deletes photos through durable storage', async () => {
  const saved = await saveProgressPhoto({ date: '2026-10-26', pose: 'front', dataUrl: sample })
  expect(records.get(saved.id)).toEqual(saved)
  expect(await getProgressPhotos()).toEqual([saved])
  expect(await deleteProgressPhoto(saved.id)).toBe(true)
  expect(await getProgressPhotos()).toEqual([])
  expect(closed).toHaveBeenCalledTimes(4)
})

it('replaces one date/pose without duplicate identity and retains the prior photo on write abort', async () => {
  const original = await saveProgressPhoto({ date: '2026-10-26', pose: 'front', dataUrl: sample })
  const updated = await saveProgressPhoto({ date: original.date, pose: original.pose, dataUrl: sample + 'new' })
  expect(updated.id).toBe(original.id)
  expect(records.size).toBe(1)
  abortWrite = true
  await expect(saveProgressPhoto({ date: original.date, pose: original.pose, dataUrl: sample + 'failed' })).rejects.toThrow('Quota exceeded')
  expect((await getProgressPhotos())[0]).toEqual(updated)
})

it('does not report a temporary memory save when persistent storage is unavailable', async () => {
  vi.stubGlobal('indexedDB', undefined)
  await expect(saveProgressPhoto({ dataUrl: sample })).rejects.toThrow('Photo storage is unavailable')
})
