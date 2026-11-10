// @vitest-environment happy-dom
import { it, expect, vi } from 'vitest'
import { createTimerPushClient } from './server-timer-push.js'

const deferred = () => { let resolve; const promise = new Promise(done => { resolve=done }); return { promise, resolve } }
const fixture = () => {
 const current = { user:{id:'a'} }, send=vi.fn(async()=>({ok:true})), subscription=vi.fn(async()=>({endpoint:'synthetic'}))
 return { current, send, subscription, timer:createTimerPushClient(()=>current.user,{send,subscription}) }
}

it('does no server or subscription work for a guest or static PWA', async()=>{
 const f=fixture();f.current.user=null
 expect(await f.timer('rest',10)).toBe(false);expect(await f.timer('work')).toBe(false)
 expect(f.send).not.toHaveBeenCalled();expect(f.subscription).not.toHaveBeenCalled()
})
it('uses an existing opt-in subscription and never schedules without one', async()=>{
 const f=fixture();f.subscription.mockResolvedValue(null)
 expect(await f.timer('work',10)).toBe(false);expect(await f.timer('work')).toBe(false)
 expect(f.send).not.toHaveBeenCalled()
 f.subscription.mockResolvedValue({endpoint:'synthetic'})
 expect(await f.timer('work',10)).toBe(true)
 expect(f.send).toHaveBeenCalledExactlyOnceWith('/api/push/work-timer',{method:'POST',body:'{"seconds":10}'})
})
it('invalidates a pending subscription lookup when its timer is stopped or account changes', async()=>{
 for(const action of ['stop','switch']){
  const f=fixture(),lookup=deferred();f.subscription.mockReturnValue(lookup.promise)
  const start=f.timer('work',10);await Promise.resolve();await Promise.resolve()
  const stop=action==='stop'?f.timer('work'):(f.current.user={id:'b'},Promise.resolve())
  lookup.resolve({endpoint:'synthetic'});await Promise.all([start,stop])
  expect(f.send).not.toHaveBeenCalled()
 }
})
it('serializes cancellation behind an in-flight schedule and coalesces repeated stops', async()=>{
 const f=fixture(),scheduled=deferred();f.send.mockReturnValueOnce(scheduled.promise)
 const start=f.timer('work',10);await vi.waitFor(()=>expect(f.send).toHaveBeenCalledOnce())
 const staleStop=f.timer('work'),lastStop=f.timer('work');expect(f.send).toHaveBeenCalledOnce()
 scheduled.resolve({ok:true});await Promise.all([start,staleStop,lastStop])
 expect(f.send.mock.calls.map(([url])=>url)).toEqual(['/api/push/work-timer','/api/push/work-timer/cancel'])
 await f.timer('work');expect(f.send).toHaveBeenCalledTimes(2)
})
it('keeps rest and work schedules/cancels separate and rejects invalid durations', async()=>{
 const f=fixture()
 for(const seconds of [NaN,Infinity,0,-1,3601,'10'])expect(await f.timer('work',seconds)).toBe(false)
 expect(f.subscription).not.toHaveBeenCalled();expect(f.send).not.toHaveBeenCalled()
 await Promise.all([f.timer('rest',15),f.timer('work',30)])
 await f.timer('rest')
 expect(f.send.mock.calls.map(([url])=>url)).toEqual(['/api/push/rest-timer','/api/push/work-timer','/api/push/rest-timer/cancel'])
 await f.timer('work');expect(f.send.mock.calls.at(-1)[0]).toBe('/api/push/work-timer/cancel')
})
it('keeps optional subscription/network failures outside the local timer lifecycle', async()=>{
 const f=fixture();f.subscription.mockRejectedValueOnce(Error('not available'))
 expect(await f.timer('work',10)).toBe(false)
 f.send.mockRejectedValueOnce(Error('offline'));expect(await f.timer('work',10)).toBe(false)
 expect(await f.timer('work')).toBe(true)
})
it('passes the authoritative client deadline and refuses a timer that expired during subscription IO',async()=>{
 const f=fixture(),endsAt=Date.now()+10000
 await f.timer('work',10,endsAt)
 expect(JSON.parse(f.send.mock.calls[0][1].body)).toEqual({seconds:10,endsAt})
 expect(await f.timer('work',10,Date.now()-1)).toBe(false);expect(f.send).toHaveBeenCalledOnce()
})
