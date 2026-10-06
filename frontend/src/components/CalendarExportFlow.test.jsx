// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import CalendarExport from './CalendarExport.jsx'

const mock = vi.hoisted(() => ({ build: vi.fn(), save: vi.fn() }))
vi.mock('../lib/report-file.js', () => ({ reportPagesFile: (...args) => mock.build(...args), saveReportFile: (...args) => mock.save(...args) }))
vi.mock('../lib/i18n.js', () => ({ t: s => s }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
let host, root, mounted
const S = {}, anchor = new Date('2026-09-16T12:00:00')
const file = () => ({ name: 'calendar.pdf', blob: new Blob(['pdf'], { type: 'application/pdf' }) })
const button = title => [...host.querySelectorAll('button')].find(b => b.textContent === title)
const render = (state = S) => act(() => root.render(<CalendarExport S={state} anchor={anchor} close={() => {}} />))
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mock.build.mockReset().mockResolvedValue(file()); mock.save.mockReset().mockResolvedValue(undefined)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:calendar'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); mounted = true
})
afterEach(() => { if (mounted) act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })
it('forces Full Report to PDF, saves its independent file and releases the preview URL', async () => {
  render()
  act(() => { const select = host.querySelector('select'); select.value = 'full'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(host.querySelectorAll('select')[1].value).toBe('pdf'); expect(host.querySelectorAll('select')[1].disabled).toBe(true)
  await act(async () => button('Export').click())
  expect(mock.build.mock.calls[0][0]).toHaveLength(9); expect(mock.build.mock.calls[0][1]).toBe('TGym-Streak-2026-01-01_2026-12-31.pdf')
  await act(async () => button('Share / save').click())
  expect(mock.save).toHaveBeenCalledWith({ ...file(), url: 'blob:calendar' }, { share: true })
  act(() => root.unmount()); mounted = false
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:calendar')
})
it.each(['unmount', 'profile change'])('discards a late file after %s without allocating a preview URL', async action => {
  let resolve; mock.build.mockImplementation(() => new Promise(r => { resolve = r }))
  render(); act(() => { button('Export').click(); button('Export').click() })
  expect(mock.build).toHaveBeenCalledOnce()
  if (action === 'unmount') { act(() => root.unmount()); mounted = false } else render({ workouts: [] })
  await act(async () => resolve(file()))
  expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled()
})
it('invalidates a prepared file when its source profile changes', async () => {
  render(); await act(async () => button('Export').click()); expect(host.textContent).toContain('calendar.pdf')
  render({ workouts: [] })
  expect(host.textContent).not.toContain('calendar.pdf'); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:calendar')
})
it('shows a generation failure and permits retry', async () => {
  mock.build.mockRejectedValueOnce(new Error('Decode failed'))
  render(); await act(async () => button('Export').click())
  expect(host.querySelector('[role="alert"]').textContent).toBe('Export failed. Please try again.')
  await act(async () => button('Export').click())
  expect(host.querySelector('[role="alert"]')).toBeNull(); expect(host.textContent).toContain('calendar.pdf')
})
it('preserves a generated file after a save failure and permits retry', async () => {
  mock.save.mockRejectedValueOnce(new Error('Disk full'))
  render(); await act(async () => button('Export').click()); await act(async () => button('Share / save').click())
  expect(host.querySelector('[role="alert"]').textContent).toBe('Export failed. Please try again.')
  expect(host.textContent).toContain('calendar.pdf')
  await act(async () => button('Share / save').click())
  expect(mock.save).toHaveBeenCalledTimes(2); expect(host.querySelector('[role="alert"]')).toBeNull()
})
it.each([Object.assign(new Error('Canceled'), { name: 'AbortError' }), new Error('Share canceled')])('treats share cancellation as a dismissal', async error => {
  mock.save.mockRejectedValueOnce(error)
  render(); await act(async () => button('Export').click()); await act(async () => button('Share / save').click())
  expect(host.querySelector('[role="alert"]')).toBeNull(); expect(button('Share / save').disabled).toBe(false)
})
