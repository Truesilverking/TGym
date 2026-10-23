// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { it, expect, vi, beforeEach } from 'vitest'
import Nutrition from './Nutrition.jsx'
import { useStore, DEF } from '../store/useStore.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.clear()
  useStore.setState({
    S: JSON.parse(JSON.stringify(DEF)),
    user: null,
  })
})

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
