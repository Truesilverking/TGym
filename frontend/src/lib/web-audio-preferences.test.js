import {expect,it} from 'vitest'
import {webAudioPreferences} from './web-audio-preferences.js'
it('mirrors independent notification mute, timer choices and vibration without profile or audio data',()=>{
 const S={notificationSoundOn:false,vibration:false,sounds:{rest:'silent',work:'chime'},customSounds:[{data:'private'}],profile:{name:'private'},workouts:[{id:'private'}]}
 expect(webAudioPreferences(S)).toEqual({enabled:true,notificationSilent:true,restSilent:true,workSilent:false,vibration:false,quietOn:false,quietStart:undefined,quietEnd:undefined})
 expect(JSON.stringify(webAudioPreferences(S))).not.toContain('private')
 expect(webAudioPreferences({...S,notificationSoundOn:true,sounds:{notification:'silent'}}).notificationSilent).toBe(true)
})
