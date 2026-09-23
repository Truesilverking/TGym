import { Capacitor, registerPlugin } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

const UpdatePush = registerPlugin('UpdatePush')
export async function initializeUpdatePush(onUpdate) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return () => {}
  const listeners = []
  const stop = () => { for (const listener of listeners.splice(0)) void Promise.resolve(listener.remove()).catch(() => {}) }
  try {
    const permission = await PushNotifications.checkPermissions()
    const granted = permission.receive === 'granted' ? permission : await PushNotifications.requestPermissions()
    if (granted.receive !== 'granted') return () => {}
    // Android delivers notification messages differently depending on app state:
    // received is used while TGym is open, actionPerformed when the user taps a
    // notification from the background. Listen to both so neither path is silent.
    const notify = event => {
      const data = (event.notification || event).data
      if (data?.type === 'app_update') onUpdate?.(data.version)
    }
    listeners.push(await PushNotifications.addListener('pushNotificationReceived', notify))
    listeners.push(await PushNotifications.addListener('pushNotificationActionPerformed', notify))
    // Re-subscribe after FCM has issued or refreshed the device token. This covers a
    // reinstall, restored backup, and token rotation without requiring the user to toggle
    // notifications again.
    listeners.push(await PushNotifications.addListener('registration', () => { void UpdatePush.subscribe().catch(() => {}) }))
    await PushNotifications.register()
    if (Capacitor.getPlatform() === 'android') await UpdatePush.subscribe()
    return stop
  } catch {
    // A build without Firebase configuration must remain fully usable.
    stop()
    return stop
  }
}
