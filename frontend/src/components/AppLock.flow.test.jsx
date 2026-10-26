// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import AppLock from './AppLock.jsx'
import { verifyDevicePin, recoverWithKey } from '../lib/app-lock.js'
import { setLang } from '../lib/i18n.js'
vi.mock('../lib/app-lock.js',()=>({deviceLockEnabled:()=>true,biometricEnabled:()=>false,verifyDevicePin:vi.fn(async()=>({ok:false})),recoverWithKey:vi.fn(async()=>false),authenticateDeviceBiometry:vi.fn()}))
let host,root
beforeEach(async()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();await setLang('en');host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<AppLock><b>Private training data</b></AppLock>))})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
async function enter(text){await act(async()=>{const input=host.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}))})}
async function submit(){await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))}
it('keeps visibility separate from verification and preserves the error and retry behavior',async()=>{
 await enter('1234');await act(async()=>host.querySelector('[aria-label="Show key"]').click())
 expect(host.querySelector('input').type).toBe('text');expect(verifyDevicePin).not.toHaveBeenCalled();expect(host.textContent).not.toContain('Private training data')
 await submit();expect(verifyDevicePin).toHaveBeenCalledWith('1234');expect(host.querySelector('[role=alert]').textContent).toBe('Incorrect PIN');expect(host.querySelector('input').value).toBe('')
 expect(host.querySelector('input').getAttribute('aria-describedby')).toBe('app-unlock-error')
 verifyDevicePin.mockResolvedValueOnce({ok:true});await enter('4321');await submit();expect(host.textContent).toBe('Private training data')
})
it('verifies recovery using the existing key mechanism, and masks again when switching modes',async()=>{
 await act(async()=>host.querySelector('[aria-label="Show key"]').click())
 await act(async()=>host.querySelector('.btn.ghost').click());expect(host.querySelector('input').type).toBe('password');expect(host.querySelector('input').inputMode).toBe('text')
 await enter('abcd-1234-efgh-5678');await submit();expect(recoverWithKey).toHaveBeenCalledWith('ABCD-1234-EFGH-5678');expect(verifyDevicePin).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]').textContent).toBe('Invalid recovery key')
})
it('returns focus to the key field after asynchronous PIN rejection re-enables it',async()=>{
 let finish
 verifyDevicePin.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 await enter('1234')
 const button=host.querySelector('.lock-submit'),input=host.querySelector('input')
 button.focus()
 await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 expect(input.disabled).toBe(true)
 await act(async()=>finish({ok:false}))
 expect(input.disabled).toBe(false)
 expect(document.activeElement).toBe(input)
})
