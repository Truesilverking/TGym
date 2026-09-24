// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SoundSettings from './SoundSettings.jsx'
import { useStore } from '../store/useStore.js'
import { encodeSound, importCustomSound, SOUND_RATE } from '../lib/sound-preferences.js'
import { playAppSound, stopSound } from '../lib/sound.js'
import { syncNativeSounds } from '../lib/native-sound.js'

vi.mock('../store/useStore.js', async () => {
  const { create } = await import('zustand')
  return { useStore: create(set => ({ S: {}, update(fn) { set(({ S }) => { const next = structuredClone(S); fn(next); return { S: next } }) } })) }
})
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: vi.fn() }) } }))
vi.mock('../lib/i18n.js', () => ({ t: (s, ...args) => s.replace(/\{(\d+)\}/g, (_, i) => args[i]) }))
const audioState=vi.hoisted(()=>({value:{status:'idle'},listeners:new Set()}))
vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), stopSound: vi.fn(), reportSoundError:vi.fn(), getSoundPlayback:()=>audioState.value, subscribeSound:fn=>{audioState.listeners.add(fn);return ()=>audioState.listeners.delete(fn)} }))
vi.mock('../lib/native-sound.js', () => ({ syncNativeSounds: vi.fn() }))
vi.mock('../lib/sound-preferences.js', async importOriginal => ({ ...(await importOriginal()), importCustomSound: vi.fn() }))
vi.mock('./ui.jsx', () => ({
  Button: ({ children, icon, ...props }) => <button {...props}>{children}</button>,
  Row: ({title,children})=><div>{title}{children}</div>,
  Switch: ({checked,onChange})=><button role="switch" aria-checked={checked} onClick={()=>onChange(!checked)} />,
}))

