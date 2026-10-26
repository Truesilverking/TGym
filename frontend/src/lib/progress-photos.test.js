import { it, expect } from 'vitest'
import { saveProgressPhoto, getProgressPhotos, deleteProgressPhoto } from './progress-photos.js'

it('saves and retrieves private progress photos without throwing', async () => {
  const sample = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const saved = await saveProgressPhoto({
    date: '2026-10-26',
    pose: 'front',
    dataUrl: sample,
  })

  expect(saved).not.toBeNull()
  expect(saved.pose).toBe('front')

  const all = await getProgressPhotos()
  expect(all.length).toBeGreaterThanOrEqual(1)

  const deleted = await deleteProgressPhoto(saved.id)
  expect(deleted).toBe(true)
})
