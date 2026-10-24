// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {ReminderStatus} from './ReminderPanel.jsx'
import {useStore,DEF} from '../store/useStore.js'
import {_setLangState,t} from '../lib/i18n-core.js'
import {dateLocale} from '../lib/i18n.js'
import {fmtDate} from '../lib/format.js'
import es from '../locales/es.js'
const native=vi.hoisted(()=>({status:{workout:{status:'configured',count:1,nextAt:null}},sync:vi.fn()}))
vi.mock('../lib/mobile.js',async original=>({...await original(),MOBILE:true,nativeSave:vi.fn(),syncReminder:native.sync,getReminderStatus:()=>native.status,subscribeReminderStatus:()=>()=>{}}))
let host,root
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-10T18:00:00'));localStorage.clear();vi.clearAllMocks();_setLangState('en',{})
 useStore.setState({user:null,S:{...structuredClone(DEF),lang:'en',dayPlan:{}}})
 native.status={workout:{status:'configured',count:1,nextAt:new Date('2026-09-10T19:00:00').toISOString(),nextDate:'2026-09-11'}}
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();_setLangState('en',{})})
const mount=(kind='workout')=>act(()=>root.render(<ReminderStatus kind={kind} enabled/>))
const time=()=>new Date(native.status.workout.nextAt).toLocaleTimeString(dateLocale(),{hour:'2-digit',minute:'2-digit'})
it.each([['en',{},'Today'],['es',es,'Hoy']])('describes actual delivery time in %s, not the next workout date', (lang,dict,today)=>{
 _setLangState(lang,dict);mount()
 expect(host.textContent).toBe(t('Next notification: {0}',today+' · '+time()))
 expect(host.textContent).not.toContain(fmtDate('2026-09-11',true))
 expect(localStorage.getItem('gym_state_v1')).toBeNull();expect(native.sync).not.toHaveBeenCalled()
})
it('keeps weekday/date for a manual appointment even when its alert arrives today',()=>{
 act(()=>useStore.setState({S:{...useStore.getState().S,dayPlan:{'2026-09-11':['manual']}}}));mount()
 expect(host.textContent).toBe(t('Next notification: {0}',fmtDate('2026-09-10',true)+' · '+time()))
 expect(localStorage.getItem('gym_state_v1')).toBeNull();expect(native.sync).not.toHaveBeenCalled()
})
it('updates Tomorrow to Today across midnight and after resuming, without persistence',()=>{
 native.status.workout.nextAt=new Date('2026-09-11T19:00:00').toISOString();mount()
 expect(host.textContent).toContain('Tomorrow · '+time())
 act(()=>vi.advanceTimersByTime(6*60*60*1000+2))
 expect(host.textContent).toContain('Today · '+time())
 act(()=>{vi.setSystemTime(new Date('2026-09-10T18:00:00'));window.dispatchEvent(new Event('pageshow'))})
 expect(host.textContent).toContain('Tomorrow · '+time())
 expect(localStorage.getItem('gym_state_v1')).toBeNull();expect(native.sync).not.toHaveBeenCalled()
})
it('preserves absolute delivery dates for measurement and deload status',()=>{
 for(const kind of ['measurement','deload']){
  native.status={...native.status,[kind]:{...native.status.workout}}
  mount(kind)
  expect(host.textContent).toBe(t('Next notification: {0}',new Date(native.status[kind].nextAt).toLocaleString(dateLocale(),{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})))
 }
 expect(native.sync).not.toHaveBeenCalled()
})
it('retains delivery text and the existing warning/retry action when sound could not be applied',()=>{
 native.status.workout.error='Notifications are scheduled without sound. The selected sound could not be applied.'
 act(()=>root.render(<ReminderStatus kind="workout" enabled onRetry={native.sync}/>))
 expect(host.querySelector('[role=alert]').textContent).toContain('Today · '+time())
 expect(host.textContent).toContain(native.status.workout.error)
 act(()=>host.querySelector('button').click());expect(native.sync).toHaveBeenCalledOnce()
 expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
