/* Replaced at build time; precache only this TGym build's app shell and assets. */
const CACHE = '__TGYM_CACHE__'
const PRECACHE = ['__TGYM_PRECACHE__']
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE))))
self.addEventListener('message', e => { if(e.data?.type==='SKIP_WAITING') self.skipWaiting() })
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tgym-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())))
self.addEventListener('push',e=>{
 const data=e.data?e.data.json():{}
 e.waitUntil(self.registration.showNotification(data.title||'TGym',{body:data.body||'',icon:'icon-512.png',tag:data.tag||'tgym'}))
})
self.addEventListener('notificationclick',e=>{
 e.notification.close()
 e.waitUntil(self.clients.matchAll({type:'window'}).then(clients=>clients[0]?.focus()||self.clients.openWindow('./')))
})
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url)
 if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/')||url.pathname.includes('/updates/')||url.pathname.includes('/downloads/')) return
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
