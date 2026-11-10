import { expect, it } from 'vitest'
import { activeStatsPage, moduleForPath, requestedStatsPage, statsPageOrder, statsPages, statsPageTarget, swipeTarget } from './navigation-model.js'

const state=()=>({statsSections:['history','consistency'],statsSectionOrder:['history','consistency'],workouts:[{id:'kept'}]})
const at=(pathname,search='')=>({pathname,search})
it('walks through selected Stats slides and continues to the adjacent modules at both ends',()=>{
 const S=state(),before=structuredClone(S)
 expect(swipeTarget(S,at('/nutrition'),1)).toBe('/stats?section=history')
 expect(swipeTarget(S,at('/stats','?section=history'),-1)).toBe('/nutrition')
 expect(swipeTarget(S,at('/stats','?section=history'),1)).toBe('/stats?section=consistency')
 expect(swipeTarget(S,at('/stats','?section=consistency'),1)).toBe('/records')
 expect(swipeTarget(S,at('/records'),1)).toBe('/history')
 expect(swipeTarget(S,at('/history'),1)).toBe('/progress')
 expect(swipeTarget(S,at('/progress'),1)).toBe('/home')
 expect(swipeTarget(S,at('/home'),-1)).toBe('/progress')
 expect(S).toEqual(before)
})
it('retains meaningful legacy routes and safe direct links to unselected analytics',()=>{
 const S=state()
 expect(activeStatsPage(S,at('/body'))).toBe('bodyweight')
 expect(statsPages(S,'bodyweight')).toContain('bodyweight')
 expect(requestedStatsPage(at('/stats','?section=does-not-exist'))).toBeNull()
 expect(activeStatsPage(S,at('/stats','?section=does-not-exist'))).toBe('history')
 expect(moduleForPath('/plan/r/stable-id')).toBe('plan')
 expect(moduleForPath('/workout')).toBeNull()
 expect(statsPageTarget('records')).toBe('/records')
})
it('keeps stable custom page ordering, ignores invalid and duplicate IDs, and never loses existing sections',()=>{
 const S={...state(),statsPageOrder:['report','consistency','report','removed','history']}
 expect(statsPages(S)).toEqual(['report','consistency','history','records','workout-history'])
 expect(new Set(statsPageOrder(S)).size).toBe(statsPageOrder(S).length)
 expect(statsPageOrder(S)).not.toContain('removed')
 expect(swipeTarget(S,at('/nutrition'),1)).toBe('/progress')
 expect(swipeTarget(S,at('/stats'),1)).toBe('/stats?section=consistency')
})
it.each(['/workout','/settings','/admin','/plan/r/id','/missing'])('does not swipe away from a detail or editing route %s',path=>{
 expect(swipeTarget(state(),at(path),1)).toBeNull()
})
it('includes both routine views in the continuous module deck',()=>{
 expect(swipeTarget(state(),at('/home'),1)).toBe('/plan')
 expect(swipeTarget(state(),at('/plan'),1)).toBe('/library')
 expect(swipeTarget(state(),at('/library'),1)).toBe('/nutrition')
})
