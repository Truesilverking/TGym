import { isSoundQuiet, soundBytes, soundChoice, soundEnabled, soundVolume } from './sound-preferences.js'
import { playNativeSound, stopNativeSound } from './native-sound.js'

let audioCtx = null, source = null, gain = null, generation = 0, resumePending = null
const buffers = new Map(), listeners = new Set(), reported = new Set()
let playback = { status: 'idle' }
export const getSoundPlayback = () => playback
export const subscribeSound = listener => { listeners.add(listener); return () => listeners.delete(listener) }
const publish = value => { playback = value; listeners.forEach(fn => fn()) }
export function reportSoundError(stage, error) {
  const key = `${stage}:${error?.name || 'Error'}`
  if (!reported.has(key)) { reported.add(key); console.warn('[TGym audio]', stage, error?.name || 'Error', error?.message || 'Playback unavailable') }
}
// Called synchronously by a trusted click/key gesture, BEFORE any native bridge/decoding await.
export function primeAudio() {
  try {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!Context) return null
    if (!audioCtx || audioCtx.state === 'closed') { audioCtx = new Context(); resumePending = null }
    if (audioCtx.state !== 'running') {
      const context = audioCtx
      const pending = context.resume().catch(error => { reportSoundError('resume', error) }).finally(() => { if (resumePending === pending) resumePending = null })
      resumePending = pending
    }
    return audioCtx
  } catch (error) { reportSoundError('initialize', error); return null }
}
function stopWebSound() {
  const previous = source; source = null
  if (previous) { previous.onended = null; try { previous.stop() } catch { /* already ended */ }; previous.disconnect() }
  gain?.disconnect(); gain = null
}
export function stopSound() {
  generation++; stopWebSound(); publish({ status: 'idle' })
  void stopNativeSound()
}
async function readyContext(context) {
  if (!context) throw Object.assign(new Error('Web Audio is unavailable'), { code: 'audio_unavailable' })
  if (context.state !== 'running') {
    let timer
    try { await Promise.race([resumePending, new Promise(resolve => { timer = setTimeout(resolve, 1500) })]) }
    finally { clearTimeout(timer) }
  }
  if (context.state !== 'running') throw Object.assign(new Error('Audio is suspended; tap Play to enable it'), { code: 'audio_blocked' })
}
export async function playAppSound(S, event, { preview = false, occurrence, soundId } = {}) {
  const current = ++generation
  stopWebSound()
  const choice = soundChoice(soundId ? {...S,sounds:{...S?.sounds,[event]:soundId}} : S, event)
  const info = { event, soundId: choice.id, preview }
  if (preview && (!soundEnabled(S) || choice.id === 'silent')) { publish({ ...info, status:'idle' }); return false }
  // Previews use the same media/Web Audio route on every platform. They never configure
  // notification channels or overwrite the saved preference just to audition a tone.
  const context = primeAudio()
  publish({ ...info, status:'loading' })
  try {
    if (!preview) {
      const native = await playNativeSound(S, event, { occurrence })
      if (current !== generation) return false
      if (native?.handled) { publish({ status:'idle' }); return !!native.played }
      if (isSoundQuiet(S)) { publish({ status:'idle' }); return false }
      if (S?.vibration !== false && event !== 'countdown' && event !== 'notification') vibrate(event === 'set' ? 30 : [200, 100, 200])
    } else await stopNativeSound()
    if (!soundEnabled(S) || choice.id === 'silent') { publish({ status:'idle' }); return false }
    await readyContext(context)
    let buffer = buffers.get(choice.data)
    if (!buffer) {
      buffer = await context.decodeAudioData(soundBytes(choice.data).buffer)
      if (buffers.size >= 24) buffers.clear()
      buffers.set(choice.data, buffer)
    }
    if (current !== generation) return false
    const next = context.createBufferSource(), level = context.createGain()
    source = next; gain = level
    next.buffer = buffer; level.gain.value = soundVolume(S)
    next.connect(level); level.connect(context.destination)
    next.onended = () => { next.disconnect(); level.disconnect(); if (current === generation) { source = null; gain = null; publish({ status:'idle' }) } }
    next.start(); publish({ ...info, status:'playing' })
    return true
  } catch (error) {
    if (current !== generation) return false
    stopWebSound(); reportSoundError(`play:${event}`, error)
    publish({ ...info, status:'error', error: error.code || 'audio_failed' })
    return false
  }
}
export function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p) } catch { /* unsupported */ } }
