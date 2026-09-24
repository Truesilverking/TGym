// Existing installations still need the notification payload until they migrate
// subscriptions. New clients render data-only messages with their saved sounds.
export function releaseMessages(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Missing or invalid update version')
  const data = {type:'app_update',version}
  return [
    {topic:'tgym_updates',notification:{title:`TGym ${version} available`,body:'A new TGym update is ready.'},data,android:{priority:'HIGH',notification:{channel_id:'tgym_updates',tag:'tgym-update'}}},
    {topic:'tgym_updates_v2',data,android:{priority:'HIGH',collapse_key:'tgym-update',ttl:'86400s'}},
  ]
}
