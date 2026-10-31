// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import InAppReminders,{InAppReminderSettings} from './InAppReminders.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {_setLangState} from '../lib/i18n-core.js'
import {fmtDate} from '../lib/format.js'
import es from '../locales/es.js'
const calls=vi.hoisted(()=>({measurement:vi.fn(),sync:vi.fn()}))
vi.mock('../sheets.jsx',()=>({measurementRemindersSheet:calls.measurement}))
vi.mock('../lib/mobile.js',()=>({MOBILE:false,syncReminder:calls.sync,getReminderStatus:()=>({}),subscribeReminderStatus:()=>()=>{}}))
let host,root
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-10T12:00:00'));localStorage.clear();vi.clearAllMocks()
 _setLangState('en',{})
 useStore.setState({S:{...structuredClone(DEF),lang:'en',reminder:{on:true},routines:[{id:'a',name:'Upper'}],week:{4:['a']},measurementReminders:{notifications:false,items:{weight:{enabled:true,anchorDate:'2026-09-09',intervalUnit:'days',intervalValue:1}}}},user:null})
 useUI.setState({sheets:[]});host=document.createElement('div');document.body.append(host);root=createRoot(host)
 act(()=>root.render(<MemoryRouter><InAppReminderSettings/><InAppReminders/></MemoryRouter>))
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();_setLangState('en',{})})
it('mounts without permission/schedule or data writes and opens existing reminder actions',()=>{
 const before=structuredClone(useStore.getState().S)
 expect(host.querySelectorAll('.inapp-reminders li')).toHaveLength(2)
 expect(host.textContent).toContain('Due today');expect(calls.sync).not.toHaveBeenCalled();expect(localStorage.getItem('gym_state_v1')).toBeNull()
 act(()=>host.querySelector('.inapp-reminder-open').click());expect(calls.measurement).toHaveBeenCalledWith('weight')
 act(()=>host.querySelectorAll('.inapp-reminder-open')[1].click());expect(useUI.getState().sheets).toHaveLength(1)
 expect(useStore.getState().S).toEqual(before)
})
it('persists mode and dismissal on the normal path without changing histories or schedules',()=>{
 const before=structuredClone(useStore.getState().S)
 act(()=>host.querySelector('[aria-label="Dismiss reminder"]').click())
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
 expect(saved.inAppReminderDismissed).toHaveLength(1);expect(host.querySelectorAll('.inapp-reminders li')).toHaveLength(1)
 act(()=>{useStore.setState({S:saved});const select=host.querySelector('select');select.value='off';select.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(host.querySelector('.inapp-reminders')).toBeNull()
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).inAppReminderMode).toBe('off')
 for(const key of ['workouts','routines','week','bodyweight','measurements','reminder','measurementReminders'])expect(useStore.getState().S[key]).toEqual(before[key])
 expect(calls.sync).not.toHaveBeenCalled()
})
it.each([['en',{},'Today','Tomorrow'],['es',es,'Hoy','Mañana']])('shows weekly workout reminders as %s relative dates without writing data',(lang,dict,today,tomorrow)=>{
 _setLangState(lang,dict)
 act(()=>useStore.setState({S:{...useStore.getState().S,lang,week:{4:['a'],5:['a']},measurementReminders:{items:{}}}}))
 const before=structuredClone(useStore.getState().S)
 expect([...host.querySelectorAll('.inapp-reminder-open span')].map(node=>node.textContent)).toEqual([today+' · Upper',tomorrow+' · Upper'])
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull();expect(calls.sync).not.toHaveBeenCalled()
})
it('keeps weekday and date on a manual dated workout while recurring today remains relative',()=>{
 act(()=>useStore.setState({S:{...useStore.getState().S,dayPlan:{'2026-09-11':['a']},measurementReminders:{items:{}}}}))
 const before=structuredClone(useStore.getState().S)
 expect([...host.querySelectorAll('.inapp-reminder-open span')].map(node=>node.textContent)).toEqual(['Today · Upper',fmtDate('2026-09-11',true)+' · Upper'])
 expect(useStore.getState().S).toEqual(before);expect(calls.sync).not.toHaveBeenCalled()
})
