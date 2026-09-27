import {it,expect,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const source=readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8').replaceAll('__TGYM_CACHE__','tgym-app-1.15.25-test').replace("['__TGYM_PRECACHE__']",JSON.stringify(['index.html','assets/new.js'])).replace("['__TGYM_MEDIA__']",JSON.stringify(['img/','gif/']))
function worker({offline=false,failInstall=false,failWrite=false,oldChunk=false,failRead=false,base='https://app.test/',mediaHit=false}={}) {
 const handlers={}, data=new Map([['index.html',new Response('offline shell')]])
 const cache={addAll:()=>failInstall?Promise.reject(Error('offline')):Promise.resolve(),match:async key=>{if(failRead)throw Error('denied');return data.get(typeof key==='string'?key:key.url)},put:vi.fn(async()=>{if(failWrite)throw Error('quota')})}
 const mediaCache={match:async()=>mediaHit?new Response('saved image'):undefined,put:vi.fn(async()=>{}),keys:async()=>Array.from({length:43},(_,i)=>'image'+i),delete:vi.fn(async()=>true)}
 const caches={keys:async()=>['tgym-1.15.18-old','tgym-app-1.15.24-old','tgym-app-1.15.25-test','tgym-user-data','unrelated'],delete:vi.fn(),open:async key=>key==='tgym-exercise-media-v1'?mediaCache:key==='tgym-app-1.15.24-old'&&oldChunk?{match:async()=>new Response('old chunk')}:cache}
 const self={location:{origin:new URL(base).origin,href:base+'sw.js'},addEventListener:(name,fn)=>{const previous=handlers[name];handlers[name]=previous?e=>{previous(e);fn(e)}:fn},clients:{claim:vi.fn()},skipWaiting:vi.fn()}
 const fetch=vi.fn(()=>offline?Promise.reject(Error('offline')):Promise.resolve(new Response('network')))
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

it('repairs missing shell assets only against the same deployed build',async()=>{
 for(const sameBuild of [false,true]){
  const w=worker();let done;const port={postMessage:vi.fn()}
  w.cache.addAll=vi.fn(async()=>w.data.set('assets/new.js',new Response('restored module')))
  w.fetch.mockResolvedValue(new Response(sameBuild?"const CACHE = 'tgym-app-1.15.25-test'":"const CACHE = 'tgym-app-next'"))
  w.handlers.message({data:{type:'REPAIR_OFFLINE'},ports:[port],waitUntil:p=>done=p});await done
  expect(w.cache.addAll).toHaveBeenCalledTimes(sameBuild?1:0)
  expect(port.postMessage).toHaveBeenLastCalledWith(sameBuild?{ready:true}:{ready:false,update:true})
 }
})
