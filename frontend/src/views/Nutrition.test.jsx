// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import Nutrition from './Nutrition.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { useUI } from '../store/useUI.js'
import { calculateTDEE } from '../lib/nutrition.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({
    S: JSON.parse(JSON.stringify(DEF)),
    user: null,
  })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('renders the nutrition view with macros, calories and hydration', () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(
      <MemoryRouter>
        <Nutrition />
      </MemoryRouter>
    )
  })

  expect(container.textContent).toContain('Nutrition')
  expect(container.textContent).toContain('Daily calories')
  expect(container.textContent).toContain('Hydration')
  expect(container.textContent).toContain('Breakfast')
  expect(container.textContent).toContain('Lunch')
  expect(container.textContent).toContain('Dinner')

  act(() => root.unmount())
  container.remove()
})

it('moves the selected Today log to the new local day after midnight', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T23:59:59'))
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container)
  try {
    act(() => root.render(<Nutrition />))
    act(() => container.querySelector('[aria-label="Add 250 ml of water"]').click())
    expect(useStore.getState().S.nutrition.logs['2026-10-26'].waterMl).toBe(250)
    act(() => vi.advanceTimersByTime(1002))
    act(() => container.querySelector('[aria-label="Add 250 ml of water"]').click())
    expect(useStore.getState().S.nutrition.logs['2026-10-27'].waterMl).toBe(250)
    expect(useStore.getState().S.nutrition.logs['2026-10-26'].waterMl).toBe(250)
  } finally { act(() => root.unmount()); container.remove() }
})

it('renders malformed optional nutrition data without an error or a profile write', () => {
  const S = { ...structuredClone(DEF), nutrition: { goals: {}, customFoods: {}, logs: { [todayISO()]: { items: [null, { id: 'old', name: {}, meal: 'unknown', calories: 'bad' }] } } } }
  useStore.setState({ S })
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container), writes = vi.spyOn(localStorage, 'setItem')
  try {
    act(() => root.render(<Nutrition />))
    expect(container.textContent).toContain('Daily calories')
    expect(container.textContent).not.toContain('NaN')
    expect(writes).not.toHaveBeenCalled()
  } finally { act(() => root.unmount()); container.remove() }
})

function WithSheets() {
  const sheets = useUI(s => s.sheets)
  return <><Nutrition />{sheets.map(sheet => <div key={sheet.id} role="dialog">{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)}</>
}
const button = (container, label) => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === label)
const input = (container, label) => [...container.querySelectorAll('label')].find(node => node.textContent.includes(label))?.querySelector('input')
const type = (field, value) => act(() => {
  field.focus()
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.blur()
})

it('keeps custom-food drafts on invalid input or storage failure, then saves once on retry', () => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container)
  try {
    act(() => root.render(<WithSheets />))
    act(() => button(container, 'Add').click())
    act(() => button(container, 'Create').click())
    type(input(container, 'Food name'), 'Synthetic audit meal')
    type(input(container, 'Calories (kcal)'), '-50')
    expect(input(container, 'Calories (kcal)').getAttribute('aria-invalid')).toBe('true')
    act(() => button(container, 'Add food').click())
    expect(useStore.getState().S.nutrition.logs).toEqual({})
    type(input(container, 'Calories (kcal)'), '150')
    const writes = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage full') })
    act(() => button(container, 'Add food').click())
    expect(input(container, 'Food name').value).toBe('Synthetic audit meal')
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useStore.getState().S.nutrition.logs).toEqual({})
    expect(useStore.getState().S.nutrition.customFoods).toEqual([])
    expect(useUI.getState().toastMsg).toBe('Could not save changes. Try again.')
    writes.mockRestore()
    const add = button(container, 'Add food')
    act(() => { add.click(); add.click() })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useStore.getState().S.nutrition.customFoods).toHaveLength(1)
    expect(useStore.getState().S.nutrition.logs[todayISO()].items).toHaveLength(1)
  } finally { act(() => root.unmount()); container.remove() }
})

