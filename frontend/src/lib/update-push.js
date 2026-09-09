import { Capacitor, registerPlugin } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

const UpdatePush = registerPlugin('UpdatePush')
export async function initializeUpdatePush(onUpdate) {
  if (!Capacitor.isNativePlatform()) return () => {}
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
    const received = await PushNotifications.addListener('pushNotificationReceived', notify)
    const action = await PushNotifications.addListener('pushNotificationActionPerformed', notify)
    await PushNotifications.register()
    if (Capacitor.getPlatform() === 'android') await UpdatePush.subscribe()
    return () => { void received.remove(); void action.remove() }
  } catch {
    // A build without Firebase configuration must remain fully usable.
    return () => {}
  }
}
