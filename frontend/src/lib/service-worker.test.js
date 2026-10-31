import {it,expect,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const source=readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8').replaceAll('__TGYM_CACHE__','tgym-app-1.15.25-test').replace("['__TGYM_PRECACHE__']",JSON.stringify(['index.html','assets/new.js'])).replace("['__TGYM_MEDIA__']",JSON.stringify(['img/','gif/']))
function worker({offline=false,failInstall=false,failWrite=false,oldChunk=false,failRead=false,base='https://app.test/',mediaHit=false,mediaType}={}) {
 const handlers={}, data=new Map([['index.html',new Response('offline shell')]])
 const cache={match:async key=>{if(failRead)throw Error('denied');return data.get(typeof key==='string'?key:key.url)},put:vi.fn(async(key,value)=>{if(failWrite)throw Error('quota');data.set(typeof key==='string'?key:key.url,value.clone())})}
 const mediaCache={match:async()=>{if(!mediaHit)return;const response=new Response('saved image');if(mediaType)Object.defineProperty(response,'type',{value:mediaType});return response},put:vi.fn(async()=>{}),keys:async()=>Array.from({length:43},(_,i)=>'image'+i),delete:vi.fn(async()=>true)}
 const caches={keys:async()=>['tgym-1.15.18-old','tgym-app-1.15.24-old','tgym-app-1.15.25-test','tgym-user-data','unrelated'],delete:vi.fn(),open:async key=>key==='tgym-exercise-media-v1'?mediaCache:key==='tgym-app-1.15.24-old'&&oldChunk?{match:async()=>new Response('old chunk')}:cache}
 const self={location:{origin:new URL(base).origin,href:base+'sw.js'},addEventListener:(name,fn)=>{const previous=handlers[name];handlers[name]=previous?e=>{previous(e);fn(e)}:fn},clients:{claim:vi.fn()},skipWaiting:vi.fn()}
 const fetch=vi.fn(()=>offline||failInstall?Promise.reject(Error('offline')):Promise.resolve(new Response('network')))
 vm.runInNewContext(source,{self,caches,URL,Response,fetch,console})
 return {handlers,caches,self,cache,fetch,mediaCache,data}
}
it('updates only versioned app caches, never user data or other origins',async()=>{const w=worker();let done;w.handlers.activate({waitUntil:p=>done=p});await done;expect(w.caches.delete.mock.calls.flat()).toEqual(['tgym-1.15.18-old']);expect(w.self.clients.claim).toHaveBeenCalledOnce()})
it('serves the installed shell offline and bypasses update manifests',async()=>{const w=worker({offline:true});let response;w.handlers.fetch({request:{method:'GET',url:'https://app.test/plan',mode:'navigate'},respondWith:p=>response=p});expect(await (await response).text()).toBe('offline shell');const respondWith=vi.fn();w.handlers.fetch({request:{method:'GET',url:'https://app.test/updates/latest.json'},respondWith});expect(respondWith).not.toHaveBeenCalled()})
it('rejects incomplete installs without activating or clearing previous caches',async()=>{const w=worker({failInstall:true});let done;w.handlers.install({waitUntil:p=>done=p});await expect(done).rejects.toThrow();expect(w.caches.delete).not.toHaveBeenCalled();expect(w.self.skipWaiting).not.toHaveBeenCalled()})

it('persists notification mute across worker recreation and applies it to push',async()=>{
 const make=store=>{const handlers={},cache={match:async key=>store.get(key),put:async(key,value)=>store.set(key,value)},self={location:{origin:'https://app.test'},clients:{matchAll:async()=>[]},registration:{showNotification:vi.fn(async()=>{})},addEventListener:(name,fn)=>{(handlers[name]||=[]).push(fn)}};vm.runInNewContext(source,{self,caches:{open:async()=>cache},Response,URL,console,Date});return{handlers,self}}
 const store=new Map(),first=make(store);let write
 for(const handler of first.handlers.message)handler({data:{type:'AUDIO_PREFERENCES',settings:{enabled:false}},waitUntil:p=>write=p})
 await write
 const second=make(store);let pushed
 second.handlers.push[0]({data:{json:()=>({title:'Alert'})},waitUntil:p=>pushed=p});await pushed
 expect(second.self.registration.showNotification).toHaveBeenCalledWith('Alert',expect.objectContaining({silent:true}))
})

function notificationWorker(prefs={},windows=[],store=new Map()) {
 const handlers={},self={location:{origin:'https://app.test',href:'https://app.test/TGym/sw.js'},
  clients:{matchAll:vi.fn(async()=>windows),openWindow:vi.fn(async()=>{})},registration:{showNotification:vi.fn(async()=>{})},
  addEventListener:(name,fn)=>{const previous=handlers[name];handlers[name]=previous?e=>{previous(e);fn(e)}:fn}}
 vm.runInNewContext(source,{self,caches:{open:async()=>({match:async key=>key==='./audio-preferences'?new Response(JSON.stringify(prefs)):store.get(key),put:async(key,value)=>store.set(key,value)})},Response,URL,console,Date})
 return{handlers,self}
}
const pushNotice=async(w,data)=>{let done;w.handlers.push({data:{json:()=>data},waitUntil:p=>done=p});await done;return w.self.registration.showNotification.mock.calls.at(-1)}

it('uses independent push mute and timer policy with persistent scoped metadata',async()=>{
 const w=notificationWorker({notificationSilent:true,restSilent:false,vibration:true})
 const [title,options]=await pushNotice(w,{title:'Rest finished',tag:'rest-timer',timestamp:123})
 expect(title).toBe('Rest finished');expect(options).toMatchObject({silent:false,renotify:true,timestamp:123,vibrate:[180,80,180],badge:'https://app.test/TGym/notification-badge.svg',data:{route:'/workout',url:'https://app.test/TGym/#/workout'}})
 const muted=notificationWorker({notificationSilent:true});expect((await pushNotice(muted,{title:'Reminder',tag:'day-reminder'}))[1].silent).toBe(true)
 const work=notificationWorker({workSilent:true});expect((await pushNotice(work,{tag:'work-timer'}))[1].silent).toBe(true)
})
it('leaves visible-app timer sound to its foreground player and never combines silent with vibration',async()=>{
 const w=notificationWorker({},[{visibilityState:'visible'}])
 const [,options]=await pushNotice(w,{tag:'work-timer'})
 expect(options.silent).toBe(true);expect(options).not.toHaveProperty('vibrate')
})
const workerMessage=async(w,type,notification)=>{
 let done;const port={postMessage:vi.fn()}
 w.handlers.message({data:{type,notification},ports:[port],waitUntil:p=>done=p});await done;return port
}
it('serializes local and server timer notices, survives recreation, and alerts the next real occurrence',async()=>{
 const store=new Map(),w=notificationWorker({},[],store),notice={title:'Done',tag:'work-timer',timestamp:1000}
 let push;const local=workerMessage(w,'TGYM_TIMER_NOTICE',notice)
 w.handlers.push({data:{json:()=>notice},waitUntil:p=>push=p})
 const port=await local;await push
 expect(port.postMessage).toHaveBeenCalledExactlyOnceWith({shown:true});expect(w.self.registration.showNotification).toHaveBeenCalledTimes(2)
 expect(w.self.registration.showNotification.mock.calls.filter(([,options])=>!options.silent)).toHaveLength(1)
 const next=notificationWorker({},[],store)
 expect((await pushNotice(next,notice))[1]).toMatchObject({silent:true,renotify:false})
 await pushNotice(next,{...notice,timestamp:2000})
 expect(next.self.registration.showNotification).toHaveBeenLastCalledWith('Done',expect.objectContaining({silent:false,renotify:true,timestamp:2000}))
 expect((await pushNotice(next,{...notice,timestamp:1500}))[1]).toMatchObject({silent:true,timestamp:2000})
 expect(next.self.registration.showNotification.mock.calls.filter(([,options])=>!options.silent)).toHaveLength(1)
})
it('claims a foreground cue before a late push and never lets work cancellation policy suppress rest',async()=>{
 const w=notificationWorker()
 await workerMessage(w,'TGYM_TIMER_HANDLED',{tag:'work-timer',timestamp:1000})
 expect((await pushNotice(w,{tag:'work-timer',timestamp:1000}))[1].silent).toBe(true)
 expect((await pushNotice(w,{tag:'rest-timer',timestamp:1000}))[1].silent).toBe(false)
})
it('acknowledges a failed local OS notice without claiming it and can retry a later valid delivery',async()=>{
 const w=notificationWorker();w.self.registration.showNotification.mockRejectedValueOnce(Error('unavailable'))
 const notice={tag:'rest-timer',timestamp:1000},port=await workerMessage(w,'TGYM_TIMER_NOTICE',notice)
 expect(port.postMessage).toHaveBeenCalledExactlyOnceWith({shown:false})
 await pushNotice(w,notice);expect(w.self.registration.showNotification).toHaveBeenCalledTimes(2)
})
it('recognizes a direct page fallback already displayed during a worker handoff',async()=>{
 const w=notificationWorker();w.self.registration.getNotifications=vi.fn(async()=>[{timestamp:1000}])
 const port=await workerMessage(w,'TGYM_TIMER_NOTICE',{tag:'rest-timer',timestamp:1000})
 expect(port.postMessage).toHaveBeenCalledExactlyOnceWith({shown:true})
 expect(w.self.registration.showNotification).not.toHaveBeenCalled()
 expect(w.self.registration.getNotifications).toHaveBeenCalledExactlyOnceWith({tag:'rest-timer'})
})
it('keeps a newer tagged notice intact and silent when a stale push arrives, satisfying userVisibleOnly',async()=>{
 const w=notificationWorker();w.self.registration.getNotifications=vi.fn(async()=>[{timestamp:2000,title:'Newer timer',body:'Current result',data:{url:'https://app.test/TGym/#/workout'}}])
 const [title,options]=await pushNotice(w,{tag:'rest-timer',timestamp:1000,title:'Old timer'})
 expect(title).toBe('Newer timer');expect(options).toMatchObject({body:'Current result',timestamp:2000,silent:true,renotify:false})
 expect(options).not.toHaveProperty('vibrate')
})
it('retains a usable push notice when optional notification reads or saved audio metadata fail',async()=>{
 const w=notificationWorker(null)
 w.self.registration.getNotifications=vi.fn(async()=>{throw Error('unsupported')})
 w.self.clients.matchAll.mockRejectedValueOnce(Error('unavailable'))
 expect((await pushNotice(w,{tag:'work-timer',timestamp:1000,title:'Done'}))[0]).toBe('Done')
})
it('handles malformed push data without rejecting the worker event or trusting external routes',async()=>{
 const w=notificationWorker();let done
 w.handlers.push({data:{json:()=>{throw Error('malformed')}},waitUntil:p=>done=p});await done
 expect(w.self.registration.showNotification).toHaveBeenCalledWith('TGym',expect.objectContaining({body:'',data:{route:'/home',url:'https://app.test/TGym/#/home'}}))
 const evil=notificationWorker();const [,options]=await pushNotice(evil,{tag:'rest-timer',url:'https://outside.test/#/body',title:'x'.repeat(500),body:'y'.repeat(1000)})
 expect(options.body.length).toBe(700);expect(evil.self.registration.showNotification.mock.calls[0][0].length).toBe(150)
 expect(options.data.url).toBe('https://app.test/TGym/#/workout')
})
it('opens the corresponding workout in an existing app client without focusing sibling apps',async()=>{
 const sibling={url:'https://app.test/another/',focus:vi.fn()},app={url:'https://app.test/TGym/#/stats',focus:vi.fn(async()=>{}),navigate:vi.fn(async()=>app)}
 const w=notificationWorker({},[sibling,app]);let done;const close=vi.fn()
 w.handlers.notificationclick({notification:{tag:'rest-timer',data:{url:'https://app.test/TGym/#/workout'},close},waitUntil:p=>done=p});await done
 expect(close).toHaveBeenCalledOnce();expect(app.navigate).toHaveBeenCalledExactlyOnceWith('https://app.test/TGym/#/workout');expect(app.focus).toHaveBeenCalledOnce()
 expect(sibling.focus).not.toHaveBeenCalled();expect(w.self.clients.openWindow).not.toHaveBeenCalled()
})
it('retains an explicit validated route when a client needs the message fallback, or opens a new scoped window',async()=>{
 const app={url:'https://app.test/TGym/',focus:vi.fn(async()=>{}),postMessage:vi.fn()};const w=notificationWorker({},[app]);let done
 w.handlers.notificationclick({notification:{tag:'tgym',data:{url:'https://app.test/TGym/#/body'},close:vi.fn()},waitUntil:p=>done=p});await done
 expect(app.postMessage).toHaveBeenCalledExactlyOnceWith({type:'TGYM_NOTIFICATION_NAVIGATE',route:'/body'})
 const fresh=notificationWorker();fresh.handlers.notificationclick({notification:{tag:'work-timer',close:vi.fn()},waitUntil:p=>done=p});await done
 expect(fresh.self.clients.openWindow).toHaveBeenCalledExactlyOnceWith('https://app.test/TGym/#/workout')
})

it('serves the installed root shell even online, without mixing new network HTML',async()=>{
 const w=worker();let response
 w.handlers.fetch({request:{method:'GET',url:'https://app.test/?launch=home',mode:'navigate'},respondWith:p=>response=p})
 expect(await (await response).text()).toBe('offline shell');expect(w.fetch).not.toHaveBeenCalled()
})
it('keeps an online response usable if the cache is full or inaccessible',async()=>{
 for(const options of [{failWrite:true},{failRead:true}]){
  const w=worker(options);let response
  w.handlers.fetch({request:{method:'GET',url:'https://app.test/assets/new.js'},respondWith:p=>response=p})
  expect(await (await response).text()).toBe('network');expect(w.cache.put).toHaveBeenCalledOnce()
 }
})
it('preserves a previous tab lazy chunk after activating the next build',async()=>{
 const w=worker({offline:true,oldChunk:true});let response
 w.handlers.fetch({request:{method:'GET',url:'https://app.test/assets/old.js'},respondWith:p=>response=p})
 expect(await (await response).text()).toBe('old chunk')
})
it('keeps APIs, metadata and downloads out of shell caches',()=>{
 const w=worker()
 for(const path of ['api/data','build.json','updates/latest.json','downloads/TGym.apk']){
  const respondWith=vi.fn();w.handlers.fetch({request:{method:'GET',url:'https://app.test/'+path},respondWith});expect(respondWith).not.toHaveBeenCalled()
 }
})

it('reports readiness only when every essential resource is cached',async()=>{
 const w=worker();let done;const port={postMessage:vi.fn()}
 const check=async()=>{w.handlers.message({data:{type:'OFFLINE_STATUS'},ports:[port],waitUntil:p=>done=p});await done}
 await check();expect(port.postMessage).toHaveBeenLastCalledWith({ready:false})
 w.data.set('assets/new.js',new Response('module'));await check();expect(port.postMessage).toHaveBeenLastCalledWith({ready:true})
})
it('supports an installed subpath without intercepting sibling applications',async()=>{
 const w=worker({base:'https://app.test/TGym/',offline:true});let response
 w.handlers.fetch({request:{method:'GET',url:'https://app.test/TGym/?source=pwa',mode:'navigate'},respondWith:p=>response=p})
 expect(await (await response).text()).toBe('offline shell')
 const respondWith=vi.fn();w.handlers.fetch({request:{method:'GET',url:'https://app.test/other/index.html',mode:'navigate'},respondWith});expect(respondWith).not.toHaveBeenCalled()
})
it('reuses viewed exercise images offline and bounds the optional media cache',async()=>{
 for(const offline of [false,true]){
  const w=worker({offline,mediaHit:true});let response,refresh
  w.handlers.fetch({request:{method:'GET',url:'https://app.test/img/bench.jpg',destination:'image'},respondWith:p=>response=p,waitUntil:p=>refresh=p})
  expect(await (await response).text()).toBe('saved image');await refresh
  expect(w.mediaCache.delete).toHaveBeenCalledTimes(offline?0:3)
 }
})

it.each(['cors','same-origin'])('does not serve an opaque media cache entry to a %s image request',async mode=>{
 for(const offline of [false,true]){
  const w=worker({offline,mediaHit:true,mediaType:'opaque'});let response
  w.handlers.fetch({request:{method:'GET',url:'https://app.test/gif/bench.gif',destination:'image',mode},respondWith:p=>response=p,waitUntil:vi.fn()})
  const result=await response
  if(offline)expect(result.type).toBe('error')
  else expect(await result.text()).toBe('network')
  expect(w.fetch).toHaveBeenCalledOnce()
  expect(w.mediaCache.put).toHaveBeenCalledTimes(offline?0:1)
  expect(w.caches.delete).not.toHaveBeenCalled()
 }
})

it('retains opaque cached animations for compatible no-cors image requests online and offline',async()=>{
 for(const offline of [false,true]){
  const w=worker({offline,mediaHit:true,mediaType:'opaque'});let response,refresh
  w.handlers.fetch({request:{method:'GET',url:'https://app.test/gif/bench.gif',destination:'image',mode:'no-cors'},respondWith:p=>response=p,waitUntil:p=>refresh=p})
  const result=await response
  expect(result.type).toBe('opaque');expect(await result.text()).toBe('saved image');await refresh
  expect(w.fetch).toHaveBeenCalledOnce();expect(w.caches.delete).not.toHaveBeenCalled()
 }
})

it('repairs missing shell assets only against the same deployed build',async()=>{
 for(const sameBuild of [false,true]){
  const w=worker();let done;const port={postMessage:vi.fn()}
  w.fetch.mockImplementation(url=>Promise.resolve(new Response(String(url).includes('sw.js')?(sameBuild?"const CACHE = 'tgym-app-1.15.25-test'":"const CACHE = 'tgym-app-next'"):'restored module')))
  w.handlers.message({data:{type:'REPAIR_OFFLINE'},ports:[port],waitUntil:p=>done=p});await done
  expect(w.cache.put).toHaveBeenCalledTimes(sameBuild?2:0)
  expect(port.postMessage).toHaveBeenLastCalledWith(sameBuild?{ready:true}:{ready:false,update:true})
 }
})
it('installs fresh build assets even when HTTP cache contains the previous HTML',async()=>{
 const w=worker({base:'https://app.test/TGym/'})
 w.fetch.mockImplementation((url,options)=>Promise.resolve(new Response(options.cache==='no-store'&&new URL(url).searchParams.get('tgymBuild')==='tgym-app-1.15.25-test'?'new build':'old HTTP cache')))
 let done;w.handlers.install({waitUntil:p=>done=p});await done
 expect(await w.data.get('index.html').text()).toBe('new build')
 expect(w.cache.put.mock.calls.map(([key])=>key).sort()).toEqual(['assets/new.js','index.html'])
 expect(w.fetch.mock.calls.every(([url])=>new URL(url).pathname.startsWith('/TGym/'))).toBe(true)
})
it('rejects unavailable new assets without activating the incomplete build',async()=>{
 const w=worker();w.fetch.mockResolvedValue(new Response('missing',{status:404}))
 let done;w.handlers.install({waitUntil:p=>done=p});await expect(done).rejects.toThrow('Cannot cache shell asset')
 expect(w.cache.put).not.toHaveBeenCalled();expect(w.self.skipWaiting).not.toHaveBeenCalled();expect(w.caches.delete).not.toHaveBeenCalled()
})
