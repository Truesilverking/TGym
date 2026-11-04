// @vitest-environment happy-dom
import {beforeEach,it,expect,vi} from 'vitest'
const native=vi.hoisted(()=>({sync:vi.fn(async()=>({enabled:true})),checkPermissions:vi.fn(async()=>({display:'granted'})),requestPermissions:vi.fn(async()=>({display:'granted'}))}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},registerPlugin:()=>native}))
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:native}))
let syncWorkoutNotification,clearWorkoutNotification
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();native.checkPermissions.mockResolvedValue({display:'granted'});({syncWorkoutNotification,clearWorkoutNotification}=await import('./workout-notification.js'))})
it('coalesces obsolete set updates and clears instead of publishing a completion notice',async()=>{
 const a={start:Date.now()-60000,entries:[{sets:[{done:false},{done:false}]}]}
 const first=syncWorkoutNotification(a,{endsAt:Date.now()+30000})
 a.entries[0].sets[0].done=true
 const second=syncWorkoutNotification(a,{endsAt:Date.now()+30000})
 await Promise.all([first,second]);expect(native.sync).toHaveBeenCalledTimes(1);expect(native.sync.mock.calls[0][0]).toMatchObject({setLabel:'SET 2',active:true})
 await clearWorkoutNotification();expect(native.sync.mock.calls.at(-1)[0]).toMatchObject({active:false});expect(native.sync.mock.calls.at(-1)[0]).not.toHaveProperty('completed')
})
it('never prompts on boot/restoration and keeps an explicit permission intent through coalescing',async()=>{
 const a={start:Date.now()-60000,entries:[]}
 native.checkPermissions.mockResolvedValue({display:'prompt'})
 await syncWorkoutNotification(a,null)
 expect(native.checkPermissions).not.toHaveBeenCalled();expect(native.requestPermissions).not.toHaveBeenCalled()
 await Promise.all([syncWorkoutNotification(a,null,{interactive:true}),syncWorkoutNotification(a,null)])
 await vi.waitFor(()=>expect(native.requestPermissions).toHaveBeenCalledOnce())
 await syncWorkoutNotification(a,null,{interactive:true});expect(native.requestPermissions).toHaveBeenCalledOnce()
})
it('allows an explicit retry after a transient permission-check failure',async()=>{
 const a={start:Date.now()-60000,entries:[]}
 native.checkPermissions.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue({display:'prompt'})
 expect(await syncWorkoutNotification(a,null,{interactive:true})).toEqual({enabled:true})
 await vi.waitFor(()=>expect(native.checkPermissions).toHaveBeenCalledOnce())
 await Promise.resolve();await syncWorkoutNotification(a,null,{interactive:true})
 await vi.waitFor(()=>expect(native.requestPermissions).toHaveBeenCalledOnce());expect(native.sync).toHaveBeenCalledTimes(2)
})
it('establishes and clears the native timer while permission UI is still pending',async()=>{
 const a={start:Date.now()-60000,entries:[]};let answer
 native.checkPermissions.mockResolvedValue({display:'prompt'});native.requestPermissions.mockImplementationOnce(()=>new Promise(resolve=>{answer=resolve}))
 await syncWorkoutNotification(a,{endsAt:Date.now()+30000},{interactive:true})
 await vi.waitFor(()=>expect(answer).toBeTypeOf('function'));expect(native.sync).toHaveBeenCalledOnce()
 await clearWorkoutNotification();expect(native.sync.mock.calls.at(-1)[0]).toMatchObject({active:false})
 answer({display:'granted'});await Promise.resolve()
})
it('keeps the native timer active when notification permission is denied, without another prompt',async()=>{
 const a={start:Date.now()-60000,entries:[]}
 native.checkPermissions.mockResolvedValue({display:'denied'})
 await syncWorkoutNotification(a,{endsAt:Date.now()+30000},{interactive:true})
 await vi.waitFor(()=>expect(native.checkPermissions).toHaveBeenCalledOnce())
 expect(native.requestPermissions).not.toHaveBeenCalled()
 expect(native.sync).toHaveBeenCalledWith(expect.objectContaining({active:true,restEndsAt:expect.any(Number)}))
})
