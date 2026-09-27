import { useEffect, useState } from 'react'
import { MOBILE } from '../lib/mobile.js'
import { t } from '../lib/i18n.js'
import { activatePwaUpdate } from '../lib/app-update.js'

// Visible installation state; never promise offline readiness until every shell asset exists.
export default function OfflineStatus() {
 const [online,setOnline]=useState(navigator.onLine!==false),[status,setStatus]=useState('checking'),[attempt,setAttempt]=useState(0)
 useEffect(()=>{const change=()=>setOnline(navigator.onLine!==false);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change)}},[])
 useEffect(()=>{
  if(MOBILE||import.meta.env.DEV)return
  let gone=false,timer,channel,reg,installing
  const check=()=>{
   if(!reg?.active)return
   clearTimeout(timer);channel?.port1.close();channel=new MessageChannel()
   timer=setTimeout(()=>{if(!gone)setStatus('error');channel.port1.close()},attempt?30000:6000)
   channel.port1.onmessage=e=>{
    clearTimeout(timer);channel.port1.close()
    if(gone)return
    if(e.data?.update){void activatePwaUpdate(reg,navigator.serviceWorker,()=>location.reload()).catch(()=>{if(!gone)setStatus('error')});return}
    setStatus(e.data?.ready?'ready':'error')
   }
   reg.active.postMessage({type:attempt?'REPAIR_OFFLINE':'OFFLINE_STATUS'},[channel.port2])
  }
  const changed=()=>{if(installing?.state==='activated')check();else if(installing?.state==='redundant'&&!gone)setStatus('error')}
  const found=()=>{installing?.removeEventListener('statechange',changed);installing=reg.installing;installing?.addEventListener('statechange',changed)}
  if(!window.isSecureContext||!navigator.serviceWorker){setStatus('unsupported');return}
  setStatus('checking')
  timer=setTimeout(()=>{if(!gone)setStatus('error')},15000)
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{
   if(gone)return
   reg=r;reg.addEventListener('updatefound',found);found();check()
   if(attempt)void reg.update().catch(()=>{if(!gone)setStatus('error')})
  }).catch(()=>{if(!gone)setStatus('error')})
  return()=>{gone=true;clearTimeout(timer);channel?.port1.close();reg?.removeEventListener('updatefound',found);installing?.removeEventListener('statechange',changed)}
 },[attempt,online])
 if(MOBILE||import.meta.env.DEV)return null
 if(online&&status==='ready')return null
 return <aside className="offline-status" role="status">
  <span>{!online&&status==='ready'?t('Offline. Server actions need a connection.'):status==='checking'?t('Preparing offline access...'):t('Offline access is not ready. Connect and retry before closing TGym.')}</span>
  {online&&status!=='checking'&&status!=='unsupported'&&<button className="btn sm" onClick={()=>setAttempt(n=>n+1)}>{t('Retry')}</button>}
 </aside>
}
