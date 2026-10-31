// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import WorkoutReminderSettings from './WorkoutReminderSettings.jsx'
import {DEF,useStore} from '../store/useStore.js'

const native=vi.hoisted(()=>({sync:vi.fn(),status:{workout:{status:'configured',count:0,nextAt:null}}}))
vi.mock('../lib/mobile.js',async original=>({...await original(),MOBILE:true,nativeSave:vi.fn().mockResolvedValue(true),syncReminder:native.sync,getReminderStatus:()=>native.status,subscribeReminderStatus:()=>()=>{}}))
vi.mock('../lib/i18n.js',async original=>({...await original(),t:key=>key}))
let host,root
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-22T12:00:00'));localStorage.clear();native.sync.mockReset().mockResolvedValue(true)
 useStore.setState({user:null,S:{...structuredClone(DEF),lang:'en',routines:[{id:'r1',name:'Routine',ex:[]}],week:{1:['r1']},reminder:{...DEF.reminder,on:true,time:'16:30',nextTime:'19:00',quietOn:true,quietStart:'22:00',quietEnd:'07:00',dayTimes:{1:'18:00'}}}})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers()})
const mount=()=>act(()=>root.render(<WorkoutReminderSettings/>))
const field=label=>host.querySelector('#'+[...host.querySelectorAll('label')].find(el=>el.textContent===label)?.htmlFor)
const edit=async(label,value)=>act(async()=>{const input=field(label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})

it('keeps native advanced actions available without scheduling or changing configuration when opened',()=>{
 const before=structuredClone(useStore.getState().S);mount()
 const details=host.querySelector('details')
 expect(details.open).toBe(false);expect(field('Next workout reminder').closest('details')).toBe(details)
 expect(field('Reminder time').closest('details')).toBeNull()
 act(()=>details.querySelector('summary').click());expect(details.open).toBe(true)
 expect(field('Monday').value).toBe('18:00');expect(field('Quiet period · Start').value).toBe('22:00')
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull();expect(native.sync).not.toHaveBeenCalled()
})

it('edits advance, daily and quiet times independently and retains them after a persisted reopen',async()=>{
 const before=structuredClone(useStore.getState().S);mount()
 await edit('Next workout reminder','20:45');await edit('Monday','18:15');await edit('Quiet period · Start','23:00');await edit('Quiet period · End','07:30')
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
 expect(saved.reminder).toMatchObject({on:true,time:'16:30',nextTime:'20:45',dayTimes:{1:'18:15'},quietOn:true,quietStart:'23:00',quietEnd:'07:30'})
 expect(native.sync).toHaveBeenCalledTimes(4);expect(native.sync.mock.calls.every(call=>call[1]===false&&call[2]==='workout')).toBe(true)
 for(const key of ['routines','week','dayPlan','workouts','active','measurementReminders'])expect(saved[key]).toEqual(before[key])
 act(()=>{root.unmount();useStore.setState({S:saved});root=createRoot(host);root.render(<WorkoutReminderSettings/>)})
 expect(field('Next workout reminder').value).toBe('20:45');expect(field('Monday').value).toBe('18:15');expect(field('Quiet period · End').value).toBe('07:30')
 expect(native.sync).toHaveBeenCalledTimes(4)
})

it('exposes invalid saved native times and allows repairing them to their default values',async()=>{
 useStore.setState({S:{...useStore.getState().S,reminder:{...useStore.getState().S.reminder,nextTime:'',dayTimes:{1:''},quietStart:''}}});mount()
 for(const label of ['Next workout reminder','Monday','Quiet period · Start']){expect(field(label).value).toBe('');expect(field(label).getAttribute('aria-invalid')).toBe('true')}
 expect(native.sync).not.toHaveBeenCalled();await edit('Next workout reminder','19:00');await edit('Monday','16:30');await edit('Quiet period · Start','22:00')
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).reminder).toMatchObject({nextTime:'19:00',time:'16:30',dayTimes:{1:'16:30'},quietStart:'22:00'})
 expect(host.querySelectorAll('.reminder-time-error')).toHaveLength(0)
})
