// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import WorkoutShareCard from './WorkoutShareCard.jsx'

const mock = vi.hoisted(() => ({ raster: vi.fn(), save: vi.fn() }))
vi.mock('html-to-image', () => ({ toBlob: (...args) => mock.raster(...args) }))
vi.mock('../lib/report-file.js', () => ({ saveReportFile: (...args) => mock.save(...args) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container
beforeEach(() => {
  mock.raster.mockReset().mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
  mock.save.mockReset().mockResolvedValue(undefined)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })
const render = workout => act(() => root.render(<WorkoutShareCard workout={workout} unit="kg" close={() => {}} />))
const button = () => [...container.querySelectorAll('button')].find(b => /Share story|Generating/.test(b.textContent))

it('uses the authoritative paused clock, load unit and working-set volume', () => {
  const start = Date.parse('2026-10-26T10:00:00')
  render({ start, end: start + 40 * 60000, pausedDurationMs: 10 * 60000, entries: [{ sets: [{ w: 100, r: 10, done: true, phase: 'warmup' }, { w: 50, r: 8, done: true }] }] })
  expect(container.textContent).toContain('30 min')
  expect(container.textContent).toContain('400 kg')
  expect(container.textContent).not.toContain('undefined')
})

it('retains a valid epoch-zero workout clock', () => {
  render({ start: 0, end: 60000, entries: [] })
  expect(container.textContent).toContain('1 min')
})

it('awaits image creation and sharing and prevents duplicate clicks', async () => {
  let resolveImage, resolveSave
  mock.raster.mockImplementation(() => new Promise(r => { resolveImage = r }))
  mock.save.mockImplementation(() => new Promise(r => { resolveSave = r }))
  render({ d: '2026-10-26', entries: [] })
  await act(async () => { button().click(); button().click(); await Promise.resolve() })
  expect(mock.raster).toHaveBeenCalledTimes(1)
  expect(button().disabled).toBe(true)
  await act(async () => resolveImage(new Blob(['image'])))
  expect(mock.save).toHaveBeenCalledTimes(1)
  expect(button().disabled).toBe(true)
  await act(async () => resolveSave())
  expect(button().disabled).toBe(false)
  expect(mock.save.mock.calls[0][0].name).toBe('tgym-workout-2026-10-26.png')
})

it('shows a recoverable image error but treats share dismissal as cancellation', async () => {
  render({ entries: [] })
  mock.raster.mockResolvedValueOnce(null)
  await act(async () => button().click())
  expect(container.querySelector('[role=alert]').textContent).toContain('Could not create')
  mock.save.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
  await act(async () => button().click())
  expect(container.querySelector('[role=alert]')).toBeNull()
  expect(button().disabled).toBe(false)
  mock.save.mockRejectedValueOnce(new Error('Share canceled'))
  await act(async () => button().click())
  expect(container.querySelector('[role=alert]')).toBeNull()
})