let container, root
const clip = (suffix = 'one') => ({ id: `custom_${suffix}`, name: `${suffix}.wav`, duration: 1, data: encodeSound(new Float32Array(SOUND_RATE)) })
const button = label => [...container.querySelectorAll('button')].find(el => el.textContent === label || el.getAttribute('aria-label') === label)
const eventRow = label => [...container.querySelectorAll('.sound-event')].find(el => el.querySelector('.lrow-t').textContent === label)
const importFile = async () => {
  const input = container.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['audio'], 'my-tone.wav', { type: 'audio/wav' })] })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
}
const choose = async (label, value) => {
 const row=eventRow(label)
 if(!row.querySelector('.sound-options'))await act(()=>row.querySelector('.lrow').click())
 const names={chime:'Chime',silent:'Silent',custom_one:'one.wav'}
 await act(()=>[...row.querySelectorAll('.sound-choice')].find(el=>el.textContent===names[value]).click())
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks();audioState.value={status:'idle'}
  syncNativeSounds.mockResolvedValue(null)
  useStore.setState({ S: { sound: true, sounds: {}, customSounds: [] } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(() => root.render(<SoundSettings />))
})
afterEach(async () => { if (root) await act(() => root.unmount()); root = null; container.remove() })

describe('sound preferences', () => {
  it('stores each selection independently and stops preview playback when dismissed', async () => {
    await choose('Rest finished', 'chime')
    await choose('Set completed', 'silent')
    expect(useStore.getState().S.sounds).toEqual({ rest: 'chime', set: 'silent' })
    expect(button('Preview Set completed').disabled).toBe(true)
    await act(() => button('Preview Rest finished').click())
    expect(playAppSound).toHaveBeenLastCalledWith(useStore.getState().S, 'rest', { preview: true, soundId:'chime' })
    stopSound.mockClear()
    await act(() => root.unmount()); root = null
    expect(stopSound).toHaveBeenCalledOnce()
  })

  it('respects global mute without changing the setting',async()=>{
 await act(()=>useStore.setState({S:{...useStore.getState().S,sound:false}}))
 expect(container.textContent).toContain('Audio is muted.')
 expect(button('Preview Rest finished').disabled).toBe(true)
 await act(()=>button('Preview Rest finished').click());expect(playAppSound).not.toHaveBeenCalled()
 })
 it('previews candidates independently of the saved selection',async()=>{
 await act(()=>eventRow('Rest finished').querySelector('.lrow').click())
 await act(()=>button('Preview Rest finished: Pulse').click())
 expect(playAppSound).toHaveBeenLastCalledWith(useStore.getState().S,'rest',{preview:true,soundId:'pulse'})
 expect(useStore.getState().S.sounds).toEqual({})
 })
 it('shows playing feedback and stops or mutes without changing selections',async()=>{
 await act(()=>{audioState.value={status:'playing',preview:true,event:'rest',soundId:'classic'};audioState.listeners.forEach(fn=>fn())})
 expect(button('Stop Rest finished').getAttribute('aria-pressed')).toBe('true')
 await act(()=>button('Stop Rest finished').click());expect(stopSound).toHaveBeenCalled()
 await act(()=>container.querySelectorAll('[role=switch]')[1].click());expect(useStore.getState().S.soundMuted).toBe(true)
 const range=container.querySelector('input[type=range]')
 await act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(range,'25');range.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(useStore.getState().S.soundVolume).toBe(.25)
 })

  it('explains the notification limitation only on unsupported Android versions', async () => {
    expect(container.textContent).not.toContain('On Android 7 or earlier')
    await act(() => root.unmount())
    syncNativeSounds.mockResolvedValue({ notificationSoundsSupported: false })
    root = createRoot(container)
    await act(() => root.render(<SoundSettings />))
    expect(container.textContent).toContain('On Android 7 or earlier, scheduled reminders use the device notification sound.')
  })

  it('imports one portable clip then resets all references when it is removed', async () => {
    importCustomSound.mockResolvedValueOnce(clip())
    await importFile()
    expect(useStore.getState().S.customSounds).toEqual([clip()])
    expect(container.querySelector('[role=status]').textContent).toContain('Sound added')
    await choose('Rest finished', 'custom_one')
    await choose('Notifications', 'custom_one')
    await act(() => button('Delete one.wav').click())
    expect(useStore.getState().S.customSounds).toEqual([])
    expect(useStore.getState().S.sounds.rest).toBe('classic')
    expect(useStore.getState().S.sounds.notification).toBe('classic')
    expect(eventRow('Rest finished').querySelector('.lrow-s').textContent).toBe('Classic')
  })

  it.each([
    ['too_long', 'no longer than 5 seconds'],
    ['too_large', 'smaller than 2 MB'],
    ['invalid_audio', 'could not be read'],
  ])('explains %s import failures without changing stored clips', async (code, message) => {
    importCustomSound.mockRejectedValueOnce(Object.assign(new Error(code), { code }))
    await importFile()
    expect(container.querySelector('[role=alert]').textContent).toContain(message)
    expect(useStore.getState().S.customSounds).toEqual([])
    expect(button('Add custom sound').disabled).toBe(false)
  })

  it('enforces the custom clip limit before importing', async () => {
    await act(() => useStore.setState({ S: { ...useStore.getState().S, customSounds: [clip('one'), clip('two'), clip('three')] } }))
    expect(button('Add custom sound').disabled).toBe(true)
    await importFile()
    expect(importCustomSound).not.toHaveBeenCalled()
    expect(container.querySelector('[role=alert]').textContent).toContain('Remove a custom sound')
  })

  it('distinguishes insufficient storage from unreadable audio', async () => {
    const update = useStore.getState().update
    importCustomSound.mockResolvedValueOnce(clip())
    await act(() => useStore.setState({ update() { throw new DOMException('Storage full', 'QuotaExceededError') } }))
    try {
      await importFile()
      expect(container.querySelector('[role=alert]').textContent).toContain('Free some storage')
      expect(useStore.getState().S.customSounds).toEqual([])
    } finally { await act(() => useStore.setState({ update })) }
  })

  it('discards an import that finishes after the sheet was closed', async () => {
    let finish
    importCustomSound.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    await importFile()
    expect(button('Reading audio…').disabled).toBe(true)
    await act(() => root.unmount()); root = null
    await act(async () => { finish(clip()) })
    expect(useStore.getState().S.customSounds).toEqual([])
  })

  it.each([false, new Error('unavailable')])('reports a failed preview without changing sound preferences (%s)', async failure => {
    if (failure instanceof Error) playAppSound.mockRejectedValueOnce(failure)
    else playAppSound.mockResolvedValueOnce(failure)
    await act(() => button('Preview Rest finished').click())
    expect(container.querySelector('[role=alert]').textContent).toContain('Could not play')
    expect(useStore.getState().S.sounds).toEqual({})
  })
})
