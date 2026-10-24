// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import App from './App.jsx'
import {useStore,DEF} from './store/useStore.js'
import {useUI} from './store/useUI.js'
import {setLang} from './lib/i18n.js'

const native=vi.hoisted(()=>({add:vi.fn(),launch:vi.fn(),remove:vi.fn(),open:null}))
vi.mock('@capacitor/app',()=>({App:{addListener:native.add,getLaunchUrl:native.launch}}))
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:{addListener:async()=>({remove:vi.fn()})}}))
vi.mock('./lib/mobile.js',async original=>({...await original(),MOBILE:true,syncReminder:vi.fn(async()=>{})}))
vi.mock('./lib/native-sound.js',()=>({syncNativeSounds:vi.fn(async()=>{}),stopNativeSound:vi.fn(async()=>{})}))
vi.mock('./lib/workout-notification.js',()=>({syncWorkoutNotification:vi.fn(async()=>{})}))
vi.mock('./lib/back.js',()=>({initBackButton:async()=>()=>{}}))
vi.mock('./lib/wakelock.js',()=>({useWakeLock:()=>{}}))
vi.mock('./lib/system-appearance.js',()=>({syncSystemAppearance:()=>{}}))
vi.mock('./lib/viewport.js',()=>({installViewportLayout:()=>()=>{}}))
vi.mock('./lib/cloud-sync.js',()=>({cloudBackupDue:()=>false,backupToGoogleDrive:vi.fn()}))
vi.mock('./sheets.jsx',()=>({startFlow:vi.fn(),openMeasurementEntry:vi.fn(),workoutInactivitySheet:vi.fn()}))
vi.mock('./views/Home.jsx',()=>({default:()=> <h1>Home route</h1>}))
vi.mock('./views/Workout.jsx',()=>({default:()=> <h1>Workout route</h1>}))
vi.mock('./views/Settings.jsx',()=>({default:()=> <h1>Settings route</h1>}))
vi.mock('./components/AppLock.jsx',()=>({default:({children})=>children}))
vi.mock('./components/AppUpdate.jsx',()=>({default:()=>null}))
vi.mock('./components/AppTour.jsx',()=>({default:()=>null}))
vi.mock('./components/RestTimer.jsx',()=>({default:()=>null}))
vi.mock('./components/OfflineStatus.jsx',()=>({default:()=>null}))

const originalBoot=useStore.getState().boot
let host,root
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();sessionStorage.clear()
 localStorage.setItem('gym_guest','1')
 native.open=null
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
 vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks()
})
const mount=async()=>{
 await act(async()=>root.render(<App/>))
 await act(async()=>vi.dynamicImportSettled())
}
const route=async path=>act(async()=>{window.history.pushState(null,'','#'+path);window.dispatchEvent(new PopStateEvent('popstate'))})

it('consumes the native launch URL once and lets Home and Settings navigation remain selected',async()=>{
 await mount()
 expect(host.querySelector('h1').textContent).toBe('Workout route')
 expect(native.launch).toHaveBeenCalledOnce()
 await route('/home');expect(host.querySelector('h1').textContent).toBe('Home route')
 await route('/settings');expect(host.querySelector('h1').textContent).toBe('Settings route')
 expect(native.add).toHaveBeenCalledOnce();expect(native.launch).toHaveBeenCalledOnce()
})

it('keeps live notification links working after route and active-workout changes',async()=>{
 await mount();await route('/settings')
 await act(async()=>native.open({url:'tgym://workout'}))
 expect(host.querySelector('h1').textContent).toBe('Workout route')
 await route('/settings');await act(()=>useStore.setState({S:{...useStore.getState().S,active:null}}))
 await act(async()=>native.open({url:'tgym://workout'}))
 expect(host.querySelector('h1').textContent).toBe('Home route')
 await route('/settings');await act(async()=>native.open({url:'tgym://unknown'}))
 expect(host.querySelector('h1').textContent).toBe('Settings route')
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
