// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {bwSheet} from '../sheets.jsx'
import {setLang,t} from '../lib/i18n.js'
import {convertWeightState} from '../lib/unit-conversion.js'

let root,host,flush
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T12:00:00-04:00'))
 await setLang('en');localStorage.clear();flush=useStore.getState().flushPersistence
 useStore.setState({S:{...structuredClone(DEF),lang:'en',hasCompletedOnboarding:true,hasCompletedAppTour:true,
  bodyweight:[{d:'2026-10-10',w:78},{d:'2026-10-20',w:80}],targetW:85,
  routines:[{id:'keep-routine',name:'Keep',ex:[{id:'bench',weight:100,sets:3}]}],
  workouts:[{id:'keep-history',d:'2026-10-20',entries:[{id:'bench',sets:[{w:100,r:8,done:true}]}]}]},
  user:null,flushPersistence:vi.fn().mockResolvedValue()})
 useUI.setState({sheets:[],toastMsg:''})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{
 await act(()=>root.unmount());host.remove();useUI.getState().closeAll()
 useStore.setState({flushPersistence:flush});vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks()
})
function Sheets(){return useUI(s=>s.sheets).map(s=><div key={s.id}>{s.render(()=>useUI.getState().closeSheet(s.id))}</div>)}
const open=async(opts={})=>act(()=>{root.render(<Sheets/>);bwSheet(opts)})
const button=key=>[...host.querySelectorAll('button')].find(b=>b.textContent===t(key))
const field=()=>host.querySelector(`input[aria-label="${t('Weight')}"]`)
const enter=async raw=>act(()=>{
 const input=field();expect(input).not.toBeNull();input.focus()
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,raw)
 input.dispatchEvent(new Event('input',{bubbles:true}));input.blur()
})
const save=async(required=false)=>act(async()=>button(required?'Save & start workout':'Save').click())
const dismiss=async()=>act(()=>useUI.getState().closeSheet(useUI.getState().sheets.at(-1).id))
const protectedData=S=>({unit:S.unit,routines:S.routines,workouts:S.workouts,targetW:S.targetW})

