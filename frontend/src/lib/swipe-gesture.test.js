import {expect,it} from 'vitest'
import {beginSwipe,moveSwipe,swipeOffset,swipeStep} from './swipe-gesture.js'
const gesture=(width=390)=>beginSwipe(250,200,0,width)

it.each([[1,-110],[-1,110]])('accepts a deliberate slow horizontal drag in direction %s', (step,dx)=>{
  const g=gesture();moveSwipe(g,250+dx/2,205,150);moveSwipe(g,250+dx,210,450)
  expect(swipeStep(g,250+dx,210,600)).toBe(step)
})
it.each([[4,8],[13,4],[16,12],[30,24],[45,70]])('rejects jitter or a nonhorizontal start %s/%s',(dx,dy)=>{
  const g=gesture();moveSwipe(g,250-dx,200+dy,80)
  expect(swipeStep(g,250-dx,200+dy,120)).toBe(0)
})
it('never changes a vertical/ambiguous start into page navigation',()=>{
  for(const [x,y] of [[247,220],[225,220]]){
    const g=gesture();expect(moveSwipe(g,x,y,30)).toBe('rejected')
    expect(moveSwipe(g,80,225,100)).toBe('rejected');expect(swipeStep(g,50,225,150)).toBe(0)
  }
})
it('uses the recent flick after a pause during an already deliberate horizontal gesture',()=>{
  const g=gesture();moveSwipe(g,234,200,40);moveSwipe(g,234,200,360)
  moveSwipe(g,228,200,380);moveSwipe(g,214,200,400)
  expect(swipeStep(g,202,200,415)).toBe(1)
})
it('does not use old flick velocity after holding a short drag',()=>{
  const g=gesture();moveSwipe(g,200,200,40)
  expect(swipeStep(g,200,200,390)).toBe(0)
})
it('does not turn a long stationary text hold into page navigation',()=>{
  const g=gesture();expect(moveSwipe(g,180,200,650)).toBe('rejected')
  expect(swipeStep(g,80,200,720)).toBe(0)
})
it.each([20,200])('cancels a deliberate reversal even after a long drag and %sms release pause',pause=>{
  const g=gesture();moveSwipe(g,80,200,180);moveSwipe(g,150,200,240)
  expect(swipeStep(g,150,200,240+pause)).toBe(0)
})
it('follows a deliberate opposite direction after fully returning through the origin',()=>{
  const g=gesture();moveSwipe(g,160,200,120);moveSwipe(g,250,200,240);moveSwipe(g,360,200,400)
  expect(swipeStep(g,360,200,420)).toBe(-1)
})
it('cancels navigation when the user turns the contact vertically',()=>{
  const g=gesture();moveSwipe(g,210,200,70);expect(moveSwipe(g,200,300,140)).toBe('rejected')
  expect(swipeStep(g,100,320,200)).toBe(0)
})
it.each([320,390,680,1280])('requires clear distance at %spx without stale speed',width=>{
  const g=gesture(width),threshold=Math.min(108,Math.max(64,width*.2))
  moveSwipe(g,250-threshold+1,200,200)
  expect(swipeStep(g,250-threshold+1,200,500)).toBe(0)
  const deliberate=gesture(width);moveSwipe(deliberate,250-threshold-1,200,200)
  expect(swipeStep(deliberate,250-threshold-1,200,500)).toBe(1)
})
it('uses the final release position, including a returned or completed drag',()=>{
  const returned=gesture();moveSwipe(returned,150,200,100)
  expect(swipeStep(returned,245,200,150)).toBe(0)
  const completed=gesture();moveSwipe(completed,220,200,100)
  expect(swipeStep(completed,140,200,150)).toBe(1)
})
it('limits presentation travel without changing the decision or stored dimensions',()=>{
  const g=gesture(390);moveSwipe(g,220,200,30);expect(swipeOffset(g)).toBe(-20)
  moveSwipe(g,-1500,200,200);expect(Math.abs(swipeOffset(g))).toBeLessThanOrEqual(150)
  expect(g.width).toBe(390);expect(swipeStep(g,-1500,200,300)).toBe(1)
})
