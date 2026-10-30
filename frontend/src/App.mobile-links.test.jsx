// @vitest-environment happy-dom
import React,{act,StrictMode} from 'react'
import {webcrypto} from 'node:crypto'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import App from './App.jsx'
import {useStore,DEF} from './store/useStore.js'
import {useUI} from './store/useUI.js'
import {setLang} from './lib/i18n.js'
import {setDevicePin} from './lib/app-lock.js'

const native=vi.hoisted(()=>({add:vi.fn(),launch:vi.fn(),remove:vi.fn(),open:null}))
vi.mock('@capacitor/app',()=>({App:{addListener:native.add,getLaunchUrl:native.launch}}))
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:{addListener:async()=>({remove:vi.fn()})}}))
vi.mock('./lib/mobile.js',async original=>({...await original(),MOBILE:true,syncReminder:vi.fn(async()=>{})}))
vi.mock('./lib/native-sound.js',()=>({syncNativeSounds:vi.fn(async()=>{}),stopNativeSound:vi.fn(async()=>{})}))
vi.mock('./lib/workout-notification.js',()=>({syncWorkoutNotification:vi.fn(async()=>{})}))
vi.mock('./lib/back.js',()=>({initBackButton:async()=>()=>{},registerNavigationBack:()=>()=>{}}))
vi.mock('./lib/wakelock.js',()=>({useWakeLock:()=>{}}))
vi.mock('./lib/system-appearance.js',()=>({syncSystemAppearance:()=>{}}))
vi.mock('./lib/viewport.js',()=>({installViewportLayout:()=>()=>{}}))
vi.mock('./lib/cloud-sync.js',()=>({cloudBackupDue:()=>false,backupToGoogleDrive:vi.fn()}))
vi.mock('./sheets.jsx',()=>({startFlow:vi.fn(),openMeasurementEntry:vi.fn(),workoutInactivitySheet:vi.fn()}))
vi.mock('./views/Home.jsx',()=>({default:()=> <h1>Home route</h1>}))
vi.mock('./views/Workout.jsx',()=>({default:()=> <h1>Workout route</h1>}))
vi.mock('./views/Settings.jsx',()=>({default:()=> <h1>Settings route</h1>}))
vi.mock('./components/AppUpdate.jsx',()=>({default:()=>null}))
vi.mock('./components/AppTour.jsx',()=>({default:()=>null}))
vi.mock('./components/RestTimer.jsx',()=>({default:()=>null}))
vi.mock('./components/OfflineStatus.jsx',()=>({default:()=>null}))

const originalBoot=useStore.getState().boot
let host,root
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();sessionStorage.clear()
 vi.stubGlobal('crypto',webcrypto)
 Object.defineProperty(document,'hidden',{configurable:true,value:false})
 localStorage.setItem('gym_guest','1')
 native.open=null
 native.remove.mockResolvedValue(undefined)
 native.add.mockImplementation(async(name,open)=>{expect(name).toBe('appUrlOpen');native.open=open;return{remove:native.remove}})
 native.launch.mockResolvedValue({url:'tgym://workout'})
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
 const now=Date.now()
 useStore.setState({S:{...structuredClone(DEF),lang:'en',hasCompletedOnboarding:true,hasCompletedAppTour:true,
  active:{id:'ongoing',start:now-60000,lastUserInteractionAt:now,entries:[{id:'0025',sets:[{done:false,r:8,w:20}]}]}},
  user:null,ready:true,storageError:null,storageWarning:null,needsMobileOnboarding:false,boot:vi.fn(async()=>{})})
 useUI.setState({sheets:[],timer:null,work:null,appTourRequest:null})
 window.history.replaceState(null,'','#/home');await setLang('en')
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{
 if(root)await act(()=>root.unmount())
 host.remove();useUI.getState().stopRest();useUI.getState().stopWork()
 useStore.setState({boot:originalBoot})
 vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()
})
const mount=async()=>{
 await act(async()=>root.render(<App/>))
 await act(async()=>vi.dynamicImportSettled())
}
const route=async path=>act(async()=>{window.history.pushState(null,'','#'+path);window.dispatchEvent(new PopStateEvent('popstate'))})
const unlock=async()=>act(async()=>{
 const input=host.querySelector('#app-unlock-key')
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1234')
 input.dispatchEvent(new Event('input',{bubbles:true}))
})
const settleUnlock=async()=>{
 await unlock()
 await vi.waitFor(async()=>{await act(async()=>{});expect(host.querySelector('.lock-screen')).toBeNull()},{interval:1})
}
const hideForFiveMinutes=async()=>{
 await act(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
 await act(async()=>vi.advanceTimersByTimeAsync(300001))
 await act(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))})
}

