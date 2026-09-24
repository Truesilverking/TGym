import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SOUNDS, SOUND_EVENTS, SOUND_PRESETS, SOUND_RATE, encodeSound, soundBytes, soundChoice, soundVolume, soundEnabled, scaledSoundData, nativeSoundConfig, removeCustomSound, importCustomSound, isSoundQuiet } from './sound-preferences.js'
import { createBackup, readBackup } from './backup.js'
import { mergeTGymStates } from './state-merge.js'

afterEach(() => vi.unstubAllGlobals())
describe('portable sound preferences', () => {
  it('keeps old profiles audible with original defaults for every event', () => {
    for (const { id } of SOUND_EVENTS) expect(soundChoice({}, id).id).toBe('classic')
    expect(nativeSoundConfig({ sound: false, vibration: false }).enabled).toBe(false)
  })
  it('renders each preset/event as a valid bounded PCM WAV', () => {
    for (const preset of SOUND_PRESETS.filter(p => p.id !== 'silent')) for (const event of SOUND_EVENTS) {
      const sound = soundChoice({ sounds: { [event.id]: preset.id } }, event.id)
      expect(soundBytes(sound.data).length).toBeGreaterThan(44)
      expect(sound.duration).toBeLessThanOrEqual(5)
      const bytes=soundBytes(sound.data),pcm=new Int16Array(bytes.buffer,44)
      expect((bytes.length-44)/32000).toBeCloseTo(sound.duration,3)
      expect(Math.max(...pcm.map(Math.abs))).toBeGreaterThan(3000)
      expect(Math.sqrt(pcm.reduce((n,x)=>n+x*x,0)/pcm.length)/32768).toBeGreaterThan(.02)
    }
    expect(soundChoice({ sounds: { rest: 'silent' } }, 'rest').data).toBeUndefined()
  })
  it('recovers a custom clip, its selection and training data after backup/reload', () => {
    const clip = { id: 'custom_test', name: 'My clip', data: encodeSound(new Float32Array([.2, -.2, 0])), duration: 3 / SOUND_RATE }
    const state = { workouts: [{ id: 'w' }], routines: [], sounds: { rest: clip.id }, customSounds: [clip] }
    const restored = readBackup(JSON.parse(JSON.stringify(createBackup(state))))
    expect(soundChoice(restored, 'rest')).toEqual(clip)
    expect(restored.workouts).toEqual(state.workouts)
  })
  it('falls back for missing, corrupted, oversized and non-WAV imported clips', () => {
    for (const data of ['', 'AAAA', 'A'.repeat(300000), btoa('<script>')]) {
      expect(soundChoice({ sounds: { rest: 'custom_x' }, customSounds: [{ id: 'custom_x', data }] }, 'rest').id).toBe('classic')
    }
    expect(soundChoice({ sounds: { rest: 'gone' } }, 'rest').id).toBe('classic')
  })
  it('removes a clip and resets every reference, preserving unrelated choices', () => {
    const S = { customSounds: [{ id: 'custom_x' }, { id: 'custom_y' }], sounds: { ...DEFAULT_SOUNDS, rest: 'custom_x', work: 'custom_x', set: 'soft' } }
    removeCustomSound(S, 'custom_x')
    expect(S.sounds.rest).toBe('classic'); expect(S.sounds.work).toBe('classic'); expect(S.sounds.set).toBe('soft')
    expect(S.customSounds).toEqual([{ id: 'custom_y' }])
  })
  it('preserves this device sound choices and assets together during cloud merges', () => {
    const local = { sounds: { rest: 'custom_x' }, customSounds: [{ id: 'custom_x', data: 'local' }] }
    const remote = { sounds: { rest: 'custom_y' }, customSounds: [{ id: 'custom_y', data: 'remote' }] }
    const { merged, conflicts } = mergeTGymStates(local, remote)
    expect(merged.sounds).toEqual(local.sounds); expect(merged.customSounds).toEqual(local.customSounds); expect(conflicts).toEqual([])
  })
  it('handles overnight and daytime quiet hours', () => {
    const S = { reminder: { quietOn: true, quietStart: '22:00', quietEnd: '07:00' } }
    expect(isSoundQuiet(S, new Date(2026, 0, 1, 23))).toBe(true)
    expect(isSoundQuiet(S, new Date(2026, 0, 1, 6))).toBe(true)
    expect(isSoundQuiet(S, new Date(2026, 0, 1, 7))).toBe(false)
    S.reminder.quietStart = '10:00'; S.reminder.quietEnd = '12:00'
    expect(isSoundQuiet(S, new Date(2026, 0, 1, 11))).toBe(true)
    expect(isSoundQuiet(S, new Date(2026, 0, 1, 13))).toBe(false)
  })
})
describe('custom audio import', () => {
  function decoder(duration = 1) {
    const close = vi.fn(async () => {})
    const decoded = { duration, sampleRate: SOUND_RATE, numberOfChannels: 2, getChannelData: () => new Float32Array(Math.ceil(SOUND_RATE * duration)).fill(.2) }
    vi.stubGlobal('AudioContext', class { decodeAudioData = async () => decoded; close = close })
    return close
  }
  it('downmixes/encodes and closes decoding resources', async () => {
    const close = decoder()
    const clip = await importCustomSound({ name: 'bell.mp3', size: 100, arrayBuffer: async () => new ArrayBuffer(100) })
    expect(clip.name).toBe('bell'); expect(clip.id).toMatch(/^custom_/); expect(clip.duration).toBe(1)
    expect(soundBytes(clip.data).length).toBe(32044); expect(close).toHaveBeenCalledOnce()
  })
  it('rejects files larger than 2 MB before decoding', async () => {
    await expect(importCustomSound({ size: 2097153 })).rejects.toMatchObject({ code: 'too_large' })
  })
  it('rejects long clips without truncating and releases resources', async () => {
    const close = decoder(5.1)
    await expect(importCustomSound({ size: 100, arrayBuffer: async () => new ArrayBuffer(100) })).rejects.toMatchObject({ code: 'too_long' })
    expect(close).toHaveBeenCalledOnce()
  })
  it('rejects unreadable files', async () => {
    vi.stubGlobal('AudioContext', class { decodeAudioData = async () => { throw Error('bad file') }; close = async () => {} })
    await expect(importCustomSound({ size: 100, arrayBuffer: async () => new ArrayBuffer(100) })).rejects.toMatchObject({ code: 'invalid_audio' })
  })
})

