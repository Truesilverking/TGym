import {soundEnabled} from './sound-preferences.js'
export function syncWebAudioPreferences(S) {
 if (import.meta.env.DEV || !navigator.serviceWorker) return
 const payload={type:'AUDIO_PREFERENCES',settings:{enabled:soundEnabled(S),notificationSilent:S.sounds?.notification==='silent',restSilent:S.sounds?.rest==='silent',quietOn:!!S.reminder?.quietOn,quietStart:S.reminder?.quietStart,quietEnd:S.reminder?.quietEnd}}
 // Mirror only non-sensitive audio switches, never profile data or imported audio.
 void navigator.serviceWorker.ready.then(reg=>{reg.active?.postMessage(payload);reg.waiting?.postMessage(payload)}).catch(error=>console.warn('[TGym audio] Cannot sync browser notification preferences',error?.message))
}
