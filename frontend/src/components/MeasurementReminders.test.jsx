// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,beforeEach,afterEach,vi} from 'vitest'
import MeasurementReminders from './MeasurementReminders.jsx'
import {DEF,useStore} from '../store/useStore.js'
let root,host,onRecord
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();useStore.setState({S:{...structuredClone(DEF),lang:'en'},user:null});host=document.createElement('div');document.body.append(host);root=createRoot(host);onRecord=vi.fn();act(()=>root.render(<MeasurementReminders onRecord={onRecord}/>))})
afterEach(()=>{act(()=>root.unmount());host.remove()})
const click=text=>act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent===text).click())
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
