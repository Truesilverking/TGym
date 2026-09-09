import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({listeners:{}, subscribe:vi.fn(), register:vi.fn(), removed:vi.fn()}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},registerPlugin:()=>({subscribe:mocks.subscribe})}))
vi.mock('@capacitor/push-notifications',()=>({PushNotifications:{checkPermissions:async()=>({receive:'granted'}),addListener:async(name,fn)=>{mocks.listeners[name]=fn;return {remove:mocks.removed}},register:mocks.register}}))
import { initializeUpdatePush } from './update-push.js'
beforeEach(()=>vi.clearAllMocks())
describe('update push routing',()=>{
 it('handles foreground data and background notification data',async()=>{
  const notify=vi.fn(); const stop=await initializeUpdatePush(notify)
  mocks.listeners.pushNotificationReceived({data:{type:'app_update',version:'1.15.10'}})
  mocks.listeners.pushNotificationActionPerformed({notification:{data:{type:'app_update',version:'1.15.10'}}})
  mocks.listeners.pushNotificationReceived({data:{type:'unrelated'}})
  expect(notify.mock.calls).toEqual([['1.15.10'],['1.15.10']])
  expect(mocks.subscribe).toHaveBeenCalledOnce()
  stop(); expect(mocks.removed).toHaveBeenCalledTimes(2)
 })
})
