// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {MemoryRouter} from 'react-router-dom'
import ReminderTimeField,{validReminderTime} from './ReminderTimeField.jsx'
import {ScheduleEditor} from './DailyPlan.jsx'
import {DEF,useStore} from '../store/useStore.js'

let root,host
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();useStore.setState({S:{...structuredClone(DEF),lang:'en',reminder:{...DEF.reminder,on:true,time:'08:00',tz:'America/Santo_Domingo',dayTimes:{1:'16:30'}}},user:null});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove()})
const input=value=>act(()=>{const el=host.querySelector('input[type=time]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))})

it('labels a native minute picker and retains the configured wall time and timezone',()=>{
 const onChange=vi.fn();act(()=>root.render(<ReminderTimeField label="Workout reminder" value="16:30" timeZone="America/Santo_Domingo" showZone onChange={onChange}/>))
 const field=host.querySelector('input')
 expect(host.querySelector('label').htmlFor).toBe(field.id)
 expect(field.step).toBe('60');expect(field.value).toBe('16:30')
 expect(field.getAttribute('aria-describedby')).toBe(host.querySelector('small').id)
 expect(host.textContent).toContain('America/Santo_Domingo')
 input('');input('16:30');expect(onChange).not.toHaveBeenCalled()
 input('18:45');expect(onChange).toHaveBeenCalledExactlyOnceWith('18:45')
 expect(validReminderTime('24:00')).toBe(false);expect(validReminderTime('12:60')).toBe(false)
})

it('edits one scheduled-day time through the normal persisted path without changing any training data',()=>{
 const before=structuredClone(useStore.getState().S)
 act(()=>root.render(<MemoryRouter><ScheduleEditor day={1} close={()=>{}}/></MemoryRouter>))
 input('17:15');const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
 expect(saved.reminder).toEqual({...before.reminder,dayTimes:{1:'17:15'}})
 for(const key of ['workouts','routines','week','dayPlan','active'])expect(saved[key]).toEqual(before[key])
 act(()=>root.unmount());root=createRoot(host)
 act(()=>root.render(<MemoryRouter><ScheduleEditor day={1} close={()=>{}}/></MemoryRouter>))
 expect(host.querySelector('input[type=time]').value).toBe('17:15')
})

it('lets a malformed empty per-day time be repaired to the inherited default',()=>{
 act(()=>useStore.setState({S:{...useStore.getState().S,reminder:{...useStore.getState().S.reminder,dayTimes:{1:''}}}}))
 act(()=>root.render(<MemoryRouter><ScheduleEditor day={1} close={()=>{}}/></MemoryRouter>))
 expect(host.querySelector('input[type=time]').value).toBe('')
 expect(host.querySelector('input[type=time]').getAttribute('aria-invalid')).toBe('true')
 input('08:00')
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).reminder.dayTimes[1]).toBe('08:00')
 expect(host.querySelector('input[type=time]').getAttribute('aria-invalid')).toBeNull()
})
