// @vitest-environment happy-dom
import {it,expect,vi} from 'vitest'
const native=vi.hoisted(()=>({sync:vi.fn(async()=>({enabled:true}))}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},registerPlugin:()=>native}))
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:{checkPermissions:async()=>({display:'granted'})}}))
import {syncWorkoutNotification,clearWorkoutNotification} from './workout-notification.js'
it('coalesces obsolete set updates and clears instead of publishing a completion notice',async()=>{
 const a={start:Date.now()-60000,entries:[{sets:[{done:false},{done:false}]}]}
 const first=syncWorkoutNotification(a,{endsAt:Date.now()+30000})
 a.entries[0].sets[0].done=true
 const second=syncWorkoutNotification(a,{endsAt:Date.now()+30000})
 await Promise.all([first,second]);expect(native.sync).toHaveBeenCalledTimes(1);expect(native.sync.mock.calls[0][0]).toMatchObject({setLabel:'SET 2',active:true})
 await clearWorkoutNotification();expect(native.sync.mock.calls.at(-1)[0]).toMatchObject({active:false});expect(native.sync.mock.calls.at(-1)[0]).not.toHaveProperty('completed')
})
