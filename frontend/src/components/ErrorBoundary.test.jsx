// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import ErrorBoundary from './ErrorBoundary.jsx'
import {DEF,useStore} from '../store/useStore.js'

vi.mock('../lib/i18n.js',()=>({t:value=>value}))

let host,root,before,raw
const discard=()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Discard the running workout')
function Screen({broken=false}){if(broken)throw new Error('Synthetic screen failure');return <div>Recovered screen</div>}
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 vi.spyOn(console,'error').mockImplementation(()=>{})
 localStorage.clear()
 before={...structuredClone(DEF),active:{id:'workout-kept',start:1000,entries:[{id:'0025',sets:[{w:42.75,r:8,done:false}]}]},workouts:[{id:'history-kept',start:1,end:2,entries:[]}]}
 useStore.setState({S:structuredClone(before),user:null})
 raw=JSON.stringify(before);localStorage.setItem('gym_state_v1',raw)
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.restoreAllMocks()})
const preserved=()=>{expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(raw)}
const render=props=>act(()=>root.render(<ErrorBoundary {...props.boundary}><Screen broken={props.broken}/></ErrorBoundary>))

it.each([undefined,false])('does not offer to discard the active workout after an unrelated module error (%s)',async allowDiscardWorkout=>{
 await render({boundary:{active:true,resetKey:'/nutrition',allowDiscardWorkout},broken:true})
 expect(host.textContent).toContain('Something went wrong');expect(discard()).toBeUndefined()
 expect(host.textContent).toContain('Reload TGym');preserved()
})

it('offers the workout recovery action only when the workout route explicitly allows it',async()=>{
 await render({boundary:{active:true,resetKey:'/workout',allowDiscardWorkout:true},broken:true})
 expect(discard()).toBeTruthy();preserved()
})

it('recovers a retained screen after revisiting it with corrected data without changing the workout',async()=>{
 await render({boundary:{active:true,resetKey:'stats'},broken:true})
 expect(host.textContent).toContain('Something went wrong')
 await render({boundary:{active:false,resetKey:'stats'},broken:false})
 expect(host.textContent).toContain('Something went wrong')
 await render({boundary:{active:true,resetKey:'stats'},broken:false})
 expect(host.textContent).toContain('Recovered screen');expect(host.textContent).not.toContain('Something went wrong')
 expect(discard()).toBeUndefined();preserved()
})

it('resets a failed analytics pane when the section query changes, without remounting its boundary',async()=>{
 await render({boundary:{active:true,resetKey:'/stats?section=history'},broken:true})
 await render({boundary:{active:true,resetKey:'/stats?section=bodyweight'},broken:false})
 expect(host.textContent).toBe('Recovered screen');preserved()
})

it('keeps a healthy sibling section usable when another retained pane cannot render',async()=>{
 await act(()=>root.render(<><ErrorBoundary active resetKey="nutrition"><Screen broken/></ErrorBoundary><ErrorBoundary active resetKey="stats"><button>Healthy section</button></ErrorBoundary></>))
 expect(host.textContent).toContain('Something went wrong');expect(host.textContent).toContain('Healthy section')
 expect(discard()).toBeUndefined();preserved()
})
