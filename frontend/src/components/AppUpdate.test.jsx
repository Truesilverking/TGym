// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, it, expect, vi } from 'vitest'
const mocks=vi.hoisted(()=>({check:vi.fn(async()=>({update:null})),toast:vi.fn(),sheet:vi.fn()}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'},registerPlugin:()=>({})}))
// Server-backed web builds historically defaulted to this native distribution value.
vi.mock('../lib/app-meta.js',()=>({APP_DISTRIBUTION:'github'}))
vi.mock('../lib/app-update.js',()=>({checkForAppUpdate:mocks.check,dismissUpdate:vi.fn(),updateUrlFor:vi.fn()}))
vi.mock('../lib/update-push.js',()=>({initializeUpdatePush:async()=>()=>{}}))
vi.mock('../store/useUI.js',()=>({useUI:{getState:()=>({toast:mocks.toast,openSheet:mocks.sheet})}}))
vi.mock('../store/useStore.js',()=>({useStore:{getState:()=>({S:{}})}}))
import AppUpdate, {manualUpdateCheck, UpdateCheckButton} from './AppUpdate.jsx'
beforeEach(()=>{vi.clearAllMocks();mocks.check.mockResolvedValue({update:null});globalThis.IS_REACT_ACT_ENVIRONMENT=true})
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
