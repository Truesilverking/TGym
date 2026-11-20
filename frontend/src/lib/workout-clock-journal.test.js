import {afterEach,expect,it,vi} from 'vitest'
import {CLOCK_JOURNAL_KEY,validClockJournal,readClockJournal,writeClockJournal,overlayClockJournal} from './workout-clock-journal.js'
import {recordWorkoutInteraction,workoutElapsedMs} from './workout-time.js'

const journal=()=>({id:'active-session',at:3500,_ts:4000})
const profile=()=>({_ts:2000,unit:'lb',reduceMotion:false,cloudSync:{on:true,dirtyAt:1700},
 active:{id:'active-session',start:1000,lastUserInteractionAt:1500,lastMeaningfulTrainingActivityAt:1400,pausedDurationMs:100,
  sessionOrigin:{type:'planned',routineId:'routine'},entries:[{id:'exercise',sets:[{done:false,w:80,r:8}]}]},
 routines:[{id:'routine'}],workouts:[{id:'finished',end:900}],bodyweight:[{d:'2026-10-23',w:180}],profile:{name:'Synthetic'}})

afterEach(()=>vi.restoreAllMocks())

it('accepts only a bounded identity and finite positive numeric timestamps',()=>{
 expect(validClockJournal(journal())).toBe(true)
 expect(validClockJournal({...journal(),id:'x'.repeat(256),extra:'ignored'})).toBe(true)
 for(const invalid of [null,[],{}, {...journal(),id:''},{...journal(),id:'x'.repeat(257)},{...journal(),id:12}])expect(validClockJournal(invalid)).toBe(false)
 for(const key of ['at','_ts'])for(const value of [0,-1,NaN,Infinity,-Infinity,'3500',null,undefined])expect(validClockJournal({...journal(),[key]:value})).toBe(false)
})

it('writes exactly the small clock record and reads that record back',()=>{
 let saved
 const storage={setItem:vi.fn((key,text)=>{saved=text}),getItem:vi.fn(()=>saved)}
 writeClockJournal({...journal(),extra:'x'.repeat(100000),active:profile().active},storage)
 expect(storage.setItem).toHaveBeenCalledOnce()
 expect(storage.setItem.mock.calls[0][0]).toBe(CLOCK_JOURNAL_KEY)
 expect(JSON.parse(saved)).toEqual(journal());expect(saved.length).toBeLessThan(128)
 expect(readClockJournal(storage)).toEqual(journal())
 expect(storage.getItem).toHaveBeenCalledWith(CLOCK_JOURNAL_KEY)
})

it('returns null for a missing, malformed or unavailable journal without hiding write failures',()=>{
 for(const text of [null,'','{broken','null','[]','{}',JSON.stringify({...journal(),at:'3500'})])expect(readClockJournal({getItem:()=>text})).toBeNull()
 expect(readClockJournal({getItem:()=>{throw Error('read unavailable')}})).toBeNull()
 const storage={setItem:vi.fn()}
 expect(()=>writeClockJournal({...journal(),at:NaN},storage)).toThrow()
 expect(storage.setItem).not.toHaveBeenCalled()
 const failure=Error('write unavailable')
 expect(()=>writeClockJournal(journal(),{setItem:()=>{throw failure}})).toThrow(failure)
})

it('handles a blocked default storage getter on read and propagates it on write',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),failure=Error('storage access blocked')
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get:()=>{throw failure}})
 try{
  expect(readClockJournal()).toBeNull()
  expect(()=>writeClockJournal(journal())).toThrow(failure)
 }finally{
  if(previous)Object.defineProperty(globalThis,'localStorage',previous)
  else delete globalThis.localStorage
 }
})

it('overlays the latest input through the shared clock while preserving all other profile data',()=>{
 const state=profile(),before=structuredClone(state),input=journal()
 const result=overlayClockJournal(state,input,5000)
 expect(result).not.toBe(state);expect(result.active).not.toBe(state.active)
 expect(result).toEqual({...state,active:recordWorkoutInteraction(state.active,input.at)})
 expect(result.active.lastUserInteractionAt).toBe(input.at)
 expect(result.active.lastMeaningfulTrainingActivityAt).toBe(1400)
 expect(result._ts).toBe(2000)
 for(const key of ['routines','workouts','bodyweight','profile','cloudSync'])expect(result[key]).toBe(state[key])
 expect(result.active.entries).toBe(state.active.entries);expect(result.active.sessionOrigin).toBe(state.active.sessionOrigin)
 expect(state).toEqual(before);expect(input).toEqual(journal())
})

it('allows an equally fresh primary timestamp and uses the observation time for the future-input guard',()=>{
 const state=profile()
 vi.spyOn(Date,'now').mockReturnValue(5000)
 expect(overlayClockJournal(state,{...journal(),_ts:2000}).active.lastUserInteractionAt).toBe(3500)
 expect(overlayClockJournal(state,{...journal(),at:5000},5000).active.lastUserInteractionAt).toBe(5000)
 expect(overlayClockJournal(state,{...journal(),at:5001})).toBe(state)
})

it('ignores journal identity, freshness and input-boundary mismatches without cloning or changing state',()=>{
 const state=profile(),before=structuredClone(state)
 for(const input of [null,{}, {...journal(),id:'another-session'},{...journal(),_ts:1999},{...journal(),at:999},
  {...journal(),at:1500},{...journal(),at:1499},{...journal(),at:5001},{...journal(),_ts:5001}])expect(overlayClockJournal(state,input,5000)).toBe(state)
 const stringTimestamp={...state,_ts:'4500'}
 expect(overlayClockJournal(stringTimestamp,journal(),5000)).toBe(stringTimestamp)
 expect(state).toEqual(before)
})

it('ignores absent or ended workouts including an end timestamp of zero',()=>{
 for(const active of [null,undefined,{...profile().active,end:4500},{...profile().active,end:0}]){
  const state={...profile(),active}
  expect(overlayClockJournal(state,journal(),5000)).toBe(state)
 }
})

it('does not downgrade a legacy training-input anchor when the direct interaction field is absent',()=>{
 const state=profile();delete state.active.lastUserInteractionAt
 state.active.lastMeaningfulTrainingActivityAt=3600
 expect(overlayClockJournal(state,journal(),5000)).toBe(state)
 const newer={...journal(),at:3700}
 expect(overlayClockJournal(state,newer,5000).active.lastUserInteractionAt).toBe(3700)
})

it.each(['manual','completion','inactivity'])('preserves an existing %s pause and its frozen elapsed time',pauseReason=>{
 const state=profile();Object.assign(state.active,{timerPausedAt:3000,pauseReason,timerContinuedAt:1200})
 const before=structuredClone(state)
 const result=overlayClockJournal(state,journal(),5000)
 expect(result.active.lastUserInteractionAt).toBe(3500)
 expect(result.active.timerPausedAt).toBe(3000);expect(result.active.pauseReason).toBe(pauseReason)
 expect(result.active.timerContinuedAt).toBe(1200)
 expect(workoutElapsedMs(result.active,5000)).toBe(workoutElapsedMs(state.active,5000))
 expect(result.active.entries).toBe(state.active.entries);expect(result.workouts).toBe(state.workouts)
 expect(state).toEqual(before)
})

it('becomes a no-op after the same captured input has already been restored',()=>{
 const restored=overlayClockJournal(profile(),journal(),5000)
 expect(overlayClockJournal(restored,journal(),5000)).toBe(restored)
 expect(overlayClockJournal(restored,{...journal(),at:3400,_ts:4500},5000)).toBe(restored)
})
