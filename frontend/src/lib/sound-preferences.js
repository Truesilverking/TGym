// Small portable clips: at most 3 x 5 seconds of mono 16 kHz PCM. Keeping these
// bounded assets in the existing state also keeps backups/native restoration whole.
export const MAX_CUSTOM_SOUNDS = 3
export const MAX_SOUND_SECONDS = 5
export const MAX_SOUND_FILE_BYTES = 2 * 1024 * 1024
export const SOUND_RATE = 16000
export const SOUND_EVENTS = [
  { id: 'rest', label: 'Rest finished' },
  { id: 'work', label: 'Work timer finished' },
  { id: 'countdown', label: 'Final countdown' },
  { id: 'set', label: 'Set completed' },
  { id: 'completion', label: 'Workout completed' },
  { id: 'notification', label: 'Notifications' },
]
export const SOUND_PRESETS = [
  { id: 'classic', label: 'Classic' }, { id: 'chime', label: 'Chime' },
  { id: 'pulse', label: 'Pulse' }, { id: 'soft', label: 'Soft' },
  { id: 'silent', label: 'Silent' },
]
export const DEFAULT_SOUNDS = Object.fromEntries(SOUND_EVENTS.map(({ id }) => [id, 'classic']))
const fail = code => Object.assign(new Error(code), { code })
const base64 = bytes => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(s)
}
export function soundBytes(data) {
  if (typeof data !== 'string' || data.length > Math.ceil((44 + SOUND_RATE * 2 * MAX_SOUND_SECONDS) / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw fail('invalid_audio')
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  const text = (a, b) => String.fromCharCode(...bytes.subarray(a, b))
  if (bytes.length < 46 || text(0, 4) !== 'RIFF' || text(8, 12) !== 'WAVE' || text(12, 16) !== 'fmt ' || text(36, 40) !== 'data' ||
    view.getUint32(4, true) !== bytes.length - 8 || view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 || view.getUint32(24, true) !== SOUND_RATE || view.getUint32(28, true) !== SOUND_RATE * 2 ||
    view.getUint16(32, true) !== 2 || view.getUint16(34, true) !== 16 || view.getUint32(40, true) !== bytes.length - 44 || bytes.length % 2) throw fail('invalid_audio')
  return bytes
}
export function encodeSound(samples) {
  if (!samples?.length || samples.length > SOUND_RATE * MAX_SOUND_SECONDS) throw fail('too_long')
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer)
  const str = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  str(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, SOUND_RATE, true); view.setUint32(28, SOUND_RATE * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i] || 0)) * 32767), true)
  return base64(bytes)
}
const presets = new Map()
function presetSound(id, event) {
  const key = `${id}:${event}`
  if (presets.has(key)) return presets.get(key)
  const brief = event === 'set' || event === 'countdown'
  let notes
  if (id === 'classic') notes = brief ? [[event === 'set' ? 1040 : 660, 0, .12]] : event === 'completion' ? [[880, 0, .15], [1100, .18, .15], [1320, .36, .3]] : [[880, 0, .15], [880, .25, .15], [1320, .5, .4]]
  else if (id === 'chime') notes = brief ? [[1200, 0, .16]] : [[880, 0, .3], [1320, .18, .5]]
  else if (id === 'pulse') notes = brief ? [[750, 0, .1]] : [[660, 0, .12], [990, .2, .12], [990, .4, .18]]
  else notes = brief ? [[440, 0, .12]] : [[440, 0, .45], [660, .25, .45]]
  const duration = Math.max(...notes.map(([, start, dur]) => start + dur))
  const samples = new Float32Array(Math.ceil(duration * SOUND_RATE))
  for (const [freq, start, dur] of notes) {
    for (let i = Math.round(start * SOUND_RATE); i < Math.min(samples.length, (start + dur) * SOUND_RATE); i++) {
      const t = i / SOUND_RATE - start
      const env = Math.max(0, Math.min(t / .012, (dur - t) / .04, 1)) * Math.exp(-3 * t / dur)
      samples[i] += Math.sin(2 * Math.PI * freq * t) * env * .3
    }
  }
  const result = { id: `${id}_${event}`, name: SOUND_PRESETS.find(p => p.id === id).label, duration, data: encodeSound(samples) }
  presets.set(key, result)
  return result
}
// Invalid/missing imported selections safely use the original sound.
export function soundChoice(S, event) {
  const id = S?.sounds?.[event] || 'classic'
  if (id === 'silent') return { id: 'silent', name: 'Silent', duration: 0 }
  if (SOUND_PRESETS.some(p => p.id === id)) return { ...presetSound(id, event), id }
  const custom = (Array.isArray(S?.customSounds) ? S.customSounds : []).slice(0, MAX_CUSTOM_SOUNDS).find(x => x?.id === id && /^custom_[a-zA-Z0-9-]{1,64}$/.test(x.id))
  if (custom) {
    try { const bytes = soundBytes(custom.data); return { ...custom, duration: (bytes.length - 44) / SOUND_RATE / 2 } } catch { /* use original */ }
  }
  return { ...presetSound('classic', event), id: 'classic' }
}
export function removeCustomSound(S, id) {
  S.customSounds = (S.customSounds || []).filter(sound => sound.id !== id)
  S.sounds = { ...DEFAULT_SOUNDS, ...S.sounds }
  for (const { id: event } of SOUND_EVENTS) if (S.sounds[event] === id) S.sounds[event] = 'classic'
}
export function isSoundQuiet(S, now = new Date()) {
  const r = S?.reminder || {}
  if (!r.quietOn) return false
  const minutes = (value, fallback) => {
    const s = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback
    const [h, m] = s.split(':').map(Number); return h * 60 + m
  }
  const start = minutes(r.quietStart, '22:00'), end = minutes(r.quietEnd, '07:00'), cur = now.getHours() * 60 + now.getMinutes()
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end
}
export function nativeSoundConfig(S) {
  return { sounds: Object.fromEntries(SOUND_EVENTS.map(({ id }) => [id, soundChoice(S, id)])), enabled: S?.sound !== false,
    vibration: S?.vibration !== false, quietOn: !!S?.reminder?.quietOn, quietStart: S?.reminder?.quietStart || '22:00', quietEnd: S?.reminder?.quietEnd || '07:00' }
}
export async function importCustomSound(file) {
  if (!file || file.size === 0) throw fail('invalid_audio')
  if (file.size > MAX_SOUND_FILE_BYTES) throw fail('too_large')
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AudioContext) throw fail('invalid_audio')
  let context
  try {
    context = new AudioContext({ sampleRate: SOUND_RATE })
    const audio = await context.decodeAudioData(await file.arrayBuffer())
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !audio.numberOfChannels || audio.numberOfChannels > 8) throw fail('invalid_audio')
    if (audio.duration > MAX_SOUND_SECONDS) throw fail('too_long')
    const samples = new Float32Array(Math.max(1, Math.round(audio.duration * SOUND_RATE)))
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const source = audio.getChannelData(channel)
      for (let i = 0; i < samples.length; i++) {
        const x = i * audio.sampleRate / SOUND_RATE, lo = Math.min(source.length - 1, Math.floor(x)), hi = Math.min(source.length - 1, lo + 1)
        samples[i] += (source[lo] + (source[hi] - source[lo]) * (x - lo)) / audio.numberOfChannels
      }
    }
    return { id: `custom_${crypto.randomUUID()}`, name: String(file.name || 'Audio').replace(/\.[^.]+$/, '').slice(0, 60), duration: samples.length / SOUND_RATE, data: encodeSound(samples) }
  } catch (error) { throw error?.code ? error : fail('invalid_audio') }
  finally { if (context) await context.close().catch(() => {}) }
}
