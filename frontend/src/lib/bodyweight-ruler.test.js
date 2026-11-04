import {expect,it} from 'vitest'
import {RULER_PIXELS_PER_UNIT,rulerReleaseVelocity,rulerCoast,rulerCoastDuration,rulerPixelsPerUnit,snapRulerValue} from './bodyweight-ruler.js'

const release = speed => rulerReleaseVelocity([{x:0,t:0},{x:-speed*100,t:100}],100)

it.each([.000001,.25,2.5,5])('keeps a ten-pixel tick and monotonic coast on the caller grid %s',step=>{
 expect(rulerPixelsPerUnit(step)*step).toBeCloseTo(10,10)
 const duration=rulerCoastDuration(1.2),start=40,finish=rulerCoast(start,1.2,duration,0,Number.MAX_SAFE_INTEGER,step)
 expect(finish.done).toBe(true);expect(finish.shown).toBeGreaterThanOrEqual(start)
 expect(snapRulerValue(finish.shown,step)).toBe(finish.shown)
 const almost=rulerCoast(start,1.2,duration-1,0,Number.MAX_SAFE_INTEGER,step)
 expect(almost.shown).toBeLessThanOrEqual(finish.shown)
 expect(finish.shown-almost.shown).toBeLessThan(step*.001)
 expect(rulerCoast(0,-1,20,0,Number.MAX_SAFE_INTEGER,step)).toEqual({shown:0,done:true})
})

it('uses recent samples in timestamp order without changing the recorded gesture',()=>{
 const samples=[{x:0,t:200},{x:200,t:0},{x:100,t:110},{x:NaN,t:115},{x:150,t:60}]
 const original=samples.map(sample=>({...sample}))
 expect(rulerReleaseVelocity(samples,120)).toBe(1)
 expect(rulerReleaseVelocity([{x:100,t:0},{x:120,t:40}],40)).toBe(-.5)
 expect(samples).toEqual(original)
 expect(RULER_PIXELS_PER_UNIT).toBe(100)
})

it('does not turn taps, slow drags, short samples or a held release into a flick',()=>{
 expect(rulerReleaseVelocity([{x:100,t:0}],0)).toBe(0)
 expect(rulerReleaseVelocity([{x:100,t:0},{x:99,t:30}],30)).toBe(0)
 expect(rulerReleaseVelocity([{x:100,t:0},{x:90,t:10}],10)).toBe(0)
 expect(rulerReleaseVelocity([{x:100,t:100},{x:80,t:120}],200)).toBe(0)
 expect(release(.279)).toBe(0)
 expect(release(.28)).toBe(.28)
})

it('preserves ordinary impulse strength and approaches a wider speed cap smoothly',()=>{
 expect(release(.45)).toBe(.45)
 expect(release(1.2)).toBe(1.2)
 expect(release(1.20001)-release(1.2)).toBeCloseTo(.00001,8)
 const stronger=release(2.4),extreme=release(20)
 expect(stronger).toBeGreaterThan(1.2)
 expect(extreme).toBeGreaterThan(stronger)
 expect(extreme).toBeLessThanOrEqual(2.4)
 expect(release(-2.4)).toBe(-stronger)
})

it('gives stronger impulses more travel and a longer, bounded natural stop',()=>{
 const gentle=rulerCoastDuration(.45),strong=rulerCoastDuration(1.2),maximum=rulerCoastDuration(2.4)
 expect(gentle).toBeGreaterThan(720)
 expect(strong).toBeGreaterThan(gentle)
 expect(maximum).toBeGreaterThan(strong)
 expect(maximum).toBeLessThanOrEqual(1800)
 expect(rulerCoastDuration(-1.2)).toBe(strong)
 expect(rulerCoastDuration(1000)).toBe(maximum)
 const gentleEnd=rulerCoast(80,.45,gentle,1,300).shown
 const strongEnd=rulerCoast(80,1.2,strong,1,300).shown
 expect(gentleEnd).toBeGreaterThan(80)
 expect(strongEnd-80).toBeGreaterThan((gentleEnd-80)*2)
})

