// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CLOCK_JOURNAL_KEY } from '../lib/workout-clock-journal.js'
import { inactivityDeadline } from '../lib/workout-time.js'

const native=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),clock:vi.fn(),reminder:vi.fn(),available:true}))
vi.mock('../lib/mobile.js',()=>({MOBILE:true,nativeLoad:native.load,nativeSave:native.save,nativeSaveClockJournal:native.clock,
 nativeClockJournalAvailable:()=>native.available,syncReminder:native.reminder,writeAutoBackup:vi.fn()}))
vi.mock('../lib/remote.js',()=>({loadRemote:async()=>null,chooseLocal:vi.fn(),forgetRemote:vi.fn(),connect:vi.fn()}))

const START=1800000000000,KEY='gym_state_v1'
let listeners=[]
beforeEach(()=>{
 vi.resetModules();vi.useFakeTimers();vi.setSystemTime(START);localStorage.clear();vi.clearAllMocks()
 native.available=true;native.load.mockResolvedValue(null);native.save.mockResolvedValue(true);native.clock.mockResolvedValue(true)
 for(const target of [window,document]){
  const add=target.addEventListener.bind(target)
  vi.spyOn(target,'addEventListener').mockImplementation((type,listener,options)=>{listeners.push([target,type,listener,options]);add(type,listener,options)})
 }
})
afterEach(()=>{for(const [target,type,listener,options] of listeners)target.removeEventListener(type,listener,options);listeners=[];vi.clearAllTimers();vi.restoreAllMocks();vi.useRealTimers()})

const active=()=>({id:'active-journal',start:START-10*60000,lastUserInteractionAt:START-60000,sessionOrigin:{type:'extra',routineId:null},entries:[{id:'exercise',sets:[{done:false,r:8,w:30}]}]})
const minimal=()=>({_ts:START-1000,hasCompletedOnboarding:true,hasCompletedAppTour:true,unit:'kg',active:active(),
 routines:[{id:'kept-routine',ex:[]}],workouts:[{id:'kept-workout',d:'2026-10-20',entries:[]}],bodyweight:[{d:'2026-10-20',w:80}],customEx:[{id:'asset',img:'data:image/gif;base64,'+'a'.repeat(70000)}]})
const disk=()=>JSON.parse(localStorage.getItem(KEY))
const journal=()=>JSON.parse(localStorage.getItem(CLOCK_JOURNAL_KEY))
const gesture=store=>store.getState().recordInteraction(Date.now(),{defer:true,quietMs:1800})
async function setup(base=minimal(),metadata){
 localStorage.setItem(KEY,JSON.stringify(base));if(metadata)localStorage.setItem(CLOCK_JOURNAL_KEY,JSON.stringify(metadata))
 const {useStore}=await import('./useStore.js');await useStore.getState().boot();await vi.advanceTimersByTimeAsync(0);vi.clearAllMocks()
 return useStore
}
async function continuous(store,until){
 gesture(store)
 for(let elapsed=200;elapsed<=until;elapsed+=200){await vi.advanceTimersByTimeAsync(200);gesture(store)}
}

it('journals repeated gestures at each independent two-second bound without a full write or RAF',async()=>{
 const store=await setup(),before=store.getState().S,raw=localStorage.getItem(KEY)
 const writes=vi.spyOn(localStorage,'setItem'),frame=vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 await continuous(store,5000)
 expect(native.clock).toHaveBeenCalledTimes(2);expect(journal().at).toBe(START+3800)
 expect(journal()._ts).toBe(START+4000);expect(localStorage.getItem(KEY)).toBe(raw)
 expect(writes.mock.calls.filter(([key])=>key===KEY)).toHaveLength(0)
 expect(writes.mock.calls.filter(([key])=>key===CLOCK_JOURNAL_KEY).every(([,text])=>text.length<128)).toBe(true)
 expect(store.getState().S._ts).toBe(before._ts)
 for(const key of ['routines','workouts','bodyweight','customEx'])expect(store.getState().S[key]).toBe(before[key])
 expect(store.getState().S.active.entries).toBe(before.active.entries)
 expect(store.getState().reconcileActiveClock().lastUserInteractionAt).toBe(START+5000)
 expect(frame).not.toHaveBeenCalled();expect(native.save).not.toHaveBeenCalled()
})

