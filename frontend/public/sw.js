/* Replaced at build time; precache only this TGym build's app shell and assets. */
const CACHE = '__TGYM_CACHE__'
const PRECACHE = ['__TGYM_PRECACHE__']
const MEDIA_BASES = ['__TGYM_MEDIA__']
const MEDIA_CACHE = 'tgym-exercise-media-v1'
// A new worker must not fill its cache with a previous build's HTTP-cached HTML.
// Keep canonical cache keys while each network request identifies this exact build.
async function precacheFresh(cache) {
 await Promise.all(PRECACHE.map(async path=>{
  const url=new URL(path,self.location.href)
  url.searchParams.set('tgymBuild',CACHE)
  const response=await fetch(url,{cache:'no-store'})
  if(!response.ok)throw Error('Cannot cache shell asset')
  await cache.put(path,response)
 }))
}
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(precacheFresh)))
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
    await precacheFresh(cache)
   }
   const ready=(await Promise.all(PRECACHE.map(path=>cache.match(path)))).every(Boolean)
   e.ports[0].postMessage({ready})
  }
  catch {e.ports[0].postMessage({ready:false})}
 })())
})
const AUDIO_CACHE = 'tgym-audio-preferences'
const AUDIO_KEY = './audio-preferences'
const notificationBase = () => new URL('./',self.location.href || self.location.origin + '/')
function notificationRoute(data = {}) {
 const fallback = ['rest-timer','work-timer'].includes(data.tag) || ['rest-timer','work-timer'].includes(data.type) ? '/workout' : data.type === 'measurement' ? '/body' : '/home'
 if(typeof data.url !== 'string')return fallback
 try {
  const base=notificationBase(),url=new URL(data.url,base)
  if(url.origin===base.origin&&url.pathname.startsWith(base.pathname)&&['#/home','#/workout','#/body'].includes(url.hash))return url.hash.slice(1)
 }catch{}
 return fallback
}
self.addEventListener('message',e=>{
 if(e.data?.type==='AUDIO_PREFERENCES') e.waitUntil(caches.open(AUDIO_CACHE).then(cache=>cache.put(AUDIO_KEY,new Response(JSON.stringify(e.data.settings)))))
})
let notificationQueue=Promise.resolve()
const timerOccurrences=new Map()
const timerTag = data => ['rest-timer','work-timer'].includes(data.tag)?data.tag:null
const queueNotification = task => {notificationQueue=notificationQueue.catch(()=>{}).then(task);return notificationQueue}
async function lastTimerOccurrence(tag) {
 if(timerOccurrences.has(tag))return timerOccurrences.get(tag)
 try {const response=await (await caches.open(AUDIO_CACHE)).match('./last-'+tag);const at=(await response?.json())?.at;if(Number.isFinite(at)){timerOccurrences.set(tag,at);return at}}catch{}
 return 0
}
async function rememberTimerOccurrence(tag,at) {
 if(!Number.isFinite(at)||at<=0)return
 timerOccurrences.set(tag,at)
 try {await (await caches.open(AUDIO_CACHE)).put('./last-'+tag,new Response(JSON.stringify({at})))}catch{}
}
async function showAppNotification(data,receivedPush=false) {
  const tag=timerTag(data)
  let at=Number.isFinite(data.timestamp)?data.timestamp:Date.now(),duplicate=false
  const last=tag?await lastTimerOccurrence(tag):0
  if(tag&&at<=last){if(!receivedPush)return true;duplicate=true;at=last}
  if(tag&&self.registration.getNotifications){
   // Also recognize a page fallback that raced a worker handoff/upgrade.
   let existing=[]
   try {existing=await self.registration.getNotifications({tag})}catch{}
   const current=existing.find(notice=>notice.timestamp>=at)
   if(current){
    at=current.timestamp
    if(!receivedPush){await rememberTimerOccurrence(tag,at);return true}
    duplicate=true
    data={...data,title:current.title,body:current.body,url:current.data?.url}
   }
  }
  let prefs={}
  try { const response=await (await caches.open(AUDIO_CACHE)).match(AUDIO_KEY);if(response){const value=await response.json();if(value&&typeof value==='object'&&!Array.isArray(value))prefs=value} }
  catch(error){console.warn('[TGym audio] Cannot read notification preferences',error.message)}
  const minutes=(value,fallback)=>{const valid=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)?value:fallback;const [h,m]=valid.split(':').map(Number);return h*60+m}
  const now=new Date(),cur=now.getHours()*60+now.getMinutes(),start=minutes(prefs.quietStart,'22:00'),end=minutes(prefs.quietEnd,'07:00')
  const quiet=prefs.quietOn&&(start<=end?cur>=start&&cur<end:cur>=start||cur<end)
  const timer=!!tag
  const windows=timer?await self.clients.matchAll({type:'window'}).catch(()=>[]):[]
  const eventSilent=timer?(data.tag==='rest-timer'?prefs.restSilent:prefs.workSilent):prefs.notificationSilent
  // Every actual push must remain user-visible. Refresh its single tagged card
  // silently on a duplicate, rather than triggering a generic browser notice.
  const silent=duplicate||data.silent===true||prefs.enabled===false||quiet||eventSilent||windows.some(client=>client.visibilityState==='visible')
  const text=(value,fallback,max)=>typeof value==='string'&&value.trim()?value.slice(0,max):fallback
  const base=notificationBase(),route=notificationRoute(data)
  const options={body:text(data.body,'',700),icon:new URL('icon-192.png',base).href,badge:new URL('notification-badge.svg',base).href,
   tag:text(data.tag,'tgym',100),silent:!!silent,renotify:!silent,timestamp:at,
   data:{route,url:new URL('./#'+route,base).href}}
  if(!silent&&prefs.vibration!==false)options.vibrate=[180,80,180]
  await self.registration.showNotification(text(data.title,'TGym',150),options)
  if(tag)await rememberTimerOccurrence(tag,at)
  return true
}
self.addEventListener('message',e=>{
 if(!['TGYM_TIMER_NOTICE','TGYM_TIMER_HANDLED'].includes(e.data?.type))return
 const data=e.data.notification,tag=data&&timerTag(data)
 if(!tag||!Number.isFinite(data.timestamp)||data.timestamp<=0)return
 e.waitUntil(queueNotification(async()=>{
  if(e.data.type==='TGYM_TIMER_HANDLED'){
   if(data.timestamp>await lastTimerOccurrence(tag))await rememberTimerOccurrence(tag,data.timestamp)
   return
  }
  let shown=false
  try {shown=await showAppNotification(data)}catch{}
  e.ports?.[0]?.postMessage({shown})
 }))
})
self.addEventListener('push',e=>{
 let data={}
 try {const value=e.data?.json();if(value&&typeof value==='object'&&!Array.isArray(value))data=value}catch{}
 e.waitUntil(queueNotification(()=>showAppNotification(data,true)))
})
self.addEventListener('notificationclick',e=>{
 e.notification.close()
 e.waitUntil((async()=>{
  const base=notificationBase(),route=notificationRoute({...e.notification.data,tag:e.notification.tag}),target=new URL('./#'+route,base)
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true})
  const client=clients.find(client=>{try{const url=new URL(client.url);return url.origin===base.origin&&url.pathname.startsWith(base.pathname)}catch{return false}})
  if(client){
   let navigated=false
   if(typeof client.navigate==='function')try{navigated=!!await client.navigate(target.href)}catch{}
   if(!navigated)client.postMessage?.({type:'TGYM_NOTIFICATION_NAVIGATE',route})
   return client.focus()
  }
  return self.clients.openWindow(target.href)
 })())
})
// Only build assets are cache-first. APIs, update metadata and downloads remain live.
// Navigation uses the installed shell, so fresh HTML cannot reference uncached new chunks.
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url),base=new URL('./',self.location.href)
 if(e.request.method==='GET'&&e.request.destination==='image'&&MEDIA_BASES.some(path=>url.href.startsWith(new URL(path,base).href))){
  e.respondWith((async()=>{
   let cache,hit
   try {cache=await caches.open(MEDIA_CACHE);hit=await cache.match(e.request)}catch{}
   // A poster's CORS request can share a URL with a no-cors animation. Opaque
   // cached responses are usable only for no-cors requests, including fallback.
   if(hit?.type==='opaque'&&e.request.mode!=='no-cors')hit=null
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
