// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LocalProfile, { readProfilePhoto } from './LocalProfile.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { recordHeight } from '../lib/body-records.js'
import { convertMeasurementState } from '../lib/unit-conversion.js'
import { createBackup, readBackup } from '../lib/backup.js'
import { rebaseEmptyApiProfile } from '../lib/api-bootstrap.js'
import { setLang } from '../lib/i18n.js'
import { bwSheet, heightSheet, goalSheet } from '../sheets.jsx'

const disk = vi.hoisted(() => ({ value: null }))
vi.mock('../lib/demo.js', () => ({ STANDALONE:true, DEMO:false, DEMO_SEEDED:'test' }))
vi.mock('../lib/web-state.js', () => ({ loadWebState:async()=>disk.value, saveWebState:async s=>{disk.value=structuredClone(s);return true} }))
vi.mock('../sheets.jsx', () => ({ bwSheet:vi.fn(), heightSheet:vi.fn(), goalSheet:vi.fn(), measurementsSheet:vi.fn() }))
let host, root, close
const photo = 'data:image/jpeg;base64,eA=='
const records = { routines:[{id:'routine',name:'Keep',ex:[]}], workouts:[{id:'history',d:'2026-10-01',entries:[]}], bodyweight:[{d:'2026-10-02',w:80}], heightCm:170, targetW:85 }
beforeEach(async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true; localStorage.clear();disk.value=null
  useUI.setState({toastMsg:''})
  await setLang('en')
  useStore.setState({S:{...structuredClone(DEF),...structuredClone(records),profile:{name:'Old name',photo,extra:'preserved'}},user:null,ready:true,storageError:null})
  host=document.createElement('div');document.body.append(host);root=createRoot(host);close=vi.fn()
  await act(async()=>root.render(<LocalProfile close={close} />))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
const click = async name => {const button=[...host.querySelectorAll('button')].find(b=>b.textContent===name || b.getAttribute('aria-label')===name);expect(button).toBeTruthy();await act(async()=>button.click())}
const field = async (key,value) => {const input=host.querySelector(`[name="profile-${key}"]`);expect(input).toBeTruthy();await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})}
const name = value => field('name',value)
const submit = async()=>{await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))}

