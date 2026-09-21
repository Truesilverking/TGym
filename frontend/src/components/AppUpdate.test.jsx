// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { it, expect, vi } from 'vitest'
const mocks=vi.hoisted(()=>({check:vi.fn(async()=>({update:null})),toast:vi.fn()}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'},registerPlugin:()=>({})}))
// Server-backed web builds historically defaulted to this native distribution value.
vi.mock('../lib/app-meta.js',()=>({APP_DISTRIBUTION:'github'}))
vi.mock('../lib/app-update.js',()=>({checkForAppUpdate:mocks.check,dismissUpdate:vi.fn(),updateUrlFor:vi.fn()}))
vi.mock('../lib/update-push.js',()=>({initializeUpdatePush:async()=>()=>{}}))
vi.mock('../store/useUI.js',()=>({useUI:{getState:()=>({toast:mocks.toast})}}))
vi.mock('../store/useStore.js',()=>({useStore:{getState:()=>({S:{}})}}))
import AppUpdate, {manualUpdateCheck} from './AppUpdate.jsx'
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
