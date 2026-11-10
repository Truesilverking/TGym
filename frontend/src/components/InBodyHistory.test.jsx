// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { inBodySheet } from '../sheets.jsx'

vi.mock('./MetricFields.jsx', () => ({ default: ({ values, onChange }) => <>
  <button data-values={JSON.stringify(values)} onClick={() => onChange({ ...values, weight: '80,2', bodyFatPct: '19.5' })}>Enter reading</button>
  <button onClick={() => onChange({ ...values, bodyFatPct: '101' })}>Enter invalid reading</button>
</> }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: key => key }))
let root, host, flush, toast
function Sheets() { return useUI(s => s.sheets).map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>) }
async function click(text) {
  const node = [...host.querySelectorAll('button')].find(node => node.textContent === text)
  expect(node).toBeTruthy(); await act(async () => node.click())
}
async function setDate(value) {
  await act(async () => {
    const node = host.querySelector('input[type=date]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T12:00:00')); localStorage.clear()
  flush = useStore.getState().flushPersistence; toast = vi.fn()
  useStore.setState({ S: { ...structuredClone(DEF), lang: 'en' }, user: null, storageError: null, flushPersistence: vi.fn().mockResolvedValue() })
  useUI.setState({ sheets: [], toast })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => { root.render(<Sheets />); inBodySheet() })
})
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); useStore.setState({ flushPersistence: flush }); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers()
})

it('rejects empty, future and invalid readings before persistence, and supports cancellation', async () => {
  await click('Add'); await click('Save InBody result')
  expect(useStore.getState().S.inbody).toEqual([])
  await click('Enter reading')
  await setDate('2026-10-20')
  await click('Save InBody result')
  expect(useStore.getState().S.inbody).toEqual([])
  await setDate('2026-10-19')
  await click('Enter invalid reading'); await click('Save InBody result')
  expect(useStore.getState().S.inbody).toEqual([])
  expect(useStore.getState().flushPersistence).not.toHaveBeenCalled()
  await click('Cancel')
  expect(host.textContent).toContain('No InBody results in this period')
})

it('retries a failed mirror write without duplicating a reading, and reopens persisted values', async () => {
  useStore.getState().flushPersistence.mockRejectedValueOnce(new Error('Synthetic mirror failure'))
  await click('Add'); await click('Enter reading'); await click('Save InBody result')
  expect(useStore.getState().S.inbody).toHaveLength(1)
  expect(host.textContent).toContain('Add InBody result')
  expect(toast).toHaveBeenCalledWith('Could not save. Check available storage and try again.')
  const first = structuredClone(useStore.getState().S.inbody[0])
  await click('Save InBody result')
  expect(useStore.getState().S.inbody).toEqual([first])
  expect(first).toMatchObject({ d: '2026-10-19', weight: 80.2, bodyFatPct: 19.5 })
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.inbody).toEqual([first])
  await act(async () => { root.unmount(); root = createRoot(host); useStore.setState({ S: saved }); useUI.setState({ sheets: [] }); root.render(<Sheets />); inBodySheet() })
  expect(host.querySelectorAll('.inbody-list .item')).toHaveLength(1)
})

it('edits a date without removing a same-day record or its attached original image', async () => {
  const rows = [{ id: 'selected', d: '2026-10-18', t: 12, weight: 79, image: 'data:image/jpeg;base64,AA' }, { id: 'other', d: '2026-10-19', t: 13, weight: 82, image: 'other-image' }]
  await act(async () => useStore.setState({ S: { ...useStore.getState().S, inbody: rows } }))
  await act(async () => host.querySelectorAll('.inbody-list .item')[1].click())
  expect(host.querySelector('.inbody-preview').getAttribute('src')).toBe(rows[0].image)
  await click('Enter reading')
  await setDate('2026-10-19')
  await click('Save InBody result')
  const result = useStore.getState().S.inbody
  expect(result).toHaveLength(2)
  expect(result.find(row => row.id === 'selected')).toMatchObject({ id: 'selected', d: '2026-10-19', t: 12, weight: 80.2, image: rows[0].image })
  expect(result.find(row => row.id === 'other')).toEqual(rows[1])
})