it.each([['kg','80.16',80.2],['lb','176.54',176.5]])('saves a configured %s profile reading with canonical precision and no global conversion',async(unit,reading,expected)=>{
 useStore.setState({S:{...useStore.getState().S,unit}})
 const before=structuredClone(useStore.getState().S)
 await open({initialDate:'2026-10-24'});expect(host.querySelectorAll('.bodyweight-picker button')).toHaveLength(0);await enter(reading)
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
 await save();const S=useStore.getState().S
 expect(protectedData(S)).toEqual(protectedData(before));expect(S.bodyweight.slice(0,2)).toEqual(before.bodyweight)
 expect(S.bodyweight.at(-1)).toMatchObject({d:'2026-10-24',w:expected,samples:[{w:expected}]})
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).unit).toBe(unit)
 expect(useStore.getState().flushPersistence).toHaveBeenCalledOnce();expect(useUI.getState().sheets).toHaveLength(0)
})
it('retains the configured unit and draft through repeated focus without rounding drift or saved-data writes',async()=>{
 const before=structuredClone(useStore.getState().S);await open();await enter('80.1')
 for(let i=0;i<6;i++)await act(()=>{field().focus();field().blur()})
 expect(Number(field().value.replace(',','.'))).toBe(80.1)
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
 await dismiss();expect(useStore.getState().S).toEqual(before);expect(useStore.getState().flushPersistence).not.toHaveBeenCalled()
})
it('cancels a changed pounds reading without saving a sample or preferences',async()=>{
 useStore.setState({S:{...useStore.getState().S,unit:'lb'}})
 const before=structuredClone(useStore.getState().S)
 await open();await enter('190.5');await dismiss()
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
 expect(useStore.getState().flushPersistence).not.toHaveBeenCalled();expect(useUI.getState().sheets).toHaveLength(0)
})
it('keeps the full focused trailing-zero draft visible without converting or saving existing samples',async()=>{
 const S=useStore.getState().S
 useStore.setState({S:{...S,bodyweight:S.bodyweight.map(row=>({...row,samples:[{id:`keep-${row.d}`,w:row.w,t:123}]}))}})
 const before=structuredClone(useStore.getState().S);await open()
 await act(()=>{
  const input=field();input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'70.0')
  input.dispatchEvent(new Event('input',{bubbles:true}))
 })
 expect(document.activeElement).toBe(field());expect(field().value).toBe('70.0')
 expect(field().style.width.endsWith('ch')).toBe(true);expect(parseFloat(field().style.width)).toBeGreaterThanOrEqual(4)
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
 await dismiss();expect(useStore.getState().S).toEqual(before);expect(useStore.getState().flushPersistence).not.toHaveBeenCalled()
})
it('averages two separate readings on the same day while retaining both samples',async()=>{
 const before=structuredClone(useStore.getState().S)
 await open({initialDate:'2026-10-24'});await enter('80');await save()
 await open({initialDate:'2026-10-24'});await enter('82');await save()
 const S=useStore.getState().S,day=S.bodyweight.find(row=>row.d==='2026-10-24')
 expect(day.w).toBe(81);expect(day.samples.map(sample=>sample.w)).toEqual([80,82])
 expect(new Set(day.samples.map(sample=>sample.id)).size).toBe(2)
 expect(S.bodyweight.slice(0,2)).toEqual(before.bodyweight);expect(protectedData(S)).toEqual(protectedData(before))
})
it('retries a failed durable save without duplicating its sample or changing the daily average',async()=>{
 const S=useStore.getState().S
 useStore.setState({S:{...S,bodyweight:[...S.bodyweight,{d:'2026-10-24',w:80,t:100,samples:[{id:'original',w:80,t:100}]}]}})
 useStore.getState().flushPersistence.mockRejectedValueOnce(Error('mirror unavailable'))
 const onDone=vi.fn();await open({initialDate:'2026-10-24',onDone});await enter('82');await save()
 const first=structuredClone(useStore.getState().S.bodyweight.at(-1))
 expect(first.w).toBe(81);expect(first.samples).toHaveLength(2);expect(onDone).not.toHaveBeenCalled();expect(useUI.getState().sheets).toHaveLength(1)
 await save();const final=useStore.getState().S.bodyweight.at(-1)
 expect(final).toEqual(first);expect(useStore.getState().S.bodyweight).toHaveLength(3)
 expect(onDone).toHaveBeenCalledExactlyOnceWith(82);expect(useStore.getState().flushPersistence).toHaveBeenCalledTimes(2);expect(useUI.getState().sheets).toHaveLength(0)
})
it('saves in the current profile unit after that unit changes externally while the draft stays open',async()=>{
 await open({initialDate:'2026-10-24'});await enter('80.1')
 await act(()=>useStore.getState().update(s=>convertWeightState(s,'lb')))
 const converted=structuredClone(useStore.getState().S);await save();const S=useStore.getState().S
 expect(S.unit).toBe('lb');expect(S.bodyweight.at(-1).w).toBe(176.6)
 expect(S.bodyweight.slice(0,2)).toEqual(converted.bodyweight);expect(protectedData(S)).toEqual(protectedData(converted))
})
it('accepts a comma decimal through the locale and saves a finite canonical reading',async()=>{
 await setLang('es');useStore.setState({S:{...useStore.getState().S,lang:'es'}})
 await open({initialDate:'2026-10-24'});await enter('80,5');await save()
 expect(useStore.getState().S.bodyweight.at(-1).w).toBe(80.5)
})
it.each(['','invalid','0'])('blocks an invalid draft %j instead of saving the previous valid reading',async raw=>{
 const before=structuredClone(useStore.getState().S);await open();await enter(raw)
 expect(button('Save').disabled).toBe(true);await save()
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull();expect(useStore.getState().flushPersistence).not.toHaveBeenCalled()
})
it('keeps the pre-workout weigh-in callback synchronous, canonical and single-shot',async()=>{
 useStore.setState({S:{...useStore.getState().S,unit:'lb'}})
 const onDone=vi.fn();await open({required:true,onDone});await enter('176.5')
 act(()=>{const start=button('Save & start workout');start.click();expect(onDone).toHaveBeenCalledExactlyOnceWith(176.5);start.click()})
 expect(onDone).toHaveBeenCalledOnce();expect(useUI.getState().sheets).toHaveLength(0)
 expect(useStore.getState().flushPersistence).not.toHaveBeenCalled();expect(useStore.getState().S.bodyweight.at(-1).w).toBe(176.5)
})
it('starts without weighing in synchronously while leaving readings and preferences intact',async()=>{
 useStore.setState({S:{...useStore.getState().S,unit:'lb'}})
 const before=structuredClone(useStore.getState().S),onDone=vi.fn();await open({required:true,onDone});await enter('190')
 act(()=>{const skip=button('Start without weighing in');skip.click();expect(onDone).toHaveBeenCalledExactlyOnceWith(null);skip.click()})
 expect(onDone).toHaveBeenCalledExactlyOnceWith(null)
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
 expect(useStore.getState().flushPersistence).not.toHaveBeenCalled();expect(useUI.getState().sheets).toHaveLength(0)
})
it('cancels a moving draft without saving, then saves exactly the current visible tenth during a flight',async()=>{
 let clock=0,next=0;const frames=new Map()
 vi.spyOn(performance,'now').mockImplementation(()=>clock)
 vi.spyOn(globalThis,'requestAnimationFrame').mockImplementation(fn=>{const id=++next;frames.set(id,fn);return id})
 vi.spyOn(globalThis,'cancelAnimationFrame').mockImplementation(id=>frames.delete(id))
 const point=async(type,x,time)=>{
  clock=time;const event=new MouseEvent(type,{clientX:x,clientY:30,button:0,bubbles:true,cancelable:true})
  Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true},timeStamp:{value:1000+time}})
  await act(()=>host.querySelector('[role=slider]').dispatchEvent(event))
 }
 const fling=async base=>{
  await point('pointerdown',200,base);await point('pointermove',170,base+30);await point('pointerup',160,base+50)
  clock=base+90;const scheduled=[...frames.values()];frames.clear();await act(()=>scheduled.forEach(fn=>fn(clock)))
  expect(frames.size).toBe(1)
 }
 const before=structuredClone(useStore.getState().S);await open();await fling(0)
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
 await dismiss();expect(frames.size).toBe(0);expect(useStore.getState().S).toEqual(before)
 await open();await fling(200)
 const shown=Number(field().value.replace(',','.'));expect(shown).toBeGreaterThan(80.4)
 await act(()=>button('Save').dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})))
 await save();expect(frames.size).toBe(0)
 const S=useStore.getState().S
 expect(S.bodyweight.at(-1).w).toBe(shown);expect(S.bodyweight.at(-1).samples).toHaveLength(1)
 expect(S.bodyweight.slice(0,2)).toEqual(before.bodyweight);expect(protectedData(S)).toEqual(protectedData(before))
 expect(useStore.getState().flushPersistence).toHaveBeenCalledOnce();expect(useUI.getState().sheets).toHaveLength(0)
})
it('saves the painted pounds value when the parent moving draft is one tick ahead',async()=>{
 const initial=useStore.getState().S
 useStore.setState({S:{...initial,unit:'lb',bodyweight:[initial.bodyweight[0],{d:'2026-10-20',w:181}]}})
 const before=structuredClone(useStore.getState().S)
 let clock=0,next=0;const frames=new Map()
 vi.spyOn(performance,'now').mockImplementation(()=>clock)
 vi.spyOn(globalThis,'requestAnimationFrame').mockImplementation(fn=>{const id=++next;frames.set(id,fn);return id})
 vi.spyOn(globalThis,'cancelAnimationFrame').mockImplementation(id=>frames.delete(id))
 const point=async(type,x,time)=>{
  clock=time;const event=new MouseEvent(type,{clientX:x,clientY:30,button:0,bubbles:true,cancelable:true})
  Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true},timeStamp:{value:1000+time}})
  await act(()=>host.querySelector('[role=slider]').dispatchEvent(event))
 }
 await open();await point('pointerdown',200,0);await point('pointermove',170,30);await point('pointerup',160,50)
 clock=90;const first=[...frames.values()];frames.clear();await act(()=>first.forEach(fn=>fn(clock)))
 expect(Number(field().value)).toBe(181.7);expect(frames.size).toBe(1)
 const stale=[...frames.values()][0]
 // Do not dispatch input: this is the rendered value, not a new user edit.
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field(),'181.6')
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
 await act(()=>button('Save').dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})))
 await save();expect(frames.size).toBe(0)
 const S=useStore.getState().S
 expect(S.bodyweight.at(-1).w).toBe(181.6);expect(S.bodyweight.at(-1).samples).toHaveLength(1)
 expect(S.bodyweight.slice(0,2)).toEqual(before.bodyweight);expect(protectedData(S)).toEqual(protectedData(before))
 const saved=structuredClone(S);clock=1000;await act(()=>stale(clock));expect(useStore.getState().S).toEqual(saved)
 expect(useStore.getState().flushPersistence).toHaveBeenCalledOnce()
})
