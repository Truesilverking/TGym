import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createWithings } from './withings.js'

const directories = []
afterEach(() => { for (const directory of directories.splice(0)) { const target=path.resolve(directory); assert(target.startsWith(path.resolve(os.tmpdir())+path.sep)); assert(path.basename(target).startsWith('tgym-withings-test-')); fs.rmSync(target,{recursive:true,force:true}) } })
const ok = body => new Response(JSON.stringify({status:0,body}),{status:200})
const token = (access='synthetic-access',refresh='synthetic-refresh') => ({userid:42,access_token:access,refresh_token:refresh,expires_in:10800,scope:'user.metrics'})
function fixture(fetcher) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tgym-withings-test-')); directories.push(directory)
  const calls=[], clock={now:Date.parse('2026-11-04T12:00:00Z')}
  const config={directory,secret:'synthetic-test-secret',clientId:'synthetic-client',clientSecret:'synthetic-secret',redirectUri:'https://gym.invalid/api/withings/callback',now:()=>clock.now,fetcher:async (url,options)=>{const request={url,options,params:Object.fromEntries(options.body)};calls.push(request);return fetcher?fetcher(request,calls.length):ok(token())}}
  return {provider:createWithings(config),config,directory,calls,clock}
}
const authorize=async (provider,uid='local-user')=>{const {url}=provider.start(uid);const state=new URL(url).searchParams.get('state');await provider.callback(new URLSearchParams({state,code:'synthetic-code'}));return state}

