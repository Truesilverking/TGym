import { Capacitor } from '@capacitor/core'
import { t, dateLocale } from './i18n-core.js'
import { isSoundQuiet, soundChoice, soundEnabled } from './sound-preferences.js'

let permissionRequest = null
export const browserNotificationsSupported = () => !Capacitor.isNativePlatform() && typeof Notification !== 'undefined'

// Permission belongs to an explicit gesture, never to an expired timer or boot.
export function requestTimerNotificationPermission() {
  if (!browserNotificationsSupported()) return Promise.resolve(false)
  if (Notification.permission === 'granted') return Promise.resolve(true)
  if (Notification.permission === 'denied' || globalThis.navigator?.userActivation?.isActive === false) return Promise.resolve(false)
  if (!permissionRequest) {
    try {
      permissionRequest = Promise.resolve(Notification.requestPermission()).then(value => value === 'granted').catch(() => false).finally(() => { permissionRequest = null })
    } catch { return Promise.resolve(false) }
  }
  return permissionRequest
}

const appUrl = path => new URL(path, new URL(import.meta.env.BASE_URL || './', location.href)).href
export function sendBrowserTestNotification(S) {
  if (!browserNotificationsSupported() || Notification.permission !== 'granted') return Promise.resolve(false)
  const silent = !soundEnabled(S) || S?.notificationSoundOn === false || soundChoice(S,'notification').id === 'silent' || isSoundQuiet(S)
  const options = { body:t('This is a test notification.'), icon:appUrl('icon-192.png'),badge:appUrl('notification-badge.svg'),
    tag:'tgym-test',silent,renotify:false,timestamp:Date.now(),lang:dateLocale(),data:{url:appUrl('#/home')} }
  if (!silent && S?.vibration !== false) options.vibrate=[180,80,180]
  return showBrowserNotice('TGym',options)
}
async function workerTimerNotice(registration,title,options) {
  if(!registration.active?.postMessage||typeof MessageChannel==='undefined')return null
  return new Promise(resolve=>{
    const channel=new MessageChannel()
    const finish=value=>{clearTimeout(timeout);channel.port1.close();channel.port2.close();resolve(value)}
    const timeout=setTimeout(()=>finish(null),2000)
    channel.port1.onmessage=e=>finish(e.data?.shown===true)
    try {registration.active.postMessage({type:'TGYM_TIMER_NOTICE',notification:{title,...options}},[channel.port2])}
    catch {finish(null)}
  })
}
async function claimTimerSound(event,timestamp) {
  try {
    const registration=await navigator.serviceWorker?.getRegistration?.()
    registration?.active?.postMessage({type:'TGYM_TIMER_HANDLED',notification:{tag:event+'-timer',timestamp}})
  } catch { /* A foreground cue does not depend on the optional worker. */ }
}
async function showBrowserNotice(title,options) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.()
    if(['rest-timer','work-timer'].includes(options.tag)){
      const shown=registration?await workerTimerNotice(registration,title,options):null
      if(shown!==null)return shown
    }
    if (registration?.showNotification) await registration.showNotification(title, options)
    else {
      const notice = new Notification(title, options)
      notice.onclick = () => { notice.close(); window.focus(); location.hash = new URL(options.data.url).hash }
    }
    return true
  } catch { return false }
}

// In the foreground the selected Web Audio cue owns the sound. In the background
// a persistent OS notice owns it instead; browsers choose their system tone.
// Returning false synchronously keeps foreground timer completion immediate.
export function notifyTimerFinished(S, event, occurrence) {
  if (!['rest', 'work'].includes(event) || !browserNotificationsSupported())return false
  const timestamp=Number.isFinite(occurrence)?occurrence:Date.now()
  if(!document.hidden&&document.visibilityState!=='hidden'){
    // Claim a foreground cue as well, so an in-flight server push cannot replay
    // it after the user backgrounds the app or dismisses a previous notice.
    void claimTimerSound(event,timestamp)
    return false
  }
  if(Notification.permission!=='granted')return false
  if (isSoundQuiet(S)) return false
  const silent = !soundEnabled(S) || soundChoice(S, event).id === 'silent'
  const title = t(event === 'rest' ? 'Rest over — next set!' : 'Work timer finished')
  const options = {
    body: t('Return to your workout'), icon: appUrl('icon-192.png'), badge: appUrl('notification-badge.svg'),
    tag: event === 'rest' ? 'rest-timer' : 'work-timer', silent, renotify: false,
    timestamp, lang: dateLocale(),
    data: { type: event === 'rest' ? 'rest-timer' : 'work-timer', url: appUrl('#/workout') },
  }
  if (!silent && S?.vibration !== false) options.vibrate = [180, 80, 180]
  return showBrowserNotice(title,options)
}
