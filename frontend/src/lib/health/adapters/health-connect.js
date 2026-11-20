import { Capacitor, registerPlugin } from '@capacitor/core'
const Native = registerPlugin('HealthActivities')
export const healthConnectAdapter = {
  id:'health-connect', platform:'android',
  async status() { return Capacitor.getPlatform() === 'android' ? Native.status() : {available:false,granted:false} },
  async connect() { return Native.connect() },
  async read() { return Native.readActivities() },
  async settings() { return Native.openSettings() },
}
