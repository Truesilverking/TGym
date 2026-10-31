// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Media, { Thumb } from './Media.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { setLang } from '../lib/i18n.js'

let host, root, media
const exercise = { id: 'qa', n: 'QA exercise', img: 'still.jpg', gif: 'motion.gif' }
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  media = new EventTarget(); media.matches = false
  vi.spyOn(window, 'matchMedia').mockReturnValue(media)
  useStore.setState({ S: { ...structuredClone(DEF), lang: 'en' } })
  await setLang('en')
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks();vi.unstubAllGlobals() })
const mount = () => act(() => root.render(<Media ex={exercise} minimizable />))
const src = () => host.querySelector('img').getAttribute('src')

it.each([
 ['a JPEG-only custom exercise',{id:'synthetic-front-plank',custom:true,n:'Front Plank',bp:'waist',img:'data:image/jpeg;base64,c3ludGhldGljLWpwZWc='}],
 ['an unmatched custom exercise without media',{id:'synthetic-unmatched',custom:true,n:'Unmatched custom exercise',bp:'waist'}],
])('does not request a GIF poster for %s',(_,ex)=>{
 const constructed=vi.fn(),sources=[],before=structuredClone(useStore.getState().S),original=structuredClone(ex)
 const raw=JSON.stringify(before);localStorage.setItem('gym_state_v1',raw)
 vi.stubGlobal('Image',class {
  constructor(){constructed()}
  set src(value){sources.push(value);this.onerror?.()}
 })
 act(()=>root.render(<Media ex={ex}/>))
 expect(constructed).not.toHaveBeenCalled();expect(sources).toEqual([])
 expect(host.querySelector('.media-playback')).toBeNull()
 if(ex.img)expect(src()).toBe(ex.img)
 else expect(host.childElementCount).toBe(0)
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(raw);expect(ex).toEqual(original)
})

it('shows a bundled custom exercise GIF and still thumbnail without writing artwork into the profile',()=>{
 const ex={id:'kept-custom',custom:true,n:'Walking',bp:'cardio'},before=structuredClone(useStore.getState().S)
 const raw=JSON.stringify(before);localStorage.setItem('gym_state_v1',raw)
 act(()=>root.render(<><Media ex={ex}/><Thumb ex={ex}/></>))
 expect(host.querySelector('.exmedia img').getAttribute('src')).toContain('walking-flat-ground.gif')
 expect(host.querySelector('img.thumb').getAttribute('src')).toContain('walking-flat-ground-poster.png')
 act(()=>host.querySelector('[aria-label="Pause animation"]').click())
 expect(host.querySelector('.exmedia img').getAttribute('src')).toContain('walking-flat-ground-poster.png')
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(raw)
 expect(ex).toEqual({id:'kept-custom',custom:true,n:'Walking',bp:'cardio'})
})

it('starts bundled custom media on its supplied still poster when motion is reduced',()=>{
 useStore.setState({S:{...useStore.getState().S,reduceMotion:true}})
 act(()=>root.render(<Media ex={{id:'kept-custom',custom:true,n:'Nordic Hold',bp:'upper legs'}}/>))
 expect(src()).toContain('nordic-hold-poster.png')
 act(()=>host.querySelector('[aria-label="Play animation"]').click())
 expect(src()).toContain('nordic-hold.gif')
})

it.each(['app', 'system'])('starts with a still image for %s reduced motion and permits explicit playback', source => {
  if (source === 'app') useStore.setState({ S: { ...useStore.getState().S, reduceMotion: true } })
  else media.matches = true
  mount()
  expect(src()).toContain('still.jpg')
  const play = host.querySelector('button[aria-label="Play animation"]')
  expect(play).not.toBeNull()
  act(() => play.click())
  expect(src()).toContain('motion.gif')
  act(() => host.querySelector('button[aria-label="Pause animation"]').click())
  expect(src()).toContain('still.jpg')
})

it('responds to an operating-system motion preference change while mounted', () => {
  mount(); expect(src()).toContain('motion.gif')
  act(() => { media.matches = true; media.dispatchEvent(new Event('change')) })
  expect(src()).toContain('still.jpg')
})

it('keeps minimize separate from playback', () => {
  mount()
  act(() => host.querySelector('.giftoggle').click())
  expect(src()).toContain('motion.gif')
  expect(useStore.getState().S.gifSize).toBe('mini')
})

