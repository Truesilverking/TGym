import { api } from './api.js'
import { browserNotificationsSupported } from './browser-notifications.js'

async function currentSubscription() {
  if (!browserNotificationsSupported() || Notification.permission !== 'granted' || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker?.getRegistration?.()
  return registration?.pushManager?.getSubscription?.() || null
}

export function createTimerPushClient(getUser, { send = api, subscription = currentSubscription } = {}) {
  const states = { rest:{revision:0,queue:Promise.resolve(),owner:null}, work:{revision:0,queue:Promise.resolve(),owner:null} }
  return (kind, seconds = null, endsAt = null) => {
    const state=states[kind],owner=getUser()?.id
    if(!state)return Promise.resolve(false)
    const ticket=++state.revision
    if(!owner)return Promise.resolve(false)
    const cancel=seconds===null
    state.queue=state.queue.catch(()=>false).then(async()=>{
      if(ticket!==state.revision||getUser()?.id!==owner)return false
      if(cancel){
        if(state.owner!==owner)return false
        await send(`/api/push/${kind}-timer/cancel`,{method:'POST',body:'{}'})
        state.owner=null;return true
      }
      if(!Number.isFinite(seconds)||seconds<=0||seconds>3600||!await subscription())return false
      // A cancellation/account switch may have occurred during subscription IO.
      if(ticket!==state.revision||getUser()?.id!==owner)return false
      if(endsAt!==null&&(!Number.isFinite(endsAt)||endsAt<=Date.now()))return false
      state.owner=owner
      await send(`/api/push/${kind}-timer`,{method:'POST',body:JSON.stringify({seconds,...(endsAt!==null?{endsAt}:{})})})
      return true
    }).catch(()=>false)
    return state.queue
  }
}