it('consumes the native launch URL once and lets Home and Settings navigation remain selected',async()=>{
 await mount()
 expect([...host.querySelectorAll('h1')].find(node=>!node.closest('[aria-hidden="true"]')).textContent).toBe('Workout route')
 expect(native.launch).toHaveBeenCalledOnce()
 await route('/home');expect([...host.querySelectorAll('h1')].find(node=>!node.closest('[aria-hidden="true"]')).textContent).toBe('Home route')
 await route('/settings');expect([...host.querySelectorAll('h1')].find(node=>!node.closest('[aria-hidden="true"]')).textContent).toBe('Settings route')
 expect(native.add).toHaveBeenCalledOnce();expect(native.launch).toHaveBeenCalledOnce()
})

it('keeps live notification links working after route and active-workout changes',async()=>{
 await mount();await route('/settings')
 await act(async()=>native.open({url:'tgym://workout'}))
 expect([...host.querySelectorAll('h1')].find(node=>!node.closest('[aria-hidden="true"]')).textContent).toBe('Workout route')
 await route('/settings');await act(()=>useStore.setState({S:{...useStore.getState().S,active:null}}))
 await act(async()=>native.open({url:'tgym://workout'}))
 expect([...host.querySelectorAll('h1')].find(node=>!node.closest('[aria-hidden="true"]')).textContent).toBe('Home route')
 await route('/settings');await act(async()=>native.open({url:'tgym://unknown'}))
 expect([...host.querySelectorAll('h1')].find(node=>!node.closest('[aria-hidden="true"]')).textContent).toBe('Settings route')
 expect(native.add).toHaveBeenCalledOnce();expect(native.launch).toHaveBeenCalledOnce()
})

it('removes a listener that resolves after unmount without reading or replaying its launch URL',async()=>{
 let resolve
 native.add.mockImplementation(()=>new Promise(done=>{resolve=done}))
 await mount();await act(()=>root.unmount());root=null
 await act(async()=>resolve({remove:native.remove}))
 expect(native.remove).toHaveBeenCalledOnce();expect(native.launch).not.toHaveBeenCalled()
 expect(window.location.hash).toBe('#/home')
})

it('ignores a launch URL that resolves after the listener has been cleaned up',async()=>{
 let resolve
 native.launch.mockImplementation(()=>new Promise(done=>{resolve=done}))
 await mount()
 expect(native.launch).toHaveBeenCalledOnce()
 const stale=native.open
 await act(()=>root.unmount());root=null
 const hash=window.location.hash
 await act(async()=>{resolve({url:'tgym://workout'});stale({url:'tgym://workout'})})
 expect(window.location.hash).toBe(hash)
 expect(native.remove).toHaveBeenCalledOnce()
})

it('opens same-origin worker timer actions and falls back to Today after the workout ends',async()=>{
 const worker=new EventTarget();vi.stubGlobal('navigator',Object.create(navigator,{serviceWorker:{value:worker}}))
 await mount();await route('/settings')
 const message=async path=>{const event=new MessageEvent('message',{data:{type:'TGYM_NOTIFICATION_NAVIGATE',route:path}});Object.defineProperty(event,'source',{value:{scriptURL:window.location.origin+'/sw.js'}});await act(()=>worker.dispatchEvent(event))}
 await message('/workout');expect(window.location.hash).toBe('#/workout')
 await route('/settings');await act(()=>useStore.setState({S:{...useStore.getState().S,active:null}}))
 await message('/workout');expect(window.location.hash).toBe('#/home')
})

it('ignores untrusted worker origins and routes and removes its message listener on unmount',async()=>{
 const worker=new EventTarget();vi.stubGlobal('navigator',Object.create(navigator,{serviceWorker:{value:worker}}))
 await mount();await route('/settings')
 const message=async(route,scriptURL)=>{const event=new MessageEvent('message',{data:{type:'TGYM_NOTIFICATION_NAVIGATE',route}});Object.defineProperty(event,'source',{value:{scriptURL}});await act(()=>worker.dispatchEvent(event))}
 await message('/workout','https://external.invalid/sw.js');await message('/admin',window.location.origin+'/sw.js')
 expect(window.location.hash).toBe('#/settings')
 await act(()=>root.unmount());root=null
 await message('/home',window.location.origin+'/sw.js');expect(window.location.hash).toBe('#/settings')
})

