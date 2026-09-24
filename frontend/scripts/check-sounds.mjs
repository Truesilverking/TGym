import {writeFileSync,mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
import {SOUND_EVENTS,SOUND_PRESETS,soundChoice,soundBytes} from '../src/lib/sound-preferences.js'
const clips=[]
for(const preset of SOUND_PRESETS.filter(x=>x.id!=='silent')) for(const {id:event} of SOUND_EVENTS) {
 const clip=soundChoice({sounds:{[event]:preset.id}},event),bytes=soundBytes(clip.data),pcm=new DataView(bytes.buffer)
 let energy=0,peak=0
 for(let i=44;i<bytes.length;i+=2){const n=pcm.getInt16(i,true)/32768;energy+=n*n;peak=Math.max(peak,Math.abs(n))}
 const rms=Math.sqrt(energy/((bytes.length-44)/2)),duration=(bytes.length-44)/32000
 assert(duration>0&&duration<=5&&Math.abs(duration-clip.duration)<.001)
 assert(peak>.1&&peak<1&&rms>.02,`${preset.id}/${event} is silent or clipped`)
 clips.push({...clip,event})
 console.log(`${preset.id}/${event}: PCM mono 16 kHz, ${duration.toFixed(2)}s, peak ${peak.toFixed(3)}, RMS ${rms.toFixed(3)}`)
}
if(process.argv.includes('--android-fixture')) {
 mkdirSync('android/app/src/androidTest/assets',{recursive:true})
 writeFileSync('android/app/src/androidTest/assets/audio-audit.json',JSON.stringify(clips))
}
console.log(`Validated ${clips.length} preset/event clips; no external audio URLs`)
