// @vitest-environment happy-dom
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const calls=vi.hoisted(()=>({sync:vi.fn(async()=>true),play:vi.fn(async()=>true)}))
vi.mock('../lib/workout-notification.js',()=>({syncWorkoutNotification:calls.sync}))
vi.mock('../lib/sound.js',()=>({playAppSound:calls.play,vibrate:vi.fn()}))
import {useUI} from './useUI.js'
import {useStore,DEF} from './useStore.js'
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(100000)
 useStore.setState({S:{...structuredClone(DEF),active:{id:'timers',start:100000,entries:[]}},user:null})
 useUI.getState().stopRest();useUI.getState().stopWork();vi.clearAllMocks()
})
afterEach(()=>{useUI.getState().stopRest();useUI.getState().stopWork();vi.useRealTimers()})
it('sends rest start/edit/cancel to native immediately and uses the same deadline for sound deduplication',()=>{
 useUI.getState().startRest(10)
 expect(calls.sync.mock.calls.at(-1)[1]).toMatchObject({endsAt:110000})
 useUI.getState().addRest(5)
 expect(calls.sync.mock.calls.at(-1)[1]).toMatchObject({endsAt:115000})
 vi.advanceTimersByTime(15000)
 expect(calls.play).toHaveBeenCalledWith(expect.anything(),'rest',{occurrence:115000})
 expect(calls.sync.mock.calls.at(-1)[1]).toBeNull();expect(useStore.getState().S.active.restTimer).toBeUndefined()
 expect(useStore.getState().S.workouts).toEqual([])
})
it('sends work deadlines immediately and never sounds before the authoritative deadline',()=>{
 const done=vi.fn();useUI.getState().startWork(10,'Hold',done)
 expect(calls.sync.mock.calls.at(-1)[0].workEndsAt).toBe(110000)
 vi.setSystemTime(109600);document.dispatchEvent(new Event('visibilitychange'))
 expect(calls.play.mock.calls.some(c=>c[1]==='work')).toBe(false);expect(done).not.toHaveBeenCalled()
 vi.setSystemTime(110000);document.dispatchEvent(new Event('visibilitychange'))
 expect(calls.play).toHaveBeenCalledWith(expect.anything(),'work',{occurrence:110000})
 expect(done).toHaveBeenCalledOnce();expect(done).toHaveBeenCalledWith(10,{timedOut:true,completedAt:110000})
 expect(calls.sync.mock.calls.at(-1)[0].workEndsAt).toBeUndefined();expect(useStore.getState().S.workouts).toEqual([])
})
