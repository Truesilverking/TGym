// @vitest-environment happy-dom
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {useUI} from './useUI.js'
import {useStore,DEF} from './useStore.js'
import {playAppSound} from '../lib/sound.js'
import {bindUI} from '../components/ui.jsx'
import {doFinishWorkout} from '../sheets.jsx'
vi.mock('../lib/sound.js',()=>({playAppSound:vi.fn(),vibrate:vi.fn()}))
vi.mock('../lib/api.js',()=>({api:vi.fn(async()=>({}))}))
beforeEach(()=>{vi.useFakeTimers();localStorage.clear();useStore.setState({S:structuredClone(DEF),user:null});useUI.setState({timer:null,work:null,sheets:[]});playAppSound.mockClear();bindUI(useUI)})
afterEach(()=>{useUI.getState().stopRest();useUI.getState().stopWork();vi.clearAllTimers();vi.useRealTimers()})
it('rest emits three countdowns then the selected finish sound once',()=>{
 useStore.getState().update(s=>{s.sounds.rest='pulse';s.sounds.countdown='soft'})
 useUI.getState().startRest(4);vi.advanceTimersByTime(4000)
 expect(playAppSound.mock.calls.map(([,event])=>event)).toEqual(['countdown','countdown','countdown','rest'])
 expect(playAppSound.mock.calls.at(-1)[0].sounds.rest).toBe('pulse')
 document.dispatchEvent(new Event('visibilitychange'));expect(playAppSound).toHaveBeenCalledTimes(4)
})
it('finishing the workout triggers its own configured completion sound',()=>{
 useStore.getState().update(s=>{s.sounds.completion='chime';s.active={id:'audio',d:'2026-09-24',start:Date.now()-60000,entries:[{id:'test',sets:[{w:20,r:10,done:true}]}]}})
 doFinishWorkout()
 expect(useStore.getState().S.active).toBe(null)
 expect(playAppSound).toHaveBeenCalledWith(expect.objectContaining({sounds:expect.objectContaining({completion:'chime'})}),'completion')
})