it('persists volume/mute and scales native WAV without modifying originals',()=>{
 const S={sound:true,soundVolume:.25,soundMuted:true,sounds:{rest:'pulse'},customSounds:[],routines:[],workouts:[]}
 const restored=readBackup(JSON.parse(JSON.stringify(createBackup(S))))
 expect(restored.soundVolume).toBe(.25);expect(restored.soundMuted).toBe(true)
 expect(mergeTGymStates(S,{...S,soundVolume:1,soundMuted:false}).merged).toMatchObject({soundVolume:.25,soundMuted:true})
 const original=soundChoice(S,'rest'),scaled=nativeSoundConfig(S)
 const a=new DataView(soundBytes(original.data).buffer),b=new DataView(soundBytes(scaled.sounds.rest.data).buffer)
 for(let i=44;i<a.byteLength;i+=2)expect(b.getInt16(i,true)).toBe(Math.round(a.getInt16(i,true)*.25) || 0)
 expect(scaled.enabled).toBe(false);expect(soundChoice(S,'rest')).toEqual(original)
 expect(soundEnabled({...S,soundMuted:false})).toBe(true)
 expect(soundVolume({soundVolume:NaN})).toBe(1);expect(soundVolume({soundVolume:-1})).toBe(0)
 expect(scaledSoundData(original.data,1)).toBe(original.data)
})
