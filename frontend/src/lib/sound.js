import { isSoundQuiet, soundBytes, soundChoice } from './sound-preferences.js'
import { playNativeSound, stopNativeSound } from './native-sound.js'

let audioCtx = null, source = null, generation = 0
const buffers = new Map()
export function primeAudio() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext
    if (!Context) return null
    audioCtx ||= new Context()
    if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {})
    return audioCtx
  } catch { return null }
}
export function stopSound() {
  generation++
  try { source?.stop() } catch { /* already finished */ }
  source = null
  void stopNativeSound()
}
export async function playAppSound(S, event, { preview = false, occurrence } = {}) {
  const current = ++generation
  // Native claims rest completion by its end timestamp, shared with the background
  // service. Resuming the WebView cannot replay an already delivered alert.
  const native = await playNativeSound(S, event, { preview, occurrence }).catch(() => null)
  if (native?.handled) return !!native.played
  if (current !== generation) return false
  if (!preview && isSoundQuiet(S)) return false
  if (!preview && S?.vibration !== false && event !== 'countdown' && event !== 'notification') vibrate(event === 'set' ? 30 : [200, 100, 200])
  const choice = soundChoice(S, event)
  if ((!preview && S?.sound === false) || choice.id === 'silent') return false
  const context = primeAudio()
  if (!context) return false
  try {
    await context.resume()
    let buffer = buffers.get(choice.data)
    if (!buffer) {
      buffer = await context.decodeAudioData(soundBytes(choice.data).buffer)
      if (buffers.size >= 24) buffers.clear()
      buffers.set(choice.data, buffer)
    }
    if (current !== generation) return false
    try { source?.stop() } catch { /* ended */ }
    source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start()
    return true
  } catch { return false }
}
export function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p) } catch { /* unsupported */ } }
