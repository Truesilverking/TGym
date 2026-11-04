// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import StreakFlame from './StreakFlame.jsx'

const css = readFileSync(resolve('src/index.css'), 'utf8')
let host, root, styles, motionPreference
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  motionPreference = window.happyDOM.settings.device.prefersReducedMotion
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  styles = document.createElement('style'); styles.textContent = css; document.head.append(styles)
})
afterEach(() => {
  act(() => root.unmount()); host.remove(); styles.remove()
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.reduceMotion
  window.happyDOM.settings.device.prefersReducedMotion = motionPreference
})

it.each([1, 4, 7, 14, 30, 50, 100, 365])('fills the entire SVG path for an active streak of %s without a milestone option', value => {
  act(() => root.render(<StreakFlame value={value} />))
  const flame = host.querySelector('.streak-flame'), fill = host.querySelector('.streak-flame-fill')
  expect(flame.classList.contains('active')).toBe(true)
  expect(fill.tagName.toLowerCase()).toBe('path')
  expect(fill.getAttribute('d')).toBe(host.querySelector('.streak-flame-outline').getAttribute('d'))
  expect(fill.getAttribute('opacity')).toBe('1')
  expect(fill.style.opacity).toBe('1')
  expect(fill.style.fill).toMatch(/^url\(#streak-fill-/)
  expect(fill.hasAttribute('clip-path')).toBe(false)
  expect(host.querySelector('rect,clipPath')).toBeNull()
  expect(host.querySelector('svg').getAttribute('viewBox')).toBe('0 0 24 24')
})

it.each([true, false])('keeps legacy filled=%s compatible while every active icon remains filled', filled => {
  act(() => root.render(<StreakFlame value={1} filled={filled} />))
  expect(host.querySelector('.streak-flame-fill').style.opacity).toBe('1')
  expect(host.querySelector('.streak-flame-fill').style.fill).not.toBe('none')
})

it('keeps zero neutral and empty even when a consumer requests full fill', () => {
  act(() => root.render(<StreakFlame value={0} filled />))
  const fill = host.querySelector('.streak-flame-fill')
  expect(host.querySelector('.streak-flame.inactive')).not.toBeNull()
  expect(fill.getAttribute('fill')).toBe('none')
  expect(fill.getAttribute('opacity')).toBe('0')
  expect(fill.style.opacity).toBe('0')
  expect(getComputedStyle(host.querySelector('.streak-flame')).animation).toBe('none')
})

it.each(['dark', 'light'])('keeps a warm opaque gradient inside blue/purple/legend wrappers in %s theme', theme => {
  document.documentElement.dataset.theme = theme
  act(() => root.render(<><div className="header-streak streak-blue"><StreakFlame value={30} /></div><div className="streak-hero compact streak-purple"><StreakFlame value={50} /></div><div className="streak-legend"><StreakFlame value={100} /></div></>))
  for (const flame of host.querySelectorAll('.streak-flame')) {
    const paint = getComputedStyle(flame)
    expect(paint.getPropertyValue('--streak-flame-yellow')).toBe('#ffd60a')
    expect(paint.getPropertyValue('--streak-flame-orange')).toBe('#ff9f0a')
    expect(paint.color).toBe('#ff9f0a')
    expect(paint.animation).not.toContain('streak-rainbow')
    const fill = flame.querySelector('.streak-flame-fill'), gradient = flame.querySelector('linearGradient')
    expect(fill.getAttribute('fill')).toBe(`url(#${gradient.id})`)
    expect(fill.style.opacity).toBe('1')
    expect(gradient.querySelectorAll('stop')).toHaveLength(2)
  }
  expect(new Set([...host.querySelectorAll('linearGradient')].map(e => e.id)).size).toBe(3)
})

it('preserves inactive-to-active transitions and app reduced motion without hiding the fill', () => {
  document.documentElement.dataset.reduceMotion = 'true'
  act(() => root.render(<div className="streak-legend"><StreakFlame value={0} /></div>))
  expect(host.querySelector('.streak-flame-fill').style.fill).toBe('none')
  act(() => root.render(<div className="streak-legend"><StreakFlame value={1} /></div>))
  expect(host.querySelector('.streak-flame-fill').style.opacity).toBe('1')
  expect(getComputedStyle(host.querySelector('.streak-flame')).animation).toBe('none')
  expect(getComputedStyle(host.querySelector('.streak-flame-fill')).transition).toBe('none')
})

it('keeps zero gray and still inside a legacy legend wrapper in light theme', () => {
  document.documentElement.dataset.theme = 'light'
  act(() => root.render(<div className="streak-legend"><StreakFlame value={0} /></div>))
  const flame = host.querySelector('.streak-flame')
  expect(getComputedStyle(flame).animation).toBe('none')
  const neutral = getComputedStyle(document.documentElement).getPropertyValue('--label-3').replaceAll(' ', '')
  expect(getComputedStyle(flame).getPropertyValue('--streak-flame-edge').replaceAll(' ', '')).toBe(neutral)
  expect(getComputedStyle(flame).color.replaceAll(' ', '')).toBe(neutral)
  expect(flame.querySelector('.streak-flame-fill').style.fill).toBe('none')
})

it('honors OS reduced motion while keeping the first-day fill visible and the header dimensions intact', () => {
  window.happyDOM.settings.device.prefersReducedMotion = 'reduce'
  act(() => root.render(<div className="header-streak"><StreakFlame value={1} /></div>))
  const flame = host.querySelector('.streak-flame'), paint = getComputedStyle(flame)
  expect(paint.animation).toBe('none')
  expect(paint.width).toBe('28px'); expect(paint.height).toBe('30px')
  expect(flame.querySelector('.streak-flame-fill').style.opacity).toBe('1')
  expect(getComputedStyle(flame.querySelector('.streak-flame-fill')).transition).toBe('none')
})

it('keeps the actual fill opaque when a surrounding outlined-icon variant declares fill none', () => {
  styles.textContent += '\n.header-streak svg path{fill:none;opacity:.2}'
  act(() => root.render(<div className="header-streak"><StreakFlame value={1} /></div>))
  const fill = host.querySelector('.streak-flame-fill'), paint = getComputedStyle(fill)
  expect(paint.fill).toMatch(/^url\(#streak-fill-/)
  expect(paint.opacity).toBe('1')
})
