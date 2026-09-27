/* Replaced at build time; precache only this TGym build's app shell and assets. */
const CACHE = '__TGYM_CACHE__'
const PRECACHE = ['__TGYM_PRECACHE__']
const MEDIA_BASES = ['__TGYM_MEDIA__']
const MEDIA_CACHE = 'tgym-exercise-media-v1'
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE))))
self.addEventListener('message', e => { if(e.data?.type==='SKIP_WAITING') self.skipWaiting() })
// Keep the previous build for tabs still running its immutable chunks.
const appCache = key => /^tgym-(?:app-)?[0-9]+\.[0-9]+\.[0-9]+-/.test(key)
self.addEventListener('activate', e => e.waitUntil((async()=>{
 const old=(await caches.keys()).filter(k=>appCache(k)&&k!==CACHE)
 await Promise.all(old.slice(0,-1).map(k=>caches.delete(k)))
 await self.clients.claim()
})()))
self.addEventListener('message',e=>{
 if(['OFFLINE_STATUS','REPAIR_OFFLINE'].includes(e.data?.type)&&e.ports?.[0]) e.waitUntil((async()=>{
  try {
   const cache=await caches.open(CACHE)
   if(e.data.type==='REPAIR_OFFLINE') {
    // Never repair an old shell with HTML from a newer deployment.
    const response=await fetch(self.location.href,{cache:'no-store'})
    if(!response.ok)throw Error('Cannot verify deployed build')
    if(!(await response.text()).includes("const CACHE = '"+CACHE+"'")){e.ports[0].postMessage({ready:false,update:true});return}
    await cache.addAll(PRECACHE)
   }
   const ready=(await Promise.all(PRECACHE.map(path=>cache.match(path)))).every(Boolean)
   e.ports[0].postMessage({ready})
  }
  catch {e.ports[0].postMessage({ready:false})}
 })())
})
const AUDIO_CACHE = 'tgym-audio-preferences'
const AUDIO_KEY = './audio-preferences'
self.addEventListener('message',e=>{
 if(e.data?.type==='AUDIO_PREFERENCES') e.waitUntil(caches.open(AUDIO_CACHE).then(cache=>cache.put(AUDIO_KEY,new Response(JSON.stringify(e.data.settings)))))
})
self.addEventListener('push',e=>{
 const data=e.data?e.data.json():{}
 e.waitUntil((async()=>{
  let prefs={}
  try { const response=await (await caches.open(AUDIO_CACHE)).match(AUDIO_KEY);if(response)prefs=await response.json() }
  catch(error){console.warn('[TGym audio] Cannot read notification preferences',error.message)}
  const minutes=(value,fallback)=>{const valid=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)?value:fallback;const [h,m]=valid.split(':').map(Number);return h*60+m}
  const now=new Date(),cur=now.getHours()*60+now.getMinutes(),start=minutes(prefs.quietStart,'22:00'),end=minutes(prefs.quietEnd,'07:00')
  const quiet=prefs.quietOn&&(start<=end?cur>=start&&cur<end:cur>=start||cur<end)
  const rest=data.tag==='rest-timer'
  const windows=rest?await self.clients.matchAll({type:'window'}):[]
  const silent=data.silent===true||prefs.enabled===false||quiet||(rest?prefs.restSilent:prefs.notificationSilent)||windows.some(client=>client.visibilityState==='visible')
  await self.registration.showNotification(data.title||'TGym',{body:data.body||'',icon:'icon-512.png',tag:data.tag||'tgym',silent:!!silent})
 })())
})
self.addEventListener('notificationclick',e=>{
 e.notification.close()
 e.waitUntil(self.clients.matchAll({type:'window'}).then(clients=>clients[0]?.focus()||self.clients.openWindow('./')))
})
// Only build assets are cache-first. APIs, update metadata and downloads remain live.
// Navigation uses the installed shell, so fresh HTML cannot reference uncached new chunks.
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url),base=new URL('./',self.location.href)
 if(e.request.method==='GET'&&e.request.destination==='image'&&MEDIA_BASES.some(path=>url.href.startsWith(new URL(path,base).href))){
  e.respondWith((async()=>{
   let cache,hit
   try {cache=await caches.open(MEDIA_CACHE);hit=await cache.match(e.request)}catch{}
   const refresh=(async()=>{
    try {const response=await fetch(e.request)
     if(cache&&(response.ok||response.type==='opaque'))try {
      await cache.put(e.request,response.clone())
      const keys=await cache.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-40)).map(key=>cache.delete(key)))
     }catch{}
     return response
    }catch{return hit||Response.error()}
   })()
   if(hit){e.waitUntil(refresh);return hit}
   return refresh
  })());return
 }
 if(e.request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.pathname.endsWith('/build.json')||url.pathname.includes('/api/')||url.pathname.includes('/updates/')||url.pathname.includes('/downloads/')) return
 const path=url.pathname.slice(base.pathname.length)
 const shell=e.request.mode==='navigate'&&(path===''||path==='index.html')
 const key=shell?'index.html':e.request
 e.respondWith((async()=>{
  let cache
  try {
   cache=await caches.open(CACHE)
   const hit=await cache.match(key)
   if(hit)return hit
   if(path.startsWith('assets/')) {
    for(const previous of (await caches.keys()).filter(k=>appCache(k)&&k!==CACHE).reverse()){
     const old=await (await caches.open(previous)).match(e.request)
     if(old)return old
    }
   }
  }catch(error){console.warn('[TGym offline] Cache read failed',error.name)}
  try {
   const response=await fetch(e.request)
   if(response.ok && cache && (shell||PRECACHE.includes(path))) {
    // A full cache must not turn a successful network response into a failed request.
    try {await cache.put(key,response.clone())}catch(error){console.warn('[TGym offline] Cache write failed',error.name)}
   }
   if(response.ok||e.request.mode!=='navigate')return response
  }catch(error){if(e.request.mode!=='navigate')return Response.error()}
  try {return (await cache?.match('index.html'))||Response.error()}catch{return Response.error()}
 })())
})