it('keeps the normal quiet commit and exact full native mirror after a journaled burst settles',async()=>{
 const store=await setup(),before=store.getState().S
 await continuous(store,1000);await vi.advanceTimersByTimeAsync(1000)
 expect(native.clock).toHaveBeenCalledOnce();expect(disk().active.lastUserInteractionAt).toBe(before.active.lastUserInteractionAt)
 await vi.advanceTimersByTimeAsync(1900)
 const saved=disk();expect(saved.active.lastUserInteractionAt).toBe(START+1000)
 expect(saved._ts).toBeGreaterThan(journal()._ts)
 expect(native.save).toHaveBeenCalledOnce();expect(native.save.mock.calls[0]).toEqual([store.getState().S,localStorage.getItem(KEY)])
 expect(saved.workouts).toEqual(before.workouts);expect(saved.customEx).toEqual(before.customEx)
})

it('uses the latest marked input even if a normal input originally armed the hard timer',async()=>{
 const store=await setup(),raw=localStorage.getItem(KEY)
 vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 store.getState().recordInteraction(Date.now(),{defer:true})
 await vi.advanceTimersByTimeAsync(1000);gesture(store)
 await vi.advanceTimersByTimeAsync(1000)
 expect(native.clock).toHaveBeenCalledOnce();expect(journal().at).toBe(START+1000);expect(localStorage.getItem(KEY)).toBe(raw)
})

it('retains the normal full priority when an ordinary input is the latest input',async()=>{
 const store=await setup()
 vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 gesture(store);await vi.advanceTimersByTimeAsync(1000);store.getState().recordInteraction(Date.now(),{defer:true})
 await vi.advanceTimersByTimeAsync(1000)
 expect(native.clock).not.toHaveBeenCalled();expect(disk().active.lastUserInteractionAt).toBe(START+1000)
})

it('keeps the existing hard full write when the native atomic journal is unavailable',async()=>{
 const store=await setup();native.available=false
 vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 await continuous(store,1000);await vi.advanceTimersByTimeAsync(1000)
 expect(native.clock).not.toHaveBeenCalled();expect(localStorage.getItem(CLOCK_JOURNAL_KEY)).toBeNull()
 expect(disk().active.lastUserInteractionAt).toBe(START+1000)
})

it('publishes a durable captured input before the old inactivity cutoff without waiting for RAF',async()=>{
 const base=minimal();base.active.start=START-31*60000;base.active.lastUserInteractionAt=START+500-30*60000
 const store=await setup(base);vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 gesture(store);await vi.advanceTimersByTimeAsync(100);gesture(store);await vi.advanceTimersByTimeAsync(150)
 expect(native.clock).toHaveBeenCalledOnce();expect(journal().at).toBe(START+100)
 expect(store.getState().S.active.timerPausedAt).toBeUndefined()
 expect(inactivityDeadline(store.getState().S.active)).toBe(START+100+30*60000)
})

it('uses honestly cached full-base bytes for a journal-derived native snapshot, including local-newer boot',async()=>{
 const store=await setup(),base=store.getState().S,raw=JSON.stringify(base)
 const frame=vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 await continuous(store,1000);await vi.advanceTimersByTimeAsync(1000)
 const derived=store.getState().S,stringify=vi.spyOn(JSON,'stringify')
 await store.getState().boot()
 expect(native.save).toHaveBeenCalledOnce();expect(native.save.mock.calls[0]).toEqual([base,raw])
 expect(stringify.mock.calls.some(([value])=>value===derived)).toBe(false)
 stringify.mockRestore();frame.mockRestore()
 await vi.advanceTimersByTimeAsync(100);gesture(store);await vi.advanceTimersByTimeAsync(2700)
 expect(native.save.mock.calls.at(-1)).toEqual([store.getState().S,localStorage.getItem(KEY)])
 expect(disk().active.lastUserInteractionAt).toBe(START+2100)
})

it('retains pending input after journal storage failure and retries at a later hard bound',async()=>{
 const store=await setup(),before=store.getState().S,raw=localStorage.getItem(KEY),original=localStorage.setItem
 vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 const fail=vi.spyOn(localStorage,'setItem').mockImplementation(function(key,text){if(key===CLOCK_JOURNAL_KEY)throw new Error('journal full');return original.call(this,key,text)})
 await continuous(store,1000);await vi.advanceTimersByTimeAsync(1000)
 expect(store.getState().S).toBe(before);expect(localStorage.getItem(KEY)).toBe(raw);expect(native.clock).not.toHaveBeenCalled()
 expect(store.getState().storageWarning).toBe('primary');expect(store.getState().reconcileActiveClock().lastUserInteractionAt).toBe(START+1000)
 fail.mockRestore();gesture(store);await vi.advanceTimersByTimeAsync(2000)
 expect(journal().at).toBe(START+2000);expect(native.clock).toHaveBeenCalledOnce()
})

