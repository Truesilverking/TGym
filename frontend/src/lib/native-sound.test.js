import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notificationSoundOptions } from './mobile.js'
import { releaseMessages } from '../../scripts/release-message.mjs'

const mocks = vi.hoisted(() => ({android:true,configure:vi.fn(async () => ({channels:{audible:'chosen',muted:'muted',silent:'quiet'},notificationSoundsSupported:true})),play:vi.fn(async()=>({handled:true,played:true})),stop:vi.fn(async()=>{}),prune:vi.fn(async()=>{})}))
vi.mock('@capacitor/core', () => ({Capacitor:{isNativePlatform:()=>mocks.android,getPlatform:()=>mocks.android?'android':'web'},registerPlugin:()=>mocks}))
import { syncNativeSounds, playNativeSound, stopNativeSound } from './native-sound.js'

describe('Android sound bridge', () => {
  beforeEach(() => { mocks.android=true; vi.clearAllMocks() })
  it('passes portable clips and a stable deadline for native deduplication', async () => {
    const S={sound:true,vibration:true,sounds:{rest:'chime'}}
    await playNativeSound(S,'rest',{occurrence:123456})
    expect(mocks.configure.mock.calls[0][0].sounds.rest).toMatchObject({id:'chime'})
    expect(mocks.configure.mock.calls[0][0].sounds.rest.data).toMatch(/^UklGR/)
    expect(mocks.play).toHaveBeenCalledWith({event:'rest',preview:false,occurrence:123456})
    await syncNativeSounds(S)
    expect(mocks.configure).toHaveBeenCalledTimes(1)
    await stopNativeSound(); expect(mocks.stop).toHaveBeenCalledTimes(1)
  })
  it('lets web playback take over when the platform or plugin is unavailable', async () => {
    mocks.android=false
    expect(await playNativeSound({},'set')).toEqual({handled:false,played:false})
    mocks.android=true; mocks.configure.mockRejectedValueOnce(new Error('not available'))
    expect(await playNativeSound({sound:false},'set')).toEqual({handled:false,played:false})
  })
  it('does not start a closed preview when configuration finishes late', async () => {
    let finish
    mocks.configure.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
    const pending = playNativeSound({sounds:{rest:'soft'},accent:'violet'},'rest',{preview:true})
    await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
    await stopNativeSound()
    finish({channels:{audible:'chosen',muted:'muted',silent:'quiet'}})
    expect(await pending).toEqual({handled:true,played:false})
    expect(mocks.play).not.toHaveBeenCalled()
  })
})

describe('notification sound routing', () => {
  const settings={channels:{audible:'chosen',muted:'muted',silent:'quiet'},notificationSoundsSupported:true}
  it('uses the selected channel and silences audio independently of vibration',()=>{
    expect(notificationSoundOptions({},settings)).toEqual({channelId:'chosen'})
    expect(notificationSoundOptions({sound:false},settings)).toEqual({channelId:'muted'})
    expect(notificationSoundOptions({},null)).toEqual({})
    expect(notificationSoundOptions({}, {...settings,notificationSoundsSupported:false})).toEqual({})
  })
  it('applies quiet hours to the delivery time, including midnight boundaries',()=>{
    const S={reminder:{quietOn:true,quietStart:'22:00',quietEnd:'07:00'}}
    expect(notificationSoundOptions(S,settings,new Date('2026-09-24T22:00:00'))).toEqual({channelId:'quiet'})
    expect(notificationSoundOptions(S,settings,new Date('2026-09-25T06:59:00'))).toEqual({channelId:'quiet'})
    expect(notificationSoundOptions(S,settings,new Date('2026-09-25T07:00:00'))).toEqual({channelId:'chosen'})
    S.reminder.quietStart='12:00'; S.reminder.quietEnd='13:00'
    expect(notificationSoundOptions(S,settings,new Date('2026-09-25T12:30:00'))).toEqual({channelId:'quiet'})
  })
  it('keeps old release notifications and sends data-only messages to sound-aware clients',()=>{
    const messages=releaseMessages('1.15.24')
    expect(messages.map(m=>m.topic)).toEqual(['tgym_updates','tgym_updates_v2'])
    expect(messages[0].notification.title).toContain('1.15.24')
    expect(messages[1].notification).toBeUndefined()
    expect(messages[1].data).toEqual({type:'app_update',version:'1.15.24'})
    expect(()=>releaseMessages('broken')).toThrow('Missing or invalid update version')
  })
})
