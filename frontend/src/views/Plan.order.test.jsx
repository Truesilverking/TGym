// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {it,expect,beforeEach,afterEach,vi} from 'vitest'
import Plan from './Plan.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {orderedRoutines} from '../lib/routine-order.js'
vi.mock('../components/RoutineList.jsx',()=>({default:({S,onDelete})=><button onClick={()=>onDelete(S.routines.find(r=>r.id==='b'))}>Delete test routine</button>}))
vi.mock('../sheets.jsx',async original=>({...await original(),confirmSheet:({onConfirm})=>onConfirm()}))
let root,host,original
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();sessionStorage.clear();original={...structuredClone(DEF),lang:'en',routines:['a','b','c'].map(id=>({id,name:id,ex:[]})),routineOrder:['c','b','a'],week:{1:['b','a']},dayPlan:{'2026-09-29':['b']},workouts:[{id:'history',routineId:'b',entries:[]}]};useStore.setState({S:original,user:null});host=document.createElement('div');document.body.append(host);root=createRoot(host);act(()=>root.render(<MemoryRouter><Plan/></MemoryRouter>))})
afterEach(()=>{act(()=>root.unmount());host.remove()})
const click=text=>act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent===text).click())
it.each(['Delete test routine','Delete all routines'])('restores display order, schedule and history after %s and Undo',label=>{
 click(label);expect(orderedRoutines(useStore.getState().S).map(r=>r.id)).toEqual(label==='Delete all routines'?[]:['c','a']);click('Undo');const S=useStore.getState().S;expect(S.routineOrder).toEqual(['c','b','a']);expect(S.week).toEqual(original.week);expect(S.dayPlan).toEqual(original.dayPlan);expect(S.workouts).toEqual(original.workouts);expect(JSON.parse(localStorage.getItem('gym_state_v1')).routineOrder).toEqual(['c','b','a'])
})
