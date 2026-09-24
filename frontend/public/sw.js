/* Replaced at build time; precache only this TGym build's app shell and assets. */
const CACHE = '__TGYM_CACHE__'
const PRECACHE = ['__TGYM_PRECACHE__']
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE))))
self.addEventListener('message', e => { if(e.data?.type==='SKIP_WAITING') self.skipWaiting() })
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^tgym-(?:app-)?[0-9]+\.[0-9]+\.[0-9]+-/.test(k) && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())))
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
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url)
 if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.endsWith('/build.json')||url.pathname.includes('/api/')||url.pathname.includes('/updates/')||url.pathname.includes('/downloads/')) return
 e.respondWith(caches.open(CACHE).then(async cache=>{
  const hit=await cache.match(e.request)
  if(hit) return hit
  try {
   const response=await fetch(e.request)
   if(response.ok) await cache.put(e.request,response.clone())
   return response
  } catch(error) {
   if(e.request.mode==='navigate') return (await cache.match('index.html'))||Response.error()
   return Response.error()
  }
 }))
})