it.each([1.2,-1.2])('decelerates monotonically in direction %s, without framewise accumulation',velocity=>{
 const duration=rulerCoastDuration(velocity),direction=Math.sign(velocity),step=20
 let previous=rulerCoast(80.37,velocity,0,1,300).shown,previousDistance=Infinity
 for(let time=step;time<duration;time+=step){
  const current=rulerCoast(80.37,velocity,time,1,300)
  const distance=(current.shown-previous)*direction
  expect(current.done).toBe(false)
  expect(distance).toBeGreaterThanOrEqual(0)
  expect(distance).toBeLessThanOrEqual(previousDistance+1e-10)
  previous=current.shown;previousDistance=distance
 }
 const final=rulerCoast(80.37,velocity,duration,1,300)
 expect(final.done).toBe(true)
 expect((final.shown-previous)*direction).toBeGreaterThanOrEqual(0)
 expect(final.shown).toBe(Math.round(final.shown*10)/10)
})

it.each([.28,-.28,1.2,-1.2,2.4,-2.4])('arrives continuously at its exact tenth for velocity %s',velocity=>{
 const duration=rulerCoastDuration(velocity),direction=Math.sign(velocity)
 const before=rulerCoast(80.37,velocity,duration-2,1,300)
 const almost=rulerCoast(80.37,velocity,duration-1,1,300)
 const final=rulerCoast(80.37,velocity,duration,1,300)
 const earlierStep=(almost.shown-before.shown)*direction,lastStep=(final.shown-almost.shown)*direction
 expect(almost.done).toBe(false)
 expect(final.done).toBe(true)
 expect(final.shown).toBe(Math.round(final.shown*10)/10)
 expect(lastStep).toBeGreaterThanOrEqual(0)
 expect(lastStep).toBeLessThan(earlierStep)
 expect(lastStep).toBeLessThan(.0001)
 expect(rulerCoast(80.37,velocity,100000,1,300)).toEqual(final)
})

it('follows the same time-based trajectory at30fps and60fps and after a delayed frame',()=>{
 const duration=rulerCoastDuration(.8)
 const path=fps=>Array.from({length:Math.floor(duration/(1000/fps))+1},(_,i)=>rulerCoast(80,.8,i*1000/fps,1,300).shown)
 const slow=path(30),fast=path(60)
 for(let i=0;i<slow.length;i++)expect(slow[i]).toBeCloseTo(fast[i*2],10)
 const skipped=rulerCoast(80,.8,800,1,300)
 expect(skipped.shown).toBeCloseTo(slow[24],10)
 expect(skipped.done).toBe(false)
 expect(rulerCoast(80,.8,duration+500,1,300)).toEqual(rulerCoast(80,.8,duration,1,300))
})

it.each([[299.95,2.4,300],[1.05,-2.4,1]])('stops promptly at a nearby bound from %s without stretching the coast', (start,velocity,boundary)=>{
 expect(rulerCoast(start,velocity,0,1,300)).toEqual({shown:start,done:false})
 expect(rulerCoast(start,velocity,16,1,300)).toEqual({shown:boundary,done:true})
 expect(rulerCoast(start,velocity,1800,1,300)).toEqual({shown:boundary,done:true})
})

it('preserves exact off-grid legacy bounds when they are reached',()=>{
 expect(rulerCoast(350.05,1,0,1,350.05)).toEqual({shown:350.05,done:true})
 expect(rulerCoast(.55,-1,0,.55,300)).toEqual({shown:.55,done:true})
 expect(rulerCoast(350,1,100,1,350.05)).toEqual({shown:350.05,done:true})
})

it('treats negative elapsed time as release time and stays finite for invalid inputs',()=>{
 expect(rulerCoast(80.37,.8,-10,1,300)).toEqual(rulerCoast(80.37,.8,0,1,300))
 expect(rulerCoast(80,0,0,1,300)).toEqual({shown:80,done:true})
 for(const args of [[NaN,1,30,1,300],[80,Infinity,30,1,300],[80,1,NaN,1,300],[80,1,30,300,1],[undefined,1,30,undefined,undefined]]){
  const result=rulerCoast(...args)
  expect(Number.isFinite(result.shown)).toBe(true)
  expect(result.done).toBe(true)
 }
 for(const velocity of [0,.279,NaN,Infinity,undefined])expect(rulerCoastDuration(velocity)).toBe(0)
 for(const samples of [null,{},[{x:NaN,t:0},{x:0,t:30}],[{x:0,t:Infinity}]])expect(rulerReleaseVelocity(samples,30)).toBe(0)
 expect(rulerReleaseVelocity([{x:0,t:0},{x:-30,t:30}],NaN)).toBe(0)
})
