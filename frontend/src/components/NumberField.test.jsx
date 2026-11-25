// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { NumberField } from './ui.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })

describe('NumberField named numeric values', () => {
  it('shows Failure at rest, edits numeric zero on focus, and restores the label on blur', () => {
    const onChange = vi.fn()
    act(() => root.render(<NumberField value={0} displayValue="Failure" onChange={onChange} nullable />))
    const input = container.querySelector('input')
    expect(input.value).toBe('Failure')
    act(() => input.focus())
    expect(input.value).toBe('0')
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(1)
    act(() => input.blur())
    expect(input.value).toBe('Failure')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps editing numeric and leaves nullable cleared values distinct from failure', () => {
    const values = []
    function Field() {
      const [value, setValue] = useState(0)
      return <NumberField value={value} nullable displayValue={value === 0 ? 'Failure' : undefined}
        onChange={v => { values.push(v); setValue(v) }} />
    }
    act(() => root.render(<Field />))
    const input = container.querySelector('input')
    const type = value => act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => input.focus())
    type('1,5')
    expect(values.at(-1)).toBe(1.5)
    act(() => input.blur())
    expect(input.value).toBe('1.5')
    act(() => input.focus())
    type('')
    act(() => input.blur())
    expect(values.at(-1)).toBe(null)
    expect(input.value).toBe('')
  })
})
