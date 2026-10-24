// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import OfflineStatus from './OfflineStatus.jsx'
vi.mock('../lib/mobile.js',()=>({MOBILE:false}))
vi.mock('../lib/i18n.js',()=>({t:key=>key}))
let host,root,register,ready,registration
const originalWorker=navigator.serviceWorker
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.stubEnv('DEV',false);vi.stubGlobal('isSecureContext',true)
 ready=true
 vi.stubGlobal('MessageChannel',class {constructor(){this.port1={close:vi.fn()};this.port2={owner:this.port1}}})
 registration=Object.assign(new EventTarget(),{active:{postMessage:(_,ports)=>queueMicrotask(()=>ports[0].owner.onmessage({data:{ready}}))},update:vi.fn(async()=>{})})
 register=vi.fn(async()=>registration)
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register}})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(()=>{
 act(()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers()
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:originalWorker})
})
const mount=()=>act(async()=>root.render(<OfflineStatus/>))
it('hides the preparation notice only after the active worker confirms a complete cache',async()=>{
 await mount();expect(register).toHaveBeenCalledWith('sw.js',{updateViaCache:'none'});expect(host.textContent).toBe('')
})
it('shows failed precache and provides a retry that can recover',async()=>{
 ready=false;await mount();expect(host.textContent).toContain('Offline access is not ready')
 ready=true;await act(async()=>host.querySelector('button').click());expect(host.textContent).toBe('');expect(registration.update).toHaveBeenCalledOnce()
})
it('does not silently hide registration failure',async()=>{
 register.mockRejectedValue(Error('denied'));await mount();expect(host.textContent).toContain('Offline access is not ready')
})
it('bounds a worker that never answers the readiness message',async()=>{
 vi.useFakeTimers();registration.active.postMessage=vi.fn();await mount()
 await act(async()=>vi.advanceTimersByTimeAsync(6000));expect(host.textContent).toContain('Offline access is not ready')
})