it('reports a native journal failure without discarding its durable primary record',async()=>{
 const store=await setup();native.clock.mockResolvedValue(false);vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 await continuous(store,1000);await vi.advanceTimersByTimeAsync(1000)
 expect(store.getState().storageWarning).toBe('mirror');expect(journal().at).toBe(START+1000)
 expect(store.getState().S.active.lastUserInteractionAt).toBe(START+1000)
 await store.getState().flushPersistence()
 expect(disk().active.lastUserInteractionAt).toBe(START+1000)
 expect(native.save.mock.calls.at(-1)[1]).toBe(localStorage.getItem(KEY))
})

it.each(['pagehide','explicit flush','ordinary edit'])('folds the journal and cancels delayed paths on %s',async action=>{
 const store=await setup();vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 await continuous(store,1000);await vi.advanceTimersByTimeAsync(1000)
 if(action==='pagehide')window.dispatchEvent(new Event('pagehide'))
 else if(action==='explicit flush')await store.getState().flushPersistence()
 else store.getState().update(s=>{s.bodyweight.push({d:'2026-10-21',w:81})})
 await vi.advanceTimersByTimeAsync(800)
 expect(disk().active.lastUserInteractionAt).toBe(START+1000)
 expect(native.save.mock.calls.at(-1)).toEqual([store.getState().S,localStorage.getItem(KEY)])
 const count=native.save.mock.calls.length;await vi.advanceTimersByTimeAsync(5000);expect(native.save).toHaveBeenCalledTimes(count)
 expect(native.clock).toHaveBeenCalledOnce();if(action==='ordinary edit')expect(disk().bodyweight).toHaveLength(2)
})

it('applies local metadata before the first load reconciliation instead of creating a false inactivity pause',async()=>{
 const base=minimal();base._ts=START-40*60000;base.active.start=START-45*60000;base.active.lastUserInteractionAt=START-31*60000
 const store=await setup(base,{id:base.active.id,at:START-5*60000,_ts:START-60000})
 expect(store.getState().S.active.timerPausedAt).toBeUndefined();expect(disk().active.lastUserInteractionAt).toBe(START-5*60000)
 expect(store.getState().S.workouts).toEqual(base.workouts)
})

it('chooses newer whole native data before applying the matching local clock overlay',async()=>{
 const local=minimal();local._ts=START-1000
 const remote={...minimal(),_ts:START-500,unit:'lb',bodyweight:[{d:'2026-10-21',w:180}]}
 native.load.mockResolvedValue(remote)
 const store=await setup(local,{id:local.active.id,at:START-100,_ts:START})
 expect(store.getState().S.unit).toBe('lb');expect(store.getState().S.bodyweight).toEqual(remote.bodyweight)
 expect(store.getState().S.active.lastUserInteractionAt).toBe(START-100)
})

it('does not let a clock-updated older native candidate defeat newer local preferences',async()=>{
 const local=minimal();local._ts=START-100
 native.load.mockResolvedValue({...minimal(),_ts:START-500,unit:'lb',active:{...active(),lastUserInteractionAt:START}})
 const store=await setup(local)
 expect(store.getState().S.unit).toBe('kg');expect(store.getState().S._ts).toBe(local._ts)
})

it('keeps the journal and current clock when an ordinary full primary write fails',async()=>{
 const store=await setup(),before=store.getState().S,original=localStorage.setItem
 vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
 await continuous(store,1000);await vi.advanceTimersByTimeAsync(1000)
 const fail=vi.spyOn(localStorage,'setItem').mockImplementation(function(key,text){if(key===KEY)throw new Error('profile full');return original.call(this,key,text)})
 expect(()=>store.getState().update(s=>{s.bodyweight.push({d:'2026-10-21',w:81})})).toThrow('profile full')
 expect(journal().at).toBe(START+1000);expect(store.getState().S.bodyweight).toEqual(before.bodyweight)
 expect(store.getState().S.active.lastUserInteractionAt).toBe(START+1000)
 fail.mockRestore();await store.getState().flushPersistence();expect(disk().active.lastUserInteractionAt).toBe(START+1000)
})
