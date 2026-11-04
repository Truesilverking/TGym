// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, it, expect, vi } from 'vitest'
import { loadPreUpdateBackup } from '../lib/web-state.js'
import { portableState, readBackup } from '../lib/backup.js'
const mocks=vi.hoisted(()=>({check:vi.fn(async()=>({update:null})),activate:vi.fn(async()=>{}),toast:vi.fn(),sheet:vi.fn(),state:{},update:vi.fn()}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'},registerPlugin:()=>({})}))
// Server-backed web builds historically defaulted to this native distribution value.
vi.mock('../lib/app-meta.js',()=>({APP_DISTRIBUTION:'github'}))
vi.mock('../lib/app-update.js',()=>({checkForAppUpdate:mocks.check,activatePwaUpdate:mocks.activate,dismissUpdate:vi.fn(),updateUrlFor:vi.fn()}))
vi.mock('../lib/update-push.js',()=>({initializeUpdatePush:async()=>()=>{}}))
vi.mock('../store/useUI.js',()=>({useUI:{getState:()=>({toast:mocks.toast,openSheet:mocks.sheet})}}))
vi.mock('../store/useStore.js',()=>({useStore:{getState:()=>({S:mocks.state,update:mocks.update})}}))
import AppUpdate, {manualUpdateCheck, showUpdateSheet, UpdateCheckButton} from './AppUpdate.jsx'
beforeEach(()=>{vi.clearAllMocks();mocks.check.mockResolvedValue({update:null});mocks.state={routines:[],workouts:[],cloudSync:{on:false}};globalThis.IS_REACT_ACT_ENVIRONMENT=true})
afterEach(()=>{mocks.sheet.mock.calls.at(-1)?.[1]?.onClose();vi.restoreAllMocks();vi.unstubAllGlobals()})
it('disables duplicate checks and announces the current version result',async()=>{
  let resolve
  mocks.check.mockImplementationOnce(()=>new Promise(r=>{resolve=r}))
  const host=document.createElement('div'),root=createRoot(host)
  try {
    await act(async()=>root.render(<UpdateCheckButton/>))
    const button=host.querySelector('button')
    act(()=>{button.click();button.click()})
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('Checking for updates…')
    expect(mocks.check).toHaveBeenCalledOnce()
    await act(async()=>resolve({update:null}))
    expect(button.disabled).toBe(false)
    expect(host.querySelector('[role="status"]').textContent).toBe('TGym is up to date.')
  } finally {act(()=>root.unmount())}
})
it('announces connection failure and lets the user retry into the existing update dialog',async()=>{
  mocks.check.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({update:{version:'1.15.20'}})
  const host=document.createElement('div'),root=createRoot(host)
  try {
    await act(async()=>root.render(<UpdateCheckButton/>))
    await act(async()=>host.querySelector('button').click())
    expect(host.textContent).toContain('Check your connection')
    expect(host.querySelector('button').disabled).toBe(false)
    await act(async()=>host.querySelector('button').click())
    expect(host.textContent).toContain('TGym 1.15.20 is available.')
    expect(mocks.sheet).toHaveBeenCalledOnce()
    mocks.sheet.mock.calls[0][1].onClose()
  } finally {act(()=>root.unmount())}
})
it('keeps browser launch and manual checks off the native manifest even in server-backed builds',async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const host=document.createElement('div'),root=createRoot(host)
  try {
    await act(async()=>root.render(<AppUpdate/>))
    expect(mocks.check).toHaveBeenCalledWith({force:false,distribution:'pwa'})
    await manualUpdateCheck()
    expect(mocks.check).toHaveBeenLastCalledWith({force:true,distribution:'pwa'})
  } finally {act(()=>root.unmount())}
})

async function updateDialog() {
 showUpdateSheet({version:'1.15.63',notes:[],mandatory:false})
 const host=document.createElement('div'),root=createRoot(host)
 await act(()=>root.render(mocks.sheet.mock.calls.at(-1)[0](vi.fn())))
 return {host,root,click:()=>act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Update').click())}
}
function backupDisk() {
 const values=new Map([['current',{marker:'normal profile mirror'}]])
 const db={close:vi.fn(),transaction:()=>{
  const tx={objectStore:()=>({put:(value,key)=>queueMicrotask(()=>{values.set(key,value);tx.oncomplete()}),get:key=>{
   const request={result:values.get(key)};queueMicrotask(()=>request.onsuccess());return request
  }})};return tx
 }}
 vi.stubGlobal('indexedDB',{open:()=>{const request={result:db};queueMicrotask(()=>request.onsuccess());return request}})
 return values
}
it('Update safely proceeds with a full localStorage profile after committing its separate IndexedDB backup',async()=>{
 const values=backupDisk(),getRegistration=vi.fn(async()=>({id:'registration'}))
 vi.stubGlobal('navigator',{serviceWorker:{getRegistration}})
 mocks.state={routines:Array.from({length:6},(_,i)=>({id:`r${i}`,name:`Routine ${i}`,ex:[]})),workouts:[{id:'history',entries:[]}],customEx:[{id:'custom',img:'data:image/gif;base64,'+'A'.repeat(4760000)}],unit:'lb',theme:'dark',cloudSync:{on:false}}
 const original=structuredClone(mocks.state),primary=JSON.stringify(original)
 vi.stubGlobal('localStorage',{getItem:key=>key==='gym_state_v1'?primary:null,setItem:vi.fn(()=>{throw new DOMException('Full','QuotaExceededError')})})
 mocks.activate.mockImplementationOnce(async()=>{
  expect(readBackup(JSON.parse(values.get('pre-update')))).toEqual(portableState(original))
  expect(values.get('current')).toEqual({marker:'normal profile mirror'})
 })
 const {host,root,click}=await updateDialog()
 try {
  await click()
  expect(host.querySelector('[role=alert]')).toBeNull();expect(mocks.activate).toHaveBeenCalledOnce()
  expect(getRegistration).toHaveBeenCalledOnce();expect(localStorage.setItem).not.toHaveBeenCalled()
  expect(readBackup(JSON.parse(await loadPreUpdateBackup()))).toEqual(portableState(original))
  expect(mocks.state).toEqual(original);expect(localStorage.getItem('gym_state_v1')).toBe(primary);expect(mocks.update).not.toHaveBeenCalled()
 }finally{act(()=>root.unmount())}
})
it('Update falls back to the prior localStorage key when IndexedDB is unavailable',async()=>{
 vi.stubGlobal('indexedDB',undefined);const values=new Map([['gym_state_v1',JSON.stringify(mocks.state)]])
 vi.stubGlobal('localStorage',{setItem:(key,value)=>values.set(key,value),getItem:key=>values.get(key)??null})
 vi.stubGlobal('navigator',{serviceWorker:{getRegistration:vi.fn(async()=>({}))}})
 const {host,root,click}=await updateDialog()
 try {
  await click();expect(mocks.activate).toHaveBeenCalledOnce();expect(host.querySelector('[role=alert]')).toBeNull()
  expect(readBackup(JSON.parse(values.get('tgym_pre_update_backup')))).toEqual(portableState(mocks.state))
  expect(values.get('gym_state_v1')).toBe(JSON.stringify(mocks.state))
 }finally{act(()=>root.unmount())}
})
it('Update reports a recoverable backup failure and never starts the worker or changes history',async()=>{
 vi.stubGlobal('indexedDB',undefined)
 const primary=JSON.stringify(mocks.state),previous='prior backup',getRegistration=vi.fn()
 vi.stubGlobal('localStorage',{getItem:key=>key==='gym_state_v1'?primary:previous,setItem:()=>{throw new DOMException('Full','QuotaExceededError')}})
 vi.stubGlobal('navigator',{serviceWorker:{getRegistration}})
 const {host,root,click}=await updateDialog()
 try {
  await click()
  expect(host.querySelector('[role=alert]').textContent).toContain('Could not save the pre-update backup')
  expect(host.querySelector('[role=alert]').textContent).toContain('Your TGym data was kept')
  expect(mocks.activate).not.toHaveBeenCalled();expect(getRegistration).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled()
  expect(localStorage.getItem('gym_state_v1')).toBe(primary);expect(localStorage.getItem('tgym_pre_update_backup')).toBe(previous)
  expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Update').disabled).toBe(false)
 }finally{act(()=>root.unmount())}
})
