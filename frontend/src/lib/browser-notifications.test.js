// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const platform=vi.hoisted(()=>({native:false}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>platform.native}}))
let alerts,show,request,permission
beforeEach(async()=>{
 vi.resetModules();platform.native=false;permission='granted';show=vi.fn(async()=>{});request=vi.fn(async()=>permission)
 vi.stubGlobal('Notification',class {static get permission(){return permission};static requestPermission=request})
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn(async()=>({showNotification:show}))}})
 Object.defineProperty(navigator,'userActivation',{configurable:true,value:{isActive:true}})
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'})
 Object.defineProperty(document,'hidden',{configurable:true,value:true})
 window.location.href='https://example.test/TGym/';vi.stubEnv('BASE_URL','/TGym/')
 alerts=await import('./browser-notifications.js')
})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks()})

it('keeps foreground cues and native Android out of the browser notification path',()=>{
 Object.defineProperty(document,'hidden',{configurable:true,value:false});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
 expect(alerts.notifyTimerFinished({},'rest',123)).toBe(false)
 platform.native=true;expect(alerts.notifyTimerFinished({},'rest',123)).toBe(false)
 expect(show).not.toHaveBeenCalled();expect(request).not.toHaveBeenCalled()
})
it.each(['rest','work'])('uses a persistent, audible system notice for a hidden %s timer',async event=>{
 expect(await alerts.notifyTimerFinished({},event,1234)).toBe(true)
 expect(show).toHaveBeenCalledExactlyOnceWith(expect.any(String),expect.objectContaining({tag:event+'-timer',silent:false,timestamp:1234,renotify:false,vibrate:[180,80,180],data:{type:event+'-timer',url:'https://example.test/TGym/#/workout'}}))
 expect(show.mock.calls[0][1].badge).toBe('https://example.test/TGym/notification-badge.svg')
 expect(request).not.toHaveBeenCalled()
})
it('hands a timer notice to the worker and accepts an occurrence already handled there',async()=>{
 const post=vi.fn((data,ports)=>ports[0].postMessage({shown:true}))
 navigator.serviceWorker.getRegistration.mockResolvedValue({active:{postMessage:post},showNotification:show})
 expect(await alerts.notifyTimerFinished({},'work',1234)).toBe(true)
 expect(post.mock.calls[0][0]).toMatchObject({type:'TGYM_TIMER_NOTICE',notification:{tag:'work-timer',timestamp:1234}})
 expect(show).not.toHaveBeenCalled()
})
it('claims a foreground cue without prompting or delaying its selected sound',async()=>{
 const post=vi.fn();navigator.serviceWorker.getRegistration.mockResolvedValue({active:{postMessage:post}})
 Object.defineProperty(document,'hidden',{configurable:true,value:false});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
 expect(alerts.notifyTimerFinished({},'rest',1234)).toBe(false);await Promise.resolve();await Promise.resolve()
 expect(post).toHaveBeenCalledExactlyOnceWith({type:'TGYM_TIMER_HANDLED',notification:{tag:'rest-timer',timestamp:1234}})
 expect(request).not.toHaveBeenCalled();expect(show).not.toHaveBeenCalled()
})
it('reports worker rejection for audio fallback and retains the direct path when a legacy worker cannot answer',async()=>{
 const post=vi.fn((data,ports)=>ports[0].postMessage({shown:false}))
 navigator.serviceWorker.getRegistration.mockResolvedValue({active:{postMessage:post},showNotification:show})
 expect(await alerts.notifyTimerFinished({},'rest',1234)).toBe(false);expect(show).not.toHaveBeenCalled()
 vi.useFakeTimers();navigator.serviceWorker.getRegistration.mockResolvedValue({active:{postMessage:vi.fn()},showNotification:show})
 const result=alerts.notifyTimerFinished({},'work',2345);await vi.advanceTimersByTimeAsync(2000)
 expect(await result).toBe(true);expect(show).toHaveBeenCalledOnce();vi.useRealTimers()
})
it.each([{sound:false},{soundMuted:true},{soundVolume:0},{sounds:{rest:'silent'}}])('retains the external notice without invalid silent/vibration options for %j',async prefs=>{
 expect(await alerts.notifyTimerFinished(prefs,'rest',123)).toBe(true)
 const options=show.mock.calls[0][1];expect(options.silent).toBe(true);expect(options).not.toHaveProperty('vibrate')
})
it('never asks permission at timer expiry or restoration and reports a failed OS notice for audio fallback',async()=>{
 permission='default';expect(alerts.notifyTimerFinished({},'rest',123)).toBe(false);expect(request).not.toHaveBeenCalled()
 permission='granted';show.mockRejectedValueOnce(new Error('Unavailable'));expect(await alerts.notifyTimerFinished({},'work',123)).toBe(false)
})
it('requests permission only with an explicit active gesture and coalesces double activation',async()=>{
 permission='default';Object.defineProperty(navigator,'userActivation',{configurable:true,value:{isActive:false}})
 expect(await alerts.requestTimerNotificationPermission()).toBe(false);expect(request).not.toHaveBeenCalled()
 Object.defineProperty(navigator,'userActivation',{configurable:true,value:{isActive:true}})
 let finish;request.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const a=alerts.requestTimerNotificationPermission(),b=alerts.requestTimerNotificationPermission();finish('granted')
 expect(await a).toBe(true);expect(await b).toBe(true);expect(request).toHaveBeenCalledOnce()
})
it('preserves quiet hours and suppresses previews only according to notification sound preferences',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date(2026,0,1,23))
 const quiet={reminder:{quietOn:true,quietStart:'22:00',quietEnd:'07:00'}}
 expect(alerts.notifyTimerFinished(quiet,'rest',123)).toBe(false)
 expect(await alerts.sendBrowserTestNotification({notificationSoundOn:false})).toBe(true)
 expect(show).toHaveBeenCalledWith('TGym',expect.objectContaining({silent:true,tag:'tgym-test',data:{url:'https://example.test/TGym/#/home'}}))
 vi.useRealTimers()
})
