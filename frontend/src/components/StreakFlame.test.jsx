// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import StreakFlame from './StreakFlame.jsx'
import { STREAK_FLAME_IMAGE } from '../lib/streak-flame-image.js'

const css = readFileSync(resolve('src/index.css'), 'utf8')
const packagedImage = readFileSync(resolve('../assets/streak-flame/streak-flame-1.16.1.png'))
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

it.each([1, 4, 7, 14, 30, 50, 100, 365])('shows the shared original flame image for an active streak of %s without a milestone option', value => {
  act(() => root.render(<StreakFlame value={value} />))
  const flame = host.querySelector('.streak-flame'), fill = host.querySelector('.streak-flame-fill')
  expect(flame.classList.contains('active')).toBe(true)
  expect(flame.getAttribute('aria-hidden')).toBe('true')
  expect(fill.tagName.toLowerCase()).toBe('image')
  expect(fill.getAttribute('href')).toBe(STREAK_FLAME_IMAGE)
  expect(fill.getAttribute('opacity')).toBe('1')
  expect(fill.style.opacity).toBe('1')
  expect(fill.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
  expect(fill.getAttribute('draggable')).toBe('false')
  expect(getComputedStyle(fill).pointerEvents).toBe('none')
  expect(host.querySelector('path,linearGradient,clipPath')).toBeNull()
  expect(host.querySelector('svg').getAttribute('viewBox')).toBe('0 0 24 24')
})

it.each([true, false])('keeps legacy filled=%s compatible while every active icon remains visible', filled => {
  act(() => root.render(<StreakFlame value={1} filled={filled} />))
  expect(host.querySelector('.streak-flame-fill').style.opacity).toBe('1')
  expect(host.querySelector('.streak-flame-fill').getAttribute('href')).toBe(STREAK_FLAME_IMAGE)
})

it('keeps zero neutral and empty even when a consumer requests full fill', () => {
  act(() => root.render(<StreakFlame value={0} filled />))
  const fill = host.querySelector('.streak-flame-fill')
  expect(host.querySelector('.streak-flame.inactive')).not.toBeNull()
  expect(host.querySelector('image')).toBeNull()
  expect(fill.getAttribute('fill')).toBe('none')
  expect(fill.getAttribute('opacity')).toBe('0')
  expect(fill.style.opacity).toBe('0')
  expect(getComputedStyle(host.querySelector('.streak-flame')).animation).toBe('none')
})

it.each(['dark', 'light'])('keeps the packaged warm artwork intact inside blue/purple/legend wrappers in %s theme', theme => {
  document.documentElement.dataset.theme = theme
  act(() => root.render(<><div className="header-streak streak-blue"><StreakFlame value={30} /></div><div className="streak-hero compact streak-purple"><StreakFlame value={50} /></div><div className="streak-legend"><StreakFlame value={100} /></div></>))
  expect(STREAK_FLAME_IMAGE).toBe('data:image/png;base64,' + packagedImage.toString('base64'))
  for (const flame of host.querySelectorAll('.streak-flame')) {
    const paint = getComputedStyle(flame)
    expect(paint.filter).toBe('none')
    expect(paint.animation).not.toContain('streak-rainbow')
    expect(flame.querySelector('.streak-flame-fill').getAttribute('href')).toBe(STREAK_FLAME_IMAGE)
    expect(flame.querySelector('.streak-flame-fill').style.opacity).toBe('1')
  }
})

it('preserves inactive-to-active transitions and app reduced motion without hiding the image', () => {
  document.documentElement.dataset.reduceMotion = 'true'
  act(() => root.render(<div className="streak-legend"><StreakFlame value={0} /></div>))
  expect(host.querySelector('.streak-flame-fill').style.fill).toBe('none')
  act(() => root.render(<div className="streak-legend"><StreakFlame value={1} /></div>))
  expect(host.querySelector('.streak-flame-fill').style.opacity).toBe('1')
  expect(host.querySelector('.streak-flame-fill').getAttribute('href')).toBe(STREAK_FLAME_IMAGE)
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

it('honors OS reduced motion while keeping the first-day image visible and the header dimensions intact', () => {
  window.happyDOM.settings.device.prefersReducedMotion = 'reduce'
  act(() => root.render(<div className="header-streak"><StreakFlame value={1} /></div>))
  const flame = host.querySelector('.streak-flame'), paint = getComputedStyle(flame)
  expect(paint.animation).toBe('none')
  expect(paint.width).toBe('28px'); expect(paint.height).toBe('30px')
  expect(flame.querySelector('.streak-flame-fill').style.opacity).toBe('1')
  expect(getComputedStyle(flame.querySelector('.streak-flame-fill')).transition).toBe('none')
})

it('animates active flames in the header and calendar while motion is enabled', () => {
  window.happyDOM.settings.device.prefersReducedMotion = 'no-preference'
  act(() => root.render(<><div className="header-streak"><StreakFlame value={1} /></div><div className="streak-hero"><StreakFlame value={7} /></div></>))
  for (const flame of host.querySelectorAll('.streak-flame')) {
    expect(getComputedStyle(flame).animation).toContain('streak-fire')
    expect(getComputedStyle(flame).animation).toContain('infinite')
  }
})

it('keeps the image visible when a surrounding outlined-icon variant declares path fill none', () => {
  styles.textContent += '\n.header-streak svg path{fill:none;opacity:.2}'
  act(() => root.render(<div className="header-streak"><StreakFlame value={1} /></div>))
  const fill = host.querySelector('.streak-flame-fill'), paint = getComputedStyle(fill)
  expect(fill.getAttribute('href')).toBe(STREAK_FLAME_IMAGE)
  expect(paint.opacity).toBe('1')
})
