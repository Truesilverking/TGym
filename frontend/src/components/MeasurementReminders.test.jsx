// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,beforeEach,afterEach,vi} from 'vitest'
import MeasurementReminders from './MeasurementReminders.jsx'
import {DEF,useStore} from '../store/useStore.js'
let root,host,onRecord
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();useStore.setState({S:{...structuredClone(DEF),lang:'en'},user:null});host=document.createElement('div');document.body.append(host);root=createRoot(host);onRecord=vi.fn();act(()=>root.render(<MeasurementReminders onRecord={onRecord}/>))})
afterEach(()=>{act(()=>root.unmount());host.remove()})
const click=text=>act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent===text||b.querySelector('span')?.textContent===text).click())
const date=value=>act(()=>{const el=host.querySelector('input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))})
it('records any valid past date even with reminders off, and uses the selected category',()=>{
 date('2020-01-15');click('Record measurement');expect(onRecord).toHaveBeenLastCalledWith('weight','2020-01-15');click('Body measurements');click('Record measurement');expect(onRecord).toHaveBeenLastCalledWith('bodyMeasurements','2020-01-15');expect(useStore.getState().S.measurements).toEqual([])
})
it('rejects missing/future dates without recording',()=>{date('');expect(host.querySelector('[role=alert]')).not.toBeNull();click('Record measurement');date('2999-01-01');click('Record measurement');expect(onRecord).not.toHaveBeenCalled()})
it('persists frequency without enabling a disabled reminder, then keeps it when explicitly enabled',()=>{
 act(()=>{const el=host.querySelector('select');el.value='month';el.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).measurementReminders.items.weight).toMatchObject({enabled:false,intervalUnit:'months',intervalValue:1})
 act(()=>host.querySelector('.reminder-metric-toggle [role=switch]').click())
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).measurementReminders.items.weight).toMatchObject({enabled:true,intervalUnit:'months',intervalValue:1})
 expect(useStore.getState().S.bodyweight).toEqual([])
})

it('can enable another measurement directly without changing the editor selection or unrelated records',()=>{
 const before=structuredClone(useStore.getState().S)
 act(()=>host.querySelector('[aria-label="Measurement reminder · Body measurements"]').click())
 expect(useStore.getState().S.measurementReminders.items.bodyMeasurements.enabled).toBe(true)
 expect(host.querySelector('[aria-pressed=true]').getAttribute('aria-label')).toBe('Weight')
 click('Record measurement');expect(onRecord).toHaveBeenLastCalledWith('weight',expect.any(String))
 for(const key of ['workouts','routines','bodyweight','measurements','inbody'])expect(useStore.getState().S[key]).toEqual(before[key])
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
 act(()=>{root.unmount();useStore.setState({S:saved});root=createRoot(host);root.render(<MeasurementReminders onRecord={onRecord}/>)})
 expect(host.querySelector('[aria-label="Measurement reminder · Body measurements"]').getAttribute('aria-checked')).toBe('true')
})

it('shows and repairs an invalid saved empty time instead of masking it with 08:00',()=>{
 act(()=>useStore.setState({S:{...useStore.getState().S,measurementReminders:{time:'',notifications:false,items:{}}}}))
 const field=host.querySelector('input[type=time]')
 expect(field.value).toBe('');expect(field.getAttribute('aria-invalid')).toBe('true')
 expect(host.querySelector('.reminder-time-error').textContent).toBe('Enter a valid time')
 expect(localStorage.getItem('gym_state_v1')).toBeNull()
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'08:00');field.dispatchEvent(new Event('input',{bubbles:true}))})
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).measurementReminders.time).toBe('08:00')
 expect(field.getAttribute('aria-invalid')).toBeNull();expect(host.querySelector('.reminder-time-error')).toBeNull()
})

it('changes the selected editor without writing or scheduling anything',()=>{
 const before=structuredClone(useStore.getState().S)
 click('Body measurements');click('Weight')
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
