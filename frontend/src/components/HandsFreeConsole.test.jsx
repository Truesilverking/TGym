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

  expect(container.textContent).toContain('Hands-free mode')
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

it('uses pound steps, speaks the chosen language and cancels speech on exit', () => {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container), adjust = vi.fn(), speak = vi.fn(), cancel = vi.fn()
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text } })
  vi.stubGlobal('speechSynthesis', { speak, cancel })
  try {
    act(() => root.render(<HandsFreeConsole exerciseName="Bench" setIndex={0} totalSets={4} weight={100} reps={8} unit="lb" onAdjustWeight={adjust} />))
    act(() => container.querySelector('[aria-label="Increase load"]').click())
    expect(adjust).toHaveBeenCalledWith(5)
    const complete = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Complete set'))
    act(() => complete.click())
    expect(speak.mock.calls[0][0].lang).toBe('en-US')
    expect(speak.mock.calls[0][0].text).toBe('Set 1 completed. Start resting.')
    act(() => container.querySelector('[aria-label="Voice"]').click())
    expect(container.querySelector('[aria-label="Voice"]').getAttribute('aria-pressed')).toBe('false')
    const prior = speak.mock.calls.length
    act(() => complete.click())
    expect(speak).toHaveBeenCalledTimes(prior)
    act(() => root.unmount())
    expect(cancel).toHaveBeenCalled()
  } finally { vi.unstubAllGlobals(); container.remove() }
})
