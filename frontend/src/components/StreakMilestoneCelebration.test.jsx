// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import StreakMilestoneCelebration from './StreakMilestoneCelebration.jsx'

const styles = readFileSync(resolve('src/components/StreakMilestoneCelebration.css'), 'utf8')

vi.mock('../lib/i18n.js', () => ({ t: (key, ...args) => key.replace(/\{(\d+)\}/g, (_, index) => String(args[index])) }))
let root, host, style, motionPreference
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  motionPreference = window.happyDOM.settings.device.prefersReducedMotion
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  style = document.createElement('style'); style.textContent = styles; document.head.append(style)
})
afterEach(() => {
  act(() => root.unmount()); host.remove(); style.remove()
  delete document.documentElement.dataset.reduceMotion
  delete document.body.dataset.reduceMotion
  window.happyDOM.settings.device.prefersReducedMotion = motionPreference
  vi.useRealTimers()
})

it.each([[2, 4], [4, 8], [8, 12], [52, 104]])('shows the %s-week claim and its next milestone', (weeks, nextWeeks) => {
  act(() => root.render(<StreakMilestoneCelebration claim={{ weeks, nextWeeks }} />))
  expect(host.textContent).toContain(`${weeks} weeks of consistency!`)
  expect(host.textContent).toContain('You are building a lasting habit. Keep it going!')
  expect(host.textContent).toContain(`Next milestone: ${nextWeeks} weeks`)
  expect(host.querySelector('.streak-flame-fill').getAttribute('y')).toBe('0')
  expect(host.querySelector('.streak-flame-fill').getAttribute('height')).toBe('24')
  expect(host.querySelector('[role="dialog"]')).toBeNull()
  expect(host.querySelector('[aria-modal]')).toBeNull()
  const button = host.querySelector('button')
  expect(button.getAttribute('aria-label')).toBe('Close celebration')
  expect(button.querySelector('svg')).not.toBeNull()
  expect(getComputedStyle(button).minWidth).toBe('44px')
  expect(getComputedStyle(button).minHeight).toBe('44px')
})

it('dismisses locally once and stays dismissed when the same claim is supplied again', () => {
  const onDismiss = vi.fn()
  act(() => root.render(<StreakMilestoneCelebration claim={{ weeks: 2, nextWeeks: 4 }} onDismiss={onDismiss} />))
  act(() => host.querySelector('button').click())
  expect(host.textContent).toBe('')
  expect(onDismiss).toHaveBeenCalledTimes(1)
  act(() => root.render(<StreakMilestoneCelebration claim={{ weeks: 2, nextWeeks: 4 }} onDismiss={onDismiss} />))
  expect(host.querySelector('section')).toBeNull()
  expect(onDismiss).toHaveBeenCalledTimes(1)
  act(() => root.render(<StreakMilestoneCelebration claim={{ weeks: 4, nextWeeks: 8 }} onDismiss={onDismiss} />))
  expect(host.textContent).toContain('4 weeks of consistency!')
})

it('does not steal focus or automatically hide the celebration', () => {
  vi.useFakeTimers()
  const other = document.createElement('button'); document.body.append(other); other.focus()
  act(() => root.render(<StreakMilestoneCelebration claim={{ weeks: 2, nextWeeks: 4 }} />))
  expect(document.activeElement).toBe(other)
  act(() => vi.advanceTimersByTime(60000))
  expect(host.textContent).toContain('2 weeks of consistency!')
  expect(document.activeElement).toBe(other)
  other.remove()
})

it.each([null, { weeks: 0 }, { weeks: -2 }, { weeks: 1.5 }])('does not display an absent or invalid claim: %j', claim => {
  act(() => root.render(<StreakMilestoneCelebration claim={claim} />))
  expect(host.querySelector('section')).toBeNull()
})

it('omits a next milestone when no later milestone is supplied', () => {
  act(() => root.render(<StreakMilestoneCelebration claim={{ weeks: 104, nextWeeks: null }} />))
  expect(host.textContent).toContain('104 weeks of consistency!')
  expect(host.textContent).not.toContain('Next milestone:')
})

it.each(['default', 'html', 'body', 'os'])('keeps the celebration still with %s motion preferences', source => {
  if (source === 'html') document.documentElement.dataset.reduceMotion = 'true'
  if (source === 'body') document.body.dataset.reduceMotion = 'true'
  if (source === 'os') {
    window.happyDOM.settings.device.prefersReducedMotion = 'reduce'
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
  }
  act(() => root.render(<StreakMilestoneCelebration claim={{ weeks: 52, nextWeeks: 104 }} />))
  expect(getComputedStyle(host.querySelector('.streak-flame')).animation).toBe('none')
  expect(getComputedStyle(host.querySelector('.streak-flame-fill')).transition).toBe('none')
})