it('blocks applying the calculator while a raw numeric draft is invalid', () => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container)
  try {
    act(() => root.render(<WithSheets />))
    act(() => container.querySelector('[aria-label="Nutrition goals"]').click())
    type(input(container, 'Weight (kg)'), '-80')
    expect(input(container, 'Weight (kg)').getAttribute('aria-invalid')).toBe('true')
    const before = structuredClone(useStore.getState().S)
    act(() => button(container, 'Apply recommendation').click())
    expect(useStore.getState().S).toEqual(before)
    expect(useUI.getState().sheets).toHaveLength(1)
    type(input(container, 'Weight (kg)'), '80')
    act(() => button(container, 'Apply recommendation').click())
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useStore.getState().S.nutrition.goals.calories).toBeGreaterThan(2200)
  } finally { act(() => root.unmount()); container.remove() }
})

it('blocks the continuing pointer click after saving food, then allows the next ordinary click', () => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container), action = vi.fn(), underlay = document.createElement('button')
  underlay.addEventListener('click', action); document.body.appendChild(underlay)
  try {
    act(() => root.render(<WithSheets />))
    act(() => button(container, 'Add').click())
    const food = [...container.querySelectorAll('.nutri-food-row>button')][0]
    act(() => food.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })))
    expect(useUI.getState().sheets).toHaveLength(0)
    const continuation = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 })
    act(() => underlay.dispatchEvent(continuation))
    expect(continuation.defaultPrevented).toBe(true)
    expect(action).not.toHaveBeenCalled()
    act(() => underlay.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    expect(action).toHaveBeenCalledOnce()
  } finally { act(() => root.unmount()); container.remove(); underlay.remove() }
})

it('does not block a keyboard activation after a pointer save or arm the guard for keyboard food saves', () => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container), action = vi.fn(), underlay = document.createElement('button')
  underlay.addEventListener('click', action); document.body.appendChild(underlay)
  try {
    act(() => root.render(<WithSheets />))
    act(() => button(container, 'Add').click())
    const food = [...container.querySelectorAll('.nutri-food-row>button')][0]
    act(() => food.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    act(() => underlay.click())
    expect(action).toHaveBeenCalledOnce()
    // The keyboard click consumed the one-shot listener; no later click is blocked.
    act(() => underlay.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })))
    expect(action).toHaveBeenCalledTimes(2)
    act(() => button(container, 'Add').click())
    act(() => [...container.querySelectorAll('.nutri-food-row>button')][0].click())
    act(() => underlay.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })))
    expect(action).toHaveBeenCalledTimes(3)
  } finally { act(() => root.unmount()); container.remove(); underlay.remove() }
})

it.each([
  { profileUnit: 'lb', rowUnit: undefined, storedWeight: 176.3698 },
  { profileUnit: 'lb', rowUnit: 'kg', storedWeight: 80 },
  { profileUnit: 'kg', rowUnit: 'lb', storedWeight: 176.3698 },
])('opens the calculator in metric units for inch heights and stamped weights: %j', ({ profileUnit, rowUnit, storedWeight }) => {
  const S = structuredClone(DEF)
  Object.assign(S, { unit: profileUnit, measurementUnit: 'in', heightCm: 70, bodyweight: [{ d: '2026-10-20', w: storedWeight, ...(rowUnit ? { unit: rowUnit } : {}) }] })
  useStore.setState({ S })
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container), before = structuredClone(S)
  try {
    act(() => root.render(<WithSheets />))
    act(() => container.querySelector('[aria-label="Nutrition goals"]').click())
    expect(Number(input(container, 'Height (cm)').value)).toBe(177.8)
    expect(Number(input(container, 'Weight (kg)').value)).toBe(80)
    expect(useStore.getState().S).toEqual(before)
    act(() => button(container, 'Apply recommendation').click())
    expect(useStore.getState().S.nutrition.goals.calories).toBe(calculateTDEE({ weightKg: 80, heightCm: 177.8 }).calories)
    expect(useStore.getState().S.heightCm).toBe(70)
    expect(useStore.getState().S.measurementUnit).toBe('in')
    expect(useStore.getState().S.bodyweight).toEqual(before.bodyweight)
  } finally { act(() => root.unmount()); container.remove() }
})