test('requires HTTPS registered callback configuration and never returns credentials',()=>{
  const f=fixture();assert.deepEqual(f.provider.status('local-user'),{configured:true,connected:false})
  const next=createWithings({...f.config,redirectUri:'http://gym.invalid/api/withings/callback'})
  assert.equal(next.status('local-user').configured,false);assert.throws(()=>next.start('local-user'),{code:'withings-not-configured'})
  assert.equal(createWithings({...f.config,clientSecret:''}).status('local-user').configured,false)
})
test('uses read-only scope, secret server exchange, encrypted persisted tokens and single-use state',async()=>{
  const f=fixture(), {url}=f.provider.start('local-user'), parsed=new URL(url), state=parsed.searchParams.get('state')
  assert.equal(parsed.origin,'https://account.withings.com');assert.equal(parsed.searchParams.get('scope'),'user.metrics');assert(!url.includes('synthetic-secret'))
  await f.provider.callback(new URLSearchParams({state,code:'synthetic-code'}))
  assert.deepEqual(f.calls[0].params,{action:'requesttoken',grant_type:'authorization_code',client_id:'synthetic-client',client_secret:'synthetic-secret',redirect_uri:f.config.redirectUri,code:'synthetic-code'})
  assert.equal(f.provider.status('local-user').connected,true)
  const vault=fs.readFileSync(path.join(f.directory,'withings.enc'),'utf8');assert(!vault.includes('synthetic-access'));assert(!vault.includes('synthetic-refresh'));assert(!vault.includes('local-user'))
  assert.equal(createWithings(f.config).status('local-user').connected,true)
  await assert.rejects(f.provider.callback(new URLSearchParams({state,code:'again'})),{code:'withings-authorization-failed'});assert.equal(f.calls.length,1)
})
test('rejects unknown, expired, denied and superseded state without requesting tokens',async()=>{
  const f=fixture(), first=new URL(f.provider.start('local-user').url).searchParams.get('state'), second=new URL(f.provider.start('local-user').url).searchParams.get('state')
  for(const state of ['unknown',first])await assert.rejects(f.provider.callback(new URLSearchParams({state,code:'x'})),{code:'withings-authorization-failed'})
  f.clock.now+=10*60000;await assert.rejects(f.provider.callback(new URLSearchParams({state:second,code:'x'})),{code:'withings-authorization-failed'})
  const denied=new URL(f.provider.start('local-user').url).searchParams.get('state');await assert.rejects(f.provider.callback(new URLSearchParams({state:denied,error:'access_denied'})),{code:'withings-authorization-failed'})
  assert.equal(f.calls.length,0)
})
test('rejects malformed token payloads without committing an account',async()=>{
  const f=fixture(()=>ok({...token(),expires_in:0}));await assert.rejects(authorize(f.provider),{code:'withings-invalid-token'});assert.equal(f.provider.status('local-user').connected,false)
  assert(!fs.existsSync(path.join(f.directory,'withings.enc')))
})
test('returns only supported measure fields across bounded pages with a conservative sync cursor',async()=>{
  const f=fixture(req=>{
    if(req.params.action==='requesttoken')return ok(token())
    const more=req.params.offset==='0';return ok({measuregrps:[{grpid:more?1:2,date:1793786400,category:1,private:'omit',measures:[{type:1,value:70000,unit:-3},{type:99,value:1,unit:0},{type:6,value:2000,unit:-2}]}],more:more?1:0,offset:100})
  });await authorize(f.provider)
  const started=f.clock.now;const result=await f.provider.measures('local-user',started-3600000)
  assert.equal(result.records.length,2);assert.equal(result.fetchedAt,started);assert.equal(result.records[0].measures.length,2);assert(!('private' in result.records[0]))
  assert.equal(f.calls[1].params.lastupdate,String(Math.floor((started-3600000)/1000)-86400));assert.equal(f.calls[2].params.offset,'100')
  assert.equal(f.calls[1].options.headers.Authorization,'Bearer synthetic-access');assert.equal(f.calls[1].options.redirect,'error')
})
test('refreshes expired access once and persists the rotated refresh token before fetching measurements',async()=>{
  const f=fixture(req=>req.params.action==='requesttoken'?ok(token(req.params.grant_type==='refresh_token'?'rotated-access':'synthetic-access',req.params.grant_type==='refresh_token'?'rotated-refresh':'synthetic-refresh')):ok({measuregrps:[],more:0}))
  await authorize(f.provider);f.clock.now+=10800*1000
  await f.provider.measures('local-user');assert.equal(f.calls[1].params.refresh_token,'synthetic-refresh');assert.equal(f.calls[2].options.headers.Authorization,'Bearer rotated-access')
  const restarted=createWithings(f.config);f.clock.now+=10800*1000;await restarted.measures('local-user');assert.equal(f.calls[3].params.refresh_token,'rotated-refresh')
})
test('refreshes a rejected access token once and refuses an endless 401 retry',async()=>{
  const f=fixture(req=>req.params.action==='requesttoken'?ok(token()):new Response(JSON.stringify({status:401}),{status:401}));await authorize(f.provider)
  await assert.rejects(f.provider.measures('local-user'),{code:'withings-reconnect'});assert.equal(f.calls.length,4)
})
test('isolates accounts and refuses a refresh returning another Withings identity',async()=>{
  const f=fixture(req=>ok(req.params.grant_type==='refresh_token'?{...token(),userid:999}:token()));await authorize(f.provider)
  await assert.rejects(f.provider.measures('other-user'),{code:'withings-reconnect'});f.clock.now+=10800*1000
  await assert.rejects(f.provider.measures('local-user'),{code:'withings-account-mismatch'})
})
test('refuses malformed pagination and does not return partial history as success',async()=>{
  const f=fixture(req=>req.params.action==='requesttoken'?ok(token()):ok({measuregrps:[],more:1,offset:0}));await authorize(f.provider)
  await assert.rejects(f.provider.measures('local-user'),{code:'withings-invalid-pagination'})
})
test('coalesces concurrent reads and disconnect waits for their completion without retaining authorization',async()=>{
  let finish;const f=fixture(req=>req.params.action==='requesttoken'?ok(token()):new Promise(resolve=>{finish=()=>resolve(ok({measuregrps:[],more:0}))}));await authorize(f.provider)
  const a=f.provider.measures('local-user'),b=f.provider.measures('local-user');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,2)
  const disconnected=f.provider.disconnect('local-user');finish();assert.deepEqual(await a,await b);await disconnected
  assert.equal(f.provider.status('local-user').connected,false);assert.equal(createWithings(f.config).status('local-user').connected,false)
})
test('disconnect blocks new reads and authorization while waiting, coalesces repeated requests and permits reconnect only after deletion',async()=>{
  let finish;const f=fixture(req=>req.params.action==='requesttoken'?ok(token()):new Promise(resolve=>{finish=()=>resolve(ok({measuregrps:[],more:0}))}));await authorize(f.provider)
  const read=f.provider.measures('local-user');await new Promise(resolve=>setImmediate(resolve))
  const a=f.provider.disconnect('local-user'),b=f.provider.disconnect('local-user')
  assert.throws(()=>f.provider.start('local-user'),{code:'withings-busy'})
  await assert.rejects(f.provider.measures('local-user'),{code:'withings-busy'})
  finish();await read;await Promise.all([a,b]);assert.equal(f.provider.status('local-user').connected,false)
  await authorize(f.provider);assert.equal(f.provider.status('local-user').connected,true)
  await f.provider.disconnect('local-user');assert.equal(f.provider.status('local-user').connected,false)
})
test('vault corruption fails closed for Withings while keeping the rest of the API usable',async()=>{
  const f=fixture();await authorize(f.provider);fs.writeFileSync(path.join(f.directory,'withings.enc'),'malformed')
  const blocked=createWithings(f.config)
  assert.deepEqual(blocked.status('local-user'),{configured:true,connected:false,available:false})
  assert.throws(()=>blocked.start('local-user'),{code:'withings-vault-unreadable'})
  await assert.rejects(blocked.disconnect('local-user'),{code:'withings-vault-unreadable'})
  assert.equal(fs.readFileSync(path.join(f.directory,'withings.enc'),'utf8'),'malformed')
})
