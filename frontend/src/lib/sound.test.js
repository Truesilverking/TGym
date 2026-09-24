// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn() }))
vi.mock('./native-sound.js', () => ({ playNativeSound: native.play, stopNativeSound: native.stop }))
let sound, start, stop, decode, haptics, gain, contexts, resume, state
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks()
  native.play.mockResolvedValue({ handled: false }); native.stop.mockResolvedValue()
  start=vi.fn();stop=vi.fn();decode=vi.fn(async()=>({duration:1}));haptics=vi.fn();contexts=[];state='running'
  gain={gain:{value:1},connect:vi.fn(),disconnect:vi.fn()};resume=vi.fn(async()=>{state='running'})
  Object.defineProperty(navigator,'vibrate',{configurable:true,value:haptics})
  vi.stubGlobal('AudioContext',class {
    constructor(){contexts.push(this)}
    get state(){return state};destination={};resume=resume;decodeAudioData=decode
    createGain=()=>gain
    createBufferSource=()=>{this.source={connect:vi.fn(),disconnect:vi.fn(),start,stop};return this.source}
  })
  sound=await import('./sound.js')
})
afterEach(()=>{sound.stopSound();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()})
it('routes all events to actual audio playback',async()=>{
 for(const event of ['rest','work','countdown','set','completion','notification']) expect(await sound.playAppSound({sounds:{[event]:'chime'}},event)).toBe(true)
 expect(start).toHaveBeenCalledTimes(6)
})
it('honors enable/mute/zero volume/event silence for previews and alerts',async()=>{
 for(const preview of [true,false])for(const prefs of [{sound:false},{soundMuted:true},{soundVolume:0},{sounds:{rest:'silent'}}]) expect(await sound.playAppSound({...prefs,vibration:false},'rest',{preview})).toBe(false)
 expect(start).not.toHaveBeenCalled();expect(haptics).not.toHaveBeenCalled()
})
it('previews through media Web Audio without overwriting the Android preference',async()=>{
 native.play.mockResolvedValue({handled:true,played:false})
 const prefs={sounds:{rest:'classic'},soundVolume:.4}
 expect(await sound.playAppSound(prefs,'rest',{preview:true,soundId:'chime'})).toBe(true)
 expect(native.play).not.toHaveBeenCalled();expect(haptics).not.toHaveBeenCalled();expect(gain.gain.value).toBe(.4);expect(prefs.sounds.rest).toBe('classic')
})
it('unlocks synchronously before awaiting the native bridge or decoding',async()=>{
 state='suspended';const pending=sound.playAppSound({},'rest',{preview:true})
 expect(resume).toHaveBeenCalledOnce();expect(decode).not.toHaveBeenCalled();expect(await pending).toBe(true)
})
it('recovers interrupted and closed contexts after a gesture',()=>{
 state='interrupted';sound.primeAudio();expect(resume).toHaveBeenCalledOnce()
 state='closed';sound.primeAudio();expect(contexts).toHaveLength(2)
})
it('reports blocked autoplay without hanging forever',async()=>{
 vi.useFakeTimers();state='suspended';resume.mockImplementation(()=>new Promise(()=>{}))
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
 const pending=sound.playAppSound({},'rest',{preview:true});await vi.advanceTimersByTimeAsync(1600)
 expect(await pending).toBe(false);expect(sound.getSoundPlayback()).toMatchObject({status:'error',error:'audio_blocked'});expect(warn).toHaveBeenCalled();expect(start).not.toHaveBeenCalled()
})
it('does not duplicate native rest alerts or haptics',async()=>{
 native.play.mockResolvedValue({handled:true,played:false});await sound.playAppSound({},'rest',{occurrence:123})
 expect(native.play).toHaveBeenCalledWith({},'rest',{occurrence:123});expect(start).not.toHaveBeenCalled();expect(haptics).not.toHaveBeenCalled()
})
it('stops previous audio immediately and invalidates late decoding',async()=>{
 await sound.playAppSound({},'set',{preview:true})
 let finish;decode.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const pending=sound.playAppSound({},'rest',{preview:true});expect(stop).toHaveBeenCalledOnce()
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));sound.stopSound();finish({duration:1})
 expect(await pending).toBe(false);expect(start).toHaveBeenCalledOnce();expect(sound.getSoundPlayback().status).toBe('idle')
})
it('clears playing feedback on actual completion',async()=>{
 const listener=vi.fn(),unsubscribe=sound.subscribeSound(listener)
 await sound.playAppSound({},'rest',{preview:true});expect(sound.getSoundPlayback().status).toBe('playing')
 contexts[0].source.onended();expect(sound.getSoundPlayback().status).toBe('idle');expect(listener).toHaveBeenCalled();unsubscribe()
})
it('handles decoder rejection without rejecting timer callbacks',async()=>{
 decode.mockRejectedValueOnce(new Error('decoder unavailable'));const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
 expect(await sound.playAppSound({},'rest')).toBe(false);expect(warn).toHaveBeenCalled()
})
it('quiet hours suppress automatic events while allowing deliberate previews',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date(2026,0,1,23))
 const S={reminder:{quietOn:true,quietStart:'22:00',quietEnd:'07:00'}}
 expect(await sound.playAppSound(S,'rest')).toBe(false);expect(await sound.playAppSound(S,'rest',{preview:true})).toBe(true)
})
