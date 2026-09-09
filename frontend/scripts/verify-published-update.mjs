import { readFileSync } from 'node:fs'
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version
const [owner, repo] = process.env.REPOSITORY.split('/')
const url = `https://${owner.toLowerCase()}.github.io/${repo}/updates/latest.json`
let passed = false
for (let i=0; i<12; i++) {
  try {
    const response=await fetch(`${url}?verify=${Date.now()}`)
    if(!response.ok) throw new Error(`Manifest HTTP ${response.status}`)
    const data=await response.json()
    if(data.version!==version) throw new Error(`Published ${data.version}, expected ${version}`)
    const apk=await fetch(data.android.apk,{method:'HEAD'})
    if(!apk.ok) throw new Error(`APK HTTP ${apk.status}`)
    console.log(`Verified published ${version} and APK availability`); passed=true;break
  } catch(error) { console.log(error.message); await new Promise(r=>setTimeout(r,10000)) }
}
if(!passed) throw new Error('Published update verification failed; notification must not be sent')
