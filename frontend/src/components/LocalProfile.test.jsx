// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LocalProfile, { readProfilePhoto } from './LocalProfile.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { createBackup, readBackup } from '../lib/backup.js'
import { rebaseEmptyApiProfile } from '../lib/api-bootstrap.js'
import { setLang } from '../lib/i18n.js'

const disk = vi.hoisted(() => ({ value: null }))
vi.mock('../lib/demo.js', () => ({ STANDALONE:true, DEMO:false, DEMO_SEEDED:'test' }))
vi.mock('../lib/web-state.js', () => ({ loadWebState:async()=>disk.value, saveWebState:async s=>{disk.value=structuredClone(s);return true} }))
vi.mock('../sheets.jsx', () => ({ bwSheet:vi.fn(), heightSheet:vi.fn(), goalSheet:vi.fn(), measurementsSheet:vi.fn() }))
let host, root, close
const photo = 'data:image/jpeg;base64,eA=='
const records = { routines:[{id:'routine',name:'Keep',ex:[]}], workouts:[{id:'history',d:'2026-10-01',entries:[]}], bodyweight:[{d:'2026-10-02',w:80}], heightCm:170, targetW:85 }
beforeEach(async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true; localStorage.clear();disk.value=null
  await setLang('en')
  useStore.setState({S:{...structuredClone(DEF),...structuredClone(records),profile:{name:'Old name',photo,extra:'preserved'}},user:null,ready:true,storageError:null})
  host=document.createElement('div');document.body.append(host);root=createRoot(host);close=vi.fn()
  await act(async()=>root.render(<LocalProfile close={close} />))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
const click = async name => {const button=[...host.querySelectorAll('button')].find(b=>b.textContent===name);expect(button).toBeTruthy();await act(async()=>button.click())}
const name = async value => {const input=host.querySelector('[name="profile-name"]');await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})}
const submit = async()=>{await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))}

it('saves name and photo removal through the existing profile transaction, mirror, backup and restart',async()=>{
  await name('  My local name  ');await click('Remove photo');expect(close).not.toHaveBeenCalled()
  expect(useStore.getState().S.profile.photo).toBe(photo) // draft only
  await submit();expect(close).toHaveBeenCalledOnce()
  const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.profile).toEqual({name:'My local name',photo:null,extra:'preserved'})
  expect(disk.value.profile).toEqual(saved.profile)
  for(const key of Object.keys(records))expect(saved[key]).toEqual(records[key])
  expect(readBackup(createBackup(saved)).profile).toEqual(saved.profile)
  localStorage.clear();useStore.setState({S:structuredClone(DEF),ready:false});await act(async()=>useStore.getState().boot())
  expect(useStore.getState().S.profile).toEqual(saved.profile)
  expect(useStore.getState().user).toBeNull()
})
it('cancel leaves the original photo and name unchanged',async()=>{
  await name('Changed');await click('Remove photo');await click('Cancel')
  expect(close).toHaveBeenCalledOnce();expect(useStore.getState().S.profile).toEqual({name:'Old name',photo,extra:'preserved'})
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('failed primary save leaves the profile unchanged and keeps the editor available',async()=>{
  const spy=vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError')})
  try {await name('Changed');await submit();expect(close).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]').textContent).toContain('Could not save');expect(useStore.getState().S.profile.name).toBe('Old name')}
  finally {spy.mockRestore()}
})
it('keeps local display profile and Stats order over the initial optional API baseline without replacing training data',()=>{
  const before=structuredClone(DEF),current={...before,profile:{name:'Local',photo},statsSectionOrder:['bodyweight','summary'],statsControlPosition:{side:'left',y:.25}}
  const merged=rebaseEmptyApiProfile(before,current,{...before,...records},DEF)
  expect(merged.profile).toEqual(current.profile);expect(merged.statsSectionOrder).toEqual(current.statsSectionOrder);expect(merged.statsControlPosition).toEqual(current.statsControlPosition);expect(merged.workouts).toEqual(records.workouts)
})
it('rejects unsupported and oversized photos before decoding',async()=>{
  await expect(readProfilePhoto(new File(['x'],'x.svg',{type:'image/svg+xml'}))).rejects.toThrow()
  await expect(readProfilePhoto({type:'image/png',size:9*1024*1024})).rejects.toThrow()
})
it('opens an accepted legacy profile with missing or malformed weight dates without altering its records',async()=>{
  const bodyweight=[{d:'2026-10-02',w:80},{w:81,t:Date.parse('2026-10-03T10:00:00')},{d:null,w:100},{d:123,w:200},{d:'not-a-date',w:'bad'}]
  const restored=readBackup(createBackup({...useStore.getState().S,bodyweight}))
  await act(async()=>useStore.setState({S:restored}))
  expect(host.textContent).toContain('81 kg')
  expect(useStore.getState().S.bodyweight).toEqual(bodyweight)
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
