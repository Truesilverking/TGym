import { it, expect, vi } from 'vitest'
const native = vi.hoisted(() => ({ platform:'web', setTheme:vi.fn(async()=>{}) }))
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=>native.platform},registerPlugin:()=>({setTheme:native.setTheme})}))
import { syncSystemAppearance } from './system-appearance.js'
it('keeps native system-bar operations out of browser and iOS runtimes',()=>{
  native.setTheme.mockClear()
  for(const platform of ['web','ios']) {native.platform=platform;syncSystemAppearance('light')}
  expect(native.setTheme).not.toHaveBeenCalled()
})
it('passes the resolved Android theme without credentials or profile data',()=>{
  native.platform='android';native.setTheme.mockClear();syncSystemAppearance('light');syncSystemAppearance('dark')
  expect(native.setTheme.mock.calls).toEqual([[{light:true}],[{light:false}]])
})
