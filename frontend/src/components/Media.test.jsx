// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Media, { Thumb } from './Media.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { setLang } from '../lib/i18n.js'

let host, root, media
const exercise = { id: 'qa', n: 'QA exercise', img: 'still.jpg', gif: 'motion.gif' }
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  media = new EventTarget(); media.matches = false
  vi.spyOn(window, 'matchMedia').mockReturnValue(media)
  useStore.setState({ S: { ...structuredClone(DEF), lang: 'en' } })
  await setLang('en')
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })
const mount = () => act(() => root.render(<Media ex={exercise} minimizable />))
const src = () => host.querySelector('img').getAttribute('src')

it.each(['app', 'system'])('starts with a still image for %s reduced motion and permits explicit playback', source => {
  if (source === 'app') useStore.setState({ S: { ...useStore.getState().S, reduceMotion: true } })
  else media.matches = true
  mount()
  expect(src()).toContain('still.jpg')
  const play = host.querySelector('button[aria-label="Play animation"]')
  expect(play).not.toBeNull()
  act(() => play.click())
  expect(src()).toContain('motion.gif')
  act(() => host.querySelector('button[aria-label="Pause animation"]').click())
  expect(src()).toContain('still.jpg')
})

it('responds to an operating-system motion preference change while mounted', () => {
  mount(); expect(src()).toContain('motion.gif')
  act(() => { media.matches = true; media.dispatchEvent(new Event('change')) })
  expect(src()).toContain('still.jpg')
})

it('keeps minimize separate from playback', () => {
  mount()
  act(() => host.querySelector('.giftoggle').click())
  expect(src()).toContain('motion.gif')
  expect(useStore.getState().S.gifSize).toBe('mini')
})

it.each(['app', 'system'])('does not autoplay an uploaded GIF or thumbnail under %s reduced motion', source => {
  if (source === 'app') useStore.setState({ S: { ...useStore.getState().S, reduceMotion: true } })
  else media.matches = true
  const custom = { id: 'custom', n: 'Custom animation', img: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' }
  act(() => root.render(<><Media ex={custom} /><Thumb ex={custom} /></>))
  expect(host.querySelector('img[src^="data:image/gif"]')).toBeNull()
  act(() => host.querySelector('button[aria-label="Play animation"]').click())
  expect(host.querySelectorAll('img[src^="data:image/gif"]')).toHaveLength(1)
  act(() => host.querySelector('button[aria-label="Pause animation"]').click())
  expect(host.querySelector('img[src^="data:image/gif"]')).toBeNull()
})
