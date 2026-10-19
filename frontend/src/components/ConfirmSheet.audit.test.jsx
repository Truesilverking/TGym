// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { confirmSheet } from '../sheets.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setLang } from '../lib/i18n.js'

beforeEach(async () => {
  await setLang('en')
  localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null })
  useUI.setState({ sheets: [], timer: null, work: null })
})
afterEach(() => { useUI.getState().closeAll(); vi.restoreAllMocks() })

const dialog = () => {
  const sheet = useUI.getState().sheets.at(-1)
  return sheet.render(() => useUI.getState().closeSheet(sheet.id))
}

it('accepts a confirmation once even if its handler is dispatched again before unmount', () => {
  const onConfirm = vi.fn(), onCancel = vi.fn()
  confirmSheet({ onConfirm, onCancel })
  const content = dialog()
  content.props.onConfirm()
  content.props.onConfirm()
  useUI.getState().closeAll()
  expect(onConfirm).toHaveBeenCalledOnce()
  expect(onCancel).not.toHaveBeenCalled()
})

it('keeps a rejected synchronous save available for retry instead of consuming the decision', () => {
  const onConfirm = vi.fn().mockImplementationOnce(() => { throw new Error('storage full') })
  confirmSheet({ onConfirm })
  const content = dialog()
  expect(() => content.props.onConfirm()).toThrow('storage full')
  content.props.onConfirm()
  content.props.onConfirm()
  expect(onConfirm).toHaveBeenCalledTimes(2)
})

it('does not allow a stale confirmation handler to commit after cancellation', () => {
  const onConfirm = vi.fn(), onCancel = vi.fn()
  confirmSheet({ onConfirm, onCancel })
  const content = dialog()
  useUI.getState().closeAll()
  content.props.onConfirm()
  expect(onConfirm).not.toHaveBeenCalled()
  expect(onCancel).toHaveBeenCalledOnce()
})
