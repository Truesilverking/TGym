import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({platform:'android',listeners:{}, subscribe:vi.fn(), register:vi.fn(), removed:vi.fn()}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>mocks.platform!=='web',getPlatform:()=>mocks.platform},registerPlugin:()=>({subscribe:mocks.subscribe})}))
vi.mock('@capacitor/push-notifications',()=>({PushNotifications:{checkPermissions:async()=>({receive:'granted'}),addListener:async(name,fn)=>{mocks.listeners[name]=fn;return {remove:mocks.removed}},register:mocks.register}}))
import { initializeUpdatePush } from './update-push.js'
beforeEach(()=>{vi.resetAllMocks();mocks.subscribe.mockResolvedValue();mocks.platform='android'})
describe('update push routing',()=>{
 it('removes all listeners when registration fails and cleanup stays idempotent',async()=>{
  mocks.register.mockRejectedValueOnce(new Error('offline'))
  const stop=await initializeUpdatePush(vi.fn())
  expect(mocks.removed).toHaveBeenCalledTimes(3)
  stop(); expect(mocks.removed).toHaveBeenCalledTimes(3)
 })
 it('handles failed token resubscription without an unhandled rejection',async()=>{
  const stop=await initializeUpdatePush(vi.fn())
  mocks.subscribe.mockRejectedValueOnce(new Error('offline'))
  mocks.listeners.registration()
  await Promise.resolve()
  stop()
 })
 it.each(['web','ios'])('does not register %s installations in the Android topic',async platform=>{
  mocks.platform=platform
  await initializeUpdatePush(vi.fn())
  expect(mocks.register).not.toHaveBeenCalled()
  expect(mocks.subscribe).not.toHaveBeenCalled()
 })
 it('handles foreground data and background notification data',async()=>{
  const notify=vi.fn(); const stop=await initializeUpdatePush(notify)
  mocks.listeners.pushNotificationReceived({data:{type:'app_update',version:'1.15.10'}})
  mocks.listeners.pushNotificationActionPerformed({notification:{data:{type:'app_update',version:'1.15.10'}}})
  mocks.listeners.pushNotificationReceived({data:{type:'unrelated'}})
  expect(notify.mock.calls).toEqual([['1.15.10'],['1.15.10']])
  expect(mocks.subscribe).toHaveBeenCalledOnce()
 stop(); expect(mocks.removed).toHaveBeenCalledTimes(3)
 })
})