it('saves name and photo removal through the existing profile transaction, mirror, backup and restart',async()=>{
  await click('Edit');await name('  My local name  ');await field('age','32');await click('Remove photo');expect(close).not.toHaveBeenCalled()
  expect(useStore.getState().S.profile.photo).toBe(photo) // draft only
  await submit();expect(close).not.toHaveBeenCalled();expect(host.querySelector('[name="profile-name"]')).toBeNull();expect(host.textContent).toContain('My local name')
  const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.profile).toEqual({name:'My local name',photo:null,age:32,extra:'preserved'})
  expect(disk.value.profile).toEqual(saved.profile)
  for(const key of Object.keys(records))expect(saved[key]).toEqual(records[key])
  expect(readBackup(createBackup(saved)).profile).toEqual(saved.profile)
  localStorage.clear();useStore.setState({S:structuredClone(DEF),ready:false});await act(async()=>useStore.getState().boot())
  expect(useStore.getState().S.profile).toEqual(saved.profile)
  expect(useStore.getState().user).toBeNull()
})
it('cancel leaves the original photo and name unchanged',async()=>{
  await click('Edit');await name('Changed');await field('age','40');await click('Remove photo');await click('Cancel')
  expect(close).not.toHaveBeenCalled();expect(useStore.getState().S.profile).toEqual({name:'Old name',photo,extra:'preserved'})
  expect(host.querySelector('[name="profile-name"]')).toBeNull();expect(host.textContent).toContain('Old name')
  await click('Edit');expect(host.querySelector('[name="profile-name"]').value).toBe('Old name');expect(host.querySelector('[name="profile-age"]').value).toBe('')
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('failed primary save leaves the profile unchanged and keeps the editor available',async()=>{
  const spy=vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError')})
  try {await click('Edit');await name('Changed');await submit();expect(close).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]').textContent).toContain('Could not save');expect(useStore.getState().S.profile.name).toBe('Old name')}
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
it('starts read-only and gates every profile editor behind Edit',async()=>{
  vi.mocked(bwSheet).mockClear();vi.mocked(heightSheet).mockClear();vi.mocked(goalSheet).mockClear()
  expect(host.querySelector('input')).toBeNull();expect(host.textContent).not.toContain('Profile name');expect(host.textContent).not.toContain('Body measurements')
  expect(host.querySelector('.profile-form-actions')).toBeNull();expect(host.querySelector('.profile-photo-actions')).toBeNull()
  await submit();expect(localStorage.getItem('gym_state_v1')).toBeNull()
  expect(host.querySelector('.profile-display-name').textContent).toBe('Old name')
  for(const title of ['Body Weight','Height','Goal'])expect([...host.querySelectorAll('button')].some(button=>button.textContent.includes(title))).toBe(false)
  await click('Edit')
  for(const [title,fn] of [['Body Weight',bwSheet],['Height',heightSheet],['Goal',goalSheet]]){
    const button=[...host.querySelectorAll('button')].find(button=>button.textContent.includes(title));expect(button).toBeTruthy();await act(()=>button.click());expect(fn).toHaveBeenCalledOnce()
  }
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
  expect(host.querySelector('[name="profile-name"]')).not.toBeNull()
  expect(host.textContent).toContain('Weight, height and goal editors save their own records.')
  expect(host.querySelector('.profile-photo-actions').textContent).toBe('')
  expect(host.querySelector('.profile-form-actions')).toBe(host.querySelector('form').lastElementChild)
})
it.each(['0','121','4.5','-1','no'])('rejects invalid age %s without saving any profile drafts',async age=>{
  await click('Edit');await name('Do not save');await field('age',age);await submit()
  expect(host.querySelector('[role=alert]').textContent).toContain('Enter an age')
  expect(useStore.getState().S.profile.name).toBe('Old name');expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('allows removing an age and returns to the saved read-only profile',async()=>{
  await act(()=>useStore.setState({S:{...useStore.getState().S,profile:{...useStore.getState().S.profile,age:30}}}))
  await click('Edit');await field('age','');await submit()
  expect(useStore.getState().S.profile.age).toBeNull();expect(host.querySelector('[name="profile-age"]')).toBeNull()
})
it('displays unit-stamped weight and legacy display height without converting either record again',async()=>{
  const bodyweight=[{d:'2026-10-02',w:100,unit:'kg'}]
  const state={...useStore.getState().S,unit:'lb',bodyweight}
  recordHeight(state,177.8,'2026-10-02',Date.parse('2026-10-02T12:00:00'),'height-record')
  convertMeasurementState(state,'in')
  await act(()=>useStore.setState({S:state}))
  expect(host.textContent).toContain('220 lb');expect(host.textContent).toContain('70 in')
  expect(useStore.getState().S.bodyweight).toEqual(bodyweight);expect(useStore.getState().S.heightCm).toBe(70)
  expect(useStore.getState().S.heightHistory.at(-1).cm).toBe(177.8)
  const centimetres=structuredClone(state);convertMeasurementState(centimetres,'cm')
  await act(()=>useStore.setState({S:centimetres}))
  expect(host.textContent).toContain('177.8 cm')
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('keeps a failed mirror retryable and reports success only after the durable mirror completes',async()=>{
  const original=useStore.getState().flushPersistence
  const flush=vi.fn().mockRejectedValueOnce(Error('Mirror unavailable')).mockResolvedValue()
  useStore.setState({flushPersistence:flush})
  try {
    await click('Edit');await name('Durable retry');await submit()
    expect(host.querySelector('[role=alert]').textContent).toContain('Could not save')
    expect(host.querySelector('[name="profile-name"]').value).toBe('Durable retry')
    expect(useUI.getState().toastMsg).not.toBe('Profile saved')
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).profile.name).toBe('Durable retry')
    await submit()
    expect(flush).toHaveBeenCalledTimes(2);expect(useUI.getState().toastMsg).toBe('Profile saved')
    expect(host.querySelector('[name="profile-name"]')).toBeNull()
    expect(useStore.getState().S.workouts).toEqual(records.workouts)
  } finally {useStore.setState({flushPersistence:original})}
})
it('ignores duplicate submissions and disables record editors while a profile save is pending',async()=>{
  const original=useStore.getState().flushPersistence
  let resolve
  const pending=new Promise(done=>{resolve=done}),flush=vi.fn(()=>pending)
  useStore.setState({flushPersistence:flush})
  try {
    await click('Edit');await name('One save')
    const form=host.querySelector('form')
    await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})
    expect(flush).toHaveBeenCalledOnce()
    expect([...host.querySelectorAll('button')].filter(button=>['Save','Cancel'].includes(button.textContent)).every(button=>button.disabled)).toBe(true)
    expect([...host.querySelectorAll('button')].some(button=>button.textContent.includes('Body Weight'))).toBe(false)
    await act(async()=>{resolve();await pending})
    expect(host.querySelector('[name="profile-name"]')).toBeNull()
    expect(useStore.getState().S.profile.name).toBe('One save')
  } finally {resolve?.();useStore.setState({flushPersistence:original})}
})
it('shows a long name as plain text and preserves it while entering and canceling editing',async()=>{
  const long='A'.repeat(80)
  await act(()=>useStore.setState({S:{...useStore.getState().S,profile:{name:long,photo,age:30}}}))
  expect(host.querySelector('.profile-display-name').textContent).toBe(long)
  expect(host.querySelector('input')).toBeNull()
  await click('Edit');expect(host.querySelector('[name="profile-name"]').value).toBe(long)
  await name('Draft');await click('Cancel')
  expect(host.querySelector('.profile-display-name').textContent).toBe(long)
  expect(useStore.getState().S.profile.name).toBe(long)
})
