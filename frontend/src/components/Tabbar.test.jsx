// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation} from 'react-router-dom'
import {it,expect,vi} from 'vitest'
import Tabbar from './TabBar.jsx'
import {useStore,DEF} from '../store/useStore.js'
vi.mock('../lib/api.js',()=>({api:vi.fn(async()=>({}))}))
globalThis.IS_REACT_ACT_ENVIRONMENT=true
it('keeps navigation buttons mounted when workout activity is saved during pointer capture',()=>{
 localStorage.clear();localStorage.setItem('gym_guest','1');useStore.setState({S:{...structuredClone(DEF),active:{id:'live',start:Date.now(),entries:[]}},user:null})
 const box=document.createElement('div');document.body.appendChild(box);const root=createRoot(box)
 const Probe=()=> <output>{useLocation().pathname}</output>
 const capture=()=>useStore.getState().update(s=>{s.active.lastActivityAt=Date.now()})
 document.addEventListener('pointerdown',capture,true)
 try {
  act(()=>root.render(<MemoryRouter initialEntries={['/workout']}><Tabbar/><Probe/></MemoryRouter>))
  const home=box.querySelector('button');act(()=>home.dispatchEvent(new Event('pointerdown',{bubbles:true})))
  expect(home.isConnected).toBe(true);act(()=>home.click());expect(box.querySelector('output').textContent).toBe('/home')
 } finally {document.removeEventListener('pointerdown',capture,true);act(()=>root.unmount());box.remove();localStorage.clear()}
})
