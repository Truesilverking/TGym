import { it, expect, vi, beforeEach, afterEach } from 'vitest'
const native = vi.hoisted(() => ({ platform:'web',isNative:false,setTheme:vi.fn(async()=>{}),setGestureExclusion:vi.fn(async()=>{}) }))
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=>native.platform,isNativePlatform:()=>native.isNative},registerPlugin:()=>({setTheme:native.setTheme,setGestureExclusion:native.setGestureExclusion})}))
import { syncSystemAppearance,syncStatsGestureExclusion } from './system-appearance.js'
beforeEach(()=>{native.platform='web';native.isNative=false;vi.clearAllMocks();native.setGestureExclusion.mockResolvedValue(undefined)})
afterEach(()=>vi.restoreAllMocks())
it('keeps native system-bar operations out of browser and iOS runtimes',()=>{
  native.setTheme.mockClear()
  for(const platform of ['web','ios']) {native.platform=platform;syncSystemAppearance('light')}
  expect(native.setTheme).not.toHaveBeenCalled()
})
it('passes the resolved Android theme without credentials or profile data',()=>{
  native.platform='android';native.setTheme.mockClear();syncSystemAppearance('light');syncSystemAppearance('dark')
  expect(native.setTheme.mock.calls).toEqual([[{light:true}],[{light:false}]])
})

const control={left:346,top:350,right:390,bottom:394},viewport={width:390,height:844}
it('keeps gesture exclusions out of web, iOS and nonnative Android shims',()=>{
  for(const [platform,isNative] of [['web',false],['ios',true],['android',false]]){
    native.platform=platform;native.isNative=isNative;syncStatsGestureExclusion(control,viewport);syncStatsGestureExclusion(null)
  }
  expect(native.setGestureExclusion).not.toHaveBeenCalled()
})
it('sends only the exact Android button rectangle and CSS viewport, then clears it explicitly',async()=>{
  native.platform='android';native.isNative=true
  await syncStatsGestureExclusion({...control,privateIgnored:'not transferred'},viewport)
  await syncStatsGestureExclusion(null)
  expect(native.setGestureExclusion.mock.calls).toEqual([
    [{enabled:true,left:346,top:350,right:390,bottom:394,viewportWidth:390,viewportHeight:844}],
    [{enabled:false}],
  ])
})
it('clips to the visible viewport and clears invalid, empty or offscreen rectangles',async()=>{
  native.platform='android';native.isNative=true
  await syncStatsGestureExclusion({...control,right:400},viewport)
  expect(native.setGestureExclusion).toHaveBeenLastCalledWith({enabled:true,...control,viewportWidth:390,viewportHeight:844})
  for(const [rect,view] of [[{...control,left:Infinity},viewport],[{...control,right:346},viewport],[{...control,left:400},viewport],[control,{width:0,height:844}],[control,undefined]]){
    await syncStatsGestureExclusion(rect,view);expect(native.setGestureExclusion).toHaveBeenLastCalledWith({enabled:false})
  }
})
it('tolerates an older native shell rejecting the optional method',async()=>{
  native.platform='android';native.isNative=true
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
  native.setGestureExclusion.mockRejectedValueOnce(new Error('not implemented'))
  await expect(syncStatsGestureExclusion(control,viewport)).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledOnce()
})