it.each(['app', 'system'])('does not autoplay an uploaded GIF or thumbnail under %s reduced motion', source => {
  if (source === 'app') useStore.setState({ S: { ...useStore.getState().S, reduceMotion: true } })
  else media.matches = true
  const custom = { id: 'custom', n: 'Custom animation', img: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' }
  act(() => root.render(<><Media ex={custom} /><Thumb ex={custom} /></>))
  expect(host.querySelector('img[src^="data:image/gif"]')).toBeNull()
  act(() => host.querySelector('button[aria-label="Play animation"]').click())
  expect(host.querySelectorAll('img[src^="data:image/gif"]')).toHaveLength(1)
  act(() => host.querySelector('button[aria-label="Pause animation"]').click())
  expect(host.querySelector('img[src^="data:image/gif"]')).toBeNull()
})

it('replaces unavailable media with an accessible placeholder and retries on reconnect',()=>{
 mount();act(()=>host.querySelector('img').dispatchEvent(new Event('error')))
 expect(host.querySelector('img')).toBeNull()
 expect(host.querySelector('[role="img"]').getAttribute('aria-label')).toBe('QA exercise')
 act(()=>window.dispatchEvent(new Event('online')))
 expect(src()).toContain('motion.gif')
})

it('renders normal-motion custom thumbnails at original quality without offscreen decoding or PNG encoding',()=>{
 const image=vi.fn(),create=vi.spyOn(document,'createElement'),encode=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL')
 vi.stubGlobal('Image',image)
 const custom={id:'custom-thumb',n:'Custom animation',img:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='}
 act(()=>root.render(<Thumb ex={custom}/>))
 expect(src()).toBe(custom.img);expect(image).not.toHaveBeenCalled()
 expect(create.mock.calls.some(([tag])=>tag==='canvas')).toBe(false);expect(encode).not.toHaveBeenCalled()
})

it('creates a static poster only when reduced motion needs it and refreshes it for another exercise',()=>{
 const images=[],draw=vi.fn(),encode=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/png;base64,cG9zdGVy')
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:draw})
 vi.stubGlobal('Image',class {constructor(){this.naturalWidth=720;this.naturalHeight=1024;images.push(this)}})
 const custom={id:'custom-thumb',n:'Custom animation',img:'data:image/webp;base64,YQ=='}
 act(()=>root.render(<Thumb ex={custom}/>))
 expect(images).toHaveLength(0);expect(src()).toBe(custom.img)
 act(()=>useStore.setState({S:{...useStore.getState().S,reduceMotion:true}}))
 expect(images).toHaveLength(1);expect(host.querySelector('img')).toBeNull()
 act(()=>images[0].onload())
 expect(src()).toBe('data:image/png;base64,cG9zdGVy');expect(draw).toHaveBeenCalledWith(images[0],0,0,720,1024);expect(encode).toHaveBeenCalledOnce()
 act(()=>root.render(<Thumb ex={{...custom,id:'another',img:'data:image/gif;base64,Yg=='}}/>))
 expect(images).toHaveLength(2);expect(host.querySelector('img')).toBeNull()
 act(()=>images[1].onload());expect(host.querySelector('img')).not.toBeNull()
 act(()=>useStore.setState({S:{...useStore.getState().S,reduceMotion:false}}))
 expect(src()).toBe('data:image/gif;base64,Yg==');expect(images).toHaveLength(2)
})

const customPoster=(name,img=`data:image/gif;base64,${name}`)=>({id:name,n:name,img})
function posterDecoder(png='data:image/png;base64,cG9zdGVy'){
 const images=[],canvases=[],draw=vi.fn()
 const encode=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockImplementation(function(){canvases.push({width:this.width,height:this.height});return png})
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:draw})
 vi.stubGlobal('Image',class {constructor(){this.naturalWidth=1440;this.naturalHeight=2048;images.push(this)}})
 useStore.setState({S:{...useStore.getState().S,reduceMotion:true}})
 return {images,canvases,draw,encode}
}
const renderThumb=ex=>act(()=>root.render(<Thumb ex={ex}/>))
const clearView=()=>act(()=>root.render(null))

it('shares one full-quality poster for simultaneous consumers and reuses it through reduced-motion remounts',()=>{
 const decoder=posterDecoder(),ex=customPoster('poster-concurrent-remount')
 const state=useStore.getState().S,save=vi.spyOn(Storage.prototype,'setItem')
 act(()=>root.render(<React.StrictMode><Media ex={ex}/><Thumb ex={{...ex,id:'same-source-other-id'}}/></React.StrictMode>))
 expect(decoder.images).toHaveLength(1)
 act(()=>decoder.images[0].onload())
 expect(decoder.encode).toHaveBeenCalledOnce();expect(decoder.canvases).toEqual([{width:720,height:1024}])
 expect(host.querySelectorAll('img[src^="data:image/png"]')).toHaveLength(2)
 clearView();act(()=>root.render(<><Media ex={ex}/><Thumb ex={ex}/></>))
 expect(decoder.images).toHaveLength(1);expect(decoder.encode).toHaveBeenCalledOnce()
 expect(host.querySelectorAll('img[src^="data:image/png"]')).toHaveLength(2)
 act(()=>host.querySelector('button[aria-label="Play animation"]').click())
 expect(host.querySelector('img[src^="data:image/gif"]').getAttribute('src')).toBe(ex.img)
 act(()=>host.querySelector('button[aria-label="Pause animation"]').click())
 expect(host.querySelectorAll('img[src^="data:image/png"]')).toHaveLength(2)
 expect(useStore.getState().S).toBe(state);expect(save).not.toHaveBeenCalled()
})

