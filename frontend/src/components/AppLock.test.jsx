// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,vi} from 'vitest'
import AppLock from './AppLock.jsx'
import {setLang} from '../lib/i18n.js'
vi.mock('../lib/app-lock.js',()=>({deviceLockEnabled:()=>true,biometricEnabled:()=>false,verifyDevicePin:vi.fn(async()=>({ok:false})),recoverWithKey:vi.fn(async()=>false),authenticateDeviceBiometry:vi.fn()}))
it('updates locked-screen language after async profile language loading, without unlocking',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const host=document.createElement('div'),root=createRoot(host)
 try {
  await act(async()=>{await setLang('en');root.render(<AppLock><span>PRIVATE</span></AppLock>)})
  expect(host.textContent).toContain('Enter your 4-digit PIN')
  await act(async()=>{await setLang('es')})
  expect(host.textContent).toContain('Introduce tu PIN de 4 dígitos')
  expect(host.textContent).toContain('Tu espacio privado de entrenamiento')
  expect(host.textContent).not.toContain('PRIVATE')
  expect(host.querySelector('input').type).toBe('password')
  expect(host.querySelector('button[type=button]').textContent).toContain('recuperación')
 }finally{await act(async()=>{root.unmount();await setLang('en')})}
})
