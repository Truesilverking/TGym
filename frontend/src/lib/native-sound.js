import { Capacitor, registerPlugin } from '@capacitor/core'
import { nativeSoundConfig } from './sound-preferences.js'
import { ACCENTS } from './format.js'
import { t } from './i18n-core.js'

const native = registerPlugin('SoundPreferences')
const android = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
let previous = null, configured = null, queue = Promise.resolve()
let playbackGeneration = 0

export function syncNativeSounds(S) {
  if (!android()) return Promise.resolve(null)
  const config = {...nativeSoundConfig(S),accentColor:ACCENTS[S.accent] || ACCENTS.red,updateLabel:t('Update available')}
  const key = JSON.stringify(config)
  queue = queue.catch(() => null).then(async () => {
    if (key === previous && configured) return configured
    const result = await native.configure(config)
    previous = key; configured = result
    return result
  })
  return queue
}

export async function playNativeSound(S, event, options = {}) {
  if (!android()) return {handled:false,played:false}
  const generation = ++playbackGeneration
  try {
    await syncNativeSounds(S)
    if (generation !== playbackGeneration) return {handled:true,played:false}
    return await native.play({event,preview:!!options.preview,occurrence:options.occurrence || 0})
  } catch (error) { console.warn('[TGym audio] native playback failed; trying Web Audio', error?.message); return {handled:false,played:false} }
}

export async function stopNativeSound() {
  playbackGeneration++
  if (android()) { try { await native.stop() } catch (error) { console.warn('[TGym audio] native stop failed', error?.message) } }
}

export async function finishNativeSoundSync(settings) {
  if (android() && settings?.channels) { try { await native.prune({channels:settings.channels}) } catch (error) { console.warn('[TGym audio] native cleanup failed', error?.message) } }
}