it('keeps a decoded catalogue poster when pausing and preserves the original GIF for playback',()=>{
 const decoder=posterDecoder(),ex={id:'poster-catalogue-pause',n:'Catalogue',img:'poster-catalogue.jpg',gif:'poster-catalogue.gif'}
 useStore.setState({S:{...useStore.getState().S,reduceMotion:false}})
 act(()=>root.render(<Media ex={ex}/>));expect(src()).toContain(ex.gif)
 act(()=>decoder.images[0].onload())
 act(()=>host.querySelector('button[aria-label="Pause animation"]').click())
 expect(src()).toBe('data:image/png;base64,cG9zdGVy');expect(decoder.images).toHaveLength(1)
 act(()=>host.querySelector('button[aria-label="Play animation"]').click())
 expect(src()).toContain(ex.gif);expect(decoder.images).toHaveLength(1)
})

it('invalidates an edited image with the same exercise ID and ignores obsolete pending results',()=>{
 const decoder=posterDecoder(),ex=customPoster('poster-edited-original')
 renderThumb(ex);act(()=>decoder.images[0].onload());expect(host.querySelector('img')).not.toBeNull()
 renderThumb({...ex,img:'data:image/webp;base64,poster-edited-second'})
 expect(host.querySelector('img')).toBeNull();expect(decoder.images).toHaveLength(2)
 renderThumb({...ex,img:'data:image/gif;base64,poster-edited-third'})
 act(()=>decoder.images[1].onload())
 expect(host.querySelector('img')).toBeNull()
 act(()=>decoder.images[2].onload())
 expect(host.querySelector('img')).not.toBeNull();expect(decoder.encode).toHaveBeenCalledTimes(3)
})

it('does not retain failed loads or encodes and retries them on a later mount',()=>{
 const decoder=posterDecoder(),ex=customPoster('poster-failure-retry')
 renderThumb(ex);act(()=>decoder.images[0].onerror())
 expect(host.querySelector('img')).toBeNull()
 clearView();renderThumb(ex);expect(decoder.images).toHaveLength(2)
 decoder.encode.mockImplementationOnce(()=>{throw new Error('tainted canvas')})
 act(()=>decoder.images[1].onload());expect(host.querySelector('img')).toBeNull()
 clearView();renderThumb(ex);expect(decoder.images).toHaveLength(3)
 act(()=>decoder.images[2].onload());expect(host.querySelector('img')).not.toBeNull()
 clearView();renderThumb(ex);expect(decoder.images).toHaveLength(3)
})

it('finishes an unsubscribed decode without setting unmounted state and reuses its result',()=>{
 const decoder=posterDecoder(),ex=customPoster('poster-unmounted-reuse'),errors=vi.spyOn(console,'error').mockImplementation(()=>{})
 renderThumb(ex);clearView()
 act(()=>decoder.images[0].onload())
 expect(host.childElementCount).toBe(0);expect(errors).not.toHaveBeenCalled()
 renderThumb(ex);expect(decoder.images).toHaveLength(1);expect(host.querySelector('img')).not.toBeNull()
})

it('evicts least recently used posters beyond 24 entries while retaining a recently used source',()=>{
 const decoder=posterDecoder(),exercises=Array.from({length:25},(_,index)=>customPoster('poster-limit-'+index))
 for(let index=0;index<24;index++){renderThumb(exercises[index]);act(()=>decoder.images.at(-1).onload())}
 renderThumb(exercises[0]) // Source 0 is now newer than source 1.
 renderThumb(exercises[24]);act(()=>decoder.images.at(-1).onload());expect(decoder.images).toHaveLength(25)
 renderThumb(exercises[0]);expect(decoder.images).toHaveLength(25)
 renderThumb(exercises[1]);expect(decoder.images).toHaveLength(26)
})

it('bounds retained encoded bytes and leaves oversized posters uncached',()=>{
 const large='data:image/png;base64,'+'A'.repeat(9*1024*1024),decoder=posterDecoder(large)
 const first=customPoster('poster-byte-first'),second=customPoster('poster-byte-second')
 renderThumb(first);act(()=>decoder.images.at(-1).onload())
 renderThumb(second);act(()=>decoder.images.at(-1).onload())
 renderThumb(first);expect(decoder.images).toHaveLength(3) // Two 18 MiB strings exceed the 32 MiB cap.
 act(()=>decoder.images.at(-1).onload());clearView()
 const oversized=customPoster('poster-byte-oversized')
 decoder.encode.mockReturnValue('data:image/png;base64,'+'B'.repeat(17*1024*1024))
 renderThumb(oversized);act(()=>decoder.images.at(-1).onload());expect(host.querySelector('img')).not.toBeNull()
 clearView();renderThumb(oversized);expect(decoder.images).toHaveLength(5)
})
