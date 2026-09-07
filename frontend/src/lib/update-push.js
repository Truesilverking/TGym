import { Capacitor, registerPlugin } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

const UpdatePush = registerPlugin('UpdatePush')
export async function initializeUpdatePush(onUpdate) {
  if (!Capacitor.isNativePlatform()) return () => {}
  try {
    const permission = await PushNotifications.checkPermissions()
    const granted = permission.receive === 'granted' ? permission : await PushNotifications.requestPermissions()
    if (granted.receive !== 'granted') return () => {}
    const action = await PushNotifications.addListener('pushNotificationActionPerformed', event => {
      if (event.notification?.data?.type === 'app_update') onUpdate?.(event.notification.data.version)
    })
    await PushNotifications.register()
    if (Capacitor.getPlatform() === 'android') await UpdatePush.subscribe()
    return () => action.remove()
  } catch {
    // A build without Firebase configuration must remain fully usable.
    return () => {}
  }
}
