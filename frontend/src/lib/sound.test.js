// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn() }))
vi.mock('./native-sound.js', () => ({ playNativeSound: native.play, stopNativeSound: native.stop }))
let sound, start, stop, decode, haptics
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks()
  native.play.mockResolvedValue({ handled: false }); native.stop.mockResolvedValue()
  start = vi.fn(); stop = vi.fn(); decode = vi.fn(async () => ({})); haptics = vi.fn()
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: haptics })
  vi.stubGlobal('AudioContext', class {
    state = 'running'; destination = {}; resume = async () => {}; decodeAudioData = decode
    createBufferSource = () => ({ connect: vi.fn(), start, stop })
  })
  sound = await import('./sound.js')
})
afterEach(() => { sound.stopSound(); vi.unstubAllGlobals() })
it('routes preset and custom choices to actual audio playback', async () => {
  expect(await sound.playAppSound({ sounds: { rest: 'chime' } }, 'rest')).toBe(true)
  expect(decode).toHaveBeenCalledOnce(); expect(start).toHaveBeenCalledOnce()
  expect(haptics).toHaveBeenCalledWith([200, 100, 200])
})
it('honors global mute, event silence, haptic setting and quiet hours', async () => {
  await sound.playAppSound({ sound: false, vibration: false }, 'rest')
  await sound.playAppSound({ sounds: { rest: 'silent' }, vibration: false }, 'rest')
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 0, 1, 23))
  await sound.playAppSound({ reminder: { quietOn: true, quietStart: '22:00', quietEnd: '07:00' } }, 'rest')
  vi.useRealTimers()
  expect(start).not.toHaveBeenCalled(); expect(haptics).not.toHaveBeenCalled()
})
it('lets the user preview a muted setting without vibrating', async () => {
  expect(await sound.playAppSound({ sound: false }, 'rest', { preview: true })).toBe(true)
  expect(start).toHaveBeenCalledOnce(); expect(haptics).not.toHaveBeenCalled()
})
it('does not replay audio or vibrate when native owns the alert', async () => {
  native.play.mockResolvedValue({ handled: true, played: false })
  await sound.playAppSound({}, 'rest', { occurrence: 123 })
  expect(native.play).toHaveBeenCalledWith({}, 'rest', { preview: false, occurrence: 123 })
  expect(start).not.toHaveBeenCalled(); expect(haptics).not.toHaveBeenCalled()
})
it('stops active playback and prevents a delayed decode from restarting a dismissed preview', async () => {
  await sound.playAppSound({}, 'set', { preview: true })
  let finish
  decode.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = sound.playAppSound({}, 'rest', { preview: true })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  sound.stopSound(); finish({})
  expect(await pending).toBe(false)
  expect(stop).toHaveBeenCalled(); expect(start).toHaveBeenCalledOnce()
})
it('reports unplayable audio rather than rejecting timer callbacks', async () => {
  decode.mockRejectedValueOnce(new Error('decoder unavailable'))
  expect(await sound.playAppSound({}, 'rest')).toBe(false)
})