it('retains a live notification intent while the real PIN screen hides Shell',async()=>{
 native.launch.mockResolvedValue(undefined)
 await setDevicePin('1234')
 await mount()
 expect(host.querySelector('.lock-screen')).not.toBeNull()
 expect(host.querySelector('h1')?.textContent).not.toBe('Workout route')
 expect(native.add).toHaveBeenCalledOnce()
 const before=structuredClone(useStore.getState().S)
 await act(async()=>native.open({url:'tgym://workout'}))
 expect(window.location.hash).toBe('#/home')
 expect(host.querySelector('.lock-screen')).not.toBeNull()
 await settleUnlock()
 expect(host.querySelector('.lock-screen')).toBeNull()
 expect(window.location.hash).toBe('#/workout')
 expect(useStore.getState().S).toEqual(before)
 expect(native.add).toHaveBeenCalledOnce();expect(native.launch).toHaveBeenCalledOnce()
})

it('queues a cold notification through PIN unlock and profile hydration before selecting the current workout',async()=>{
 await setDevicePin('1234')
 const hydrated=structuredClone(useStore.getState().S)
 useStore.setState({ready:false,S:{...hydrated,active:null}})
 await mount()
 expect(native.launch).toHaveBeenCalledOnce()
 await settleUnlock()
 expect(window.location.hash).toBe('#/home')
 expect(host.textContent).not.toContain('Workout route')
 await act(async()=>useStore.setState({ready:true,S:hydrated}))
 expect(window.location.hash).toBe('#/workout')
 expect(useStore.getState().S).toEqual(hydrated)
})

it('does not replay the old launch intent when Shell remounts after an ordinary unlock',async()=>{
 await setDevicePin('1234')
 const current=useStore.getState().S
 useStore.setState({S:{...current,active:{...current.active,timerPausedAt:Date.now(),sessionStatus:'paused',pauseReason:'manual'}}})
 await mount();await settleUnlock();expect(window.location.hash).toBe('#/workout')
 await route('/settings');await hideForFiveMinutes()
 expect(host.querySelector('.lock-screen')).not.toBeNull()
 await settleUnlock()
 expect(window.location.hash).toBe('#/settings')
 expect(native.add).toHaveBeenCalledOnce();expect(native.launch).toHaveBeenCalledOnce()
 await hideForFiveMinutes()
 await act(async()=>native.open({url:'tgym://workout'}))
 expect(window.location.hash).toBe('#/settings')
 await settleUnlock()
 expect(window.location.hash).toBe('#/workout')
})

it('does not replay a late initial intent after a newer live intent has already been handled',async()=>{
 let resolve
 native.launch.mockImplementation(()=>new Promise(done=>{resolve=done}))
 await mount()
 await act(async()=>native.open({url:'tgym://workout'}))
 expect(window.location.hash).toBe('#/workout')
 await route('/settings')
 await act(async()=>resolve({url:'tgym://workout'}))
 expect(window.location.hash).toBe('#/settings')
})

it('keeps one live link listener across StrictMode replay and ignores it after unmount',async()=>{
 native.launch.mockResolvedValue(undefined)
 await act(async()=>root.render(<StrictMode><App/></StrictMode>))
 await act(async()=>vi.dynamicImportSettled())
 expect(native.add).toHaveBeenCalledOnce();expect(native.launch).toHaveBeenCalledOnce()
 await act(async()=>native.open({url:'tgym://workout'}))
 expect(window.location.hash).toBe('#/workout')
 const stale=native.open
 await act(()=>root.unmount());root=null
 await act(async()=>stale({url:'tgym://workout'}))
 expect(native.remove).toHaveBeenCalledOnce()
})

it('keeps a pending link until profile recovery finishes without changing the stored profile',async()=>{
 useStore.setState({storageError:'mirror unavailable'})
 const before=structuredClone(useStore.getState().S)
 await mount()
 expect(window.location.hash).toBe('#/home')
 await act(async()=>useStore.setState({storageError:null}))
 expect(window.location.hash).toBe('#/workout')
 expect(useStore.getState().S).toEqual(before)
 expect(native.add).toHaveBeenCalledOnce();expect(native.launch).toHaveBeenCalledOnce()
})

it('absorbs asynchronous listener disposal failure and ignores later events',async()=>{
 native.launch.mockResolvedValue(undefined)
 native.remove.mockRejectedValue(new Error('Synthetic closed native bridge'))
 await mount();await route('/settings')
 const stale=native.open
 await act(()=>root.unmount());root=null
 await act(async()=>stale({url:'tgym://workout'}))
 expect(window.location.hash).toBe('#/settings')
 expect(native.remove).toHaveBeenCalledOnce()
})
