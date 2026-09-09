// OAuth service-account JWT grant: no service-account impersonation/IAM token-creator role.
import { createSign } from 'node:crypto'
const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
const project = process.env.FIREBASE_PROJECT_ID
if (!project || !credentials.client_email || !credentials.private_key) throw new Error('Missing Firebase service-account credentials')
if (credentials.project_id !== project) throw new Error('Firebase project and service-account project differ')
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const now = Math.floor(Date.now()/1000)
const unsigned = b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})
const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key,'base64url')
const tokenResponse = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature})})
if(!tokenResponse.ok) throw new Error(`Firebase OAuth failed (HTTP ${tokenResponse.status}); check service-account key and project`)
const {access_token:token}=await tokenResponse.json()
if(!token) throw new Error('Firebase returned no token')
const validate = process.argv.includes('--validate')
const version = (process.env.GITHUB_REF_NAME || '').replace(/^v/,'')
const body={validate_only:validate,message:{topic:'tgym_updates',notification:{title:`TGym ${version} available`,body:'A new TGym update is ready.'},data:{type:'app_update',version},android:{priority:'HIGH',notification:{tag:'tgym-update'}}}}
const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)})
if(!response.ok) {
 const failure=await response.json().catch(()=>({}))
 throw new Error(`FCM HTTP ${response.status}: ${failure.error?.status || 'request rejected'}. Check Firebase Cloud Messaging API and service-account messaging permissions.`)
}
const result=await response.json()
console.log(validate ? 'FCM credentials and message validated (no notification sent)' : `FCM accepted update notification: ${result.name}`)
