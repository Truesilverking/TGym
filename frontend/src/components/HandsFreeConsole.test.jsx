// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { it, expect, vi } from 'vitest'
import HandsFreeConsole from './HandsFreeConsole.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

it('renders large numbers and handles set completion and weight adjustments', () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  const onComplete = vi.fn()
  const onAdjustWeight = vi.fn()

  act(() => {
    root.render(
      <HandsFreeConsole
        exerciseName="Press Banca"
        setIndex={0}
        totalSets={4}
        weight={100}
        reps={8}
        unit="kg"
        onCompleteSet={onComplete}
        onAdjustWeight={onAdjustWeight}
      />
    )
  })

  expect(container.textContent).toContain('Modo Manos Libres')
  expect(container.textContent).toContain('Press Banca')
  expect(container.textContent).toContain('100')
  expect(container.textContent).toContain('8')

  // Click complete button
  const completeBtn = container.querySelector('button[style*="min-height: 76px"]') || container.querySelectorAll('button')[3]
  act(() => {
    completeBtn?.click()
  })

  expect(onComplete).toHaveBeenCalled()

  act(() => root.unmount())
  container.remove()
})
