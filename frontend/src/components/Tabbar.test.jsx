// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation} from 'react-router-dom'
import {it,expect,vi} from 'vitest'
import TabBar from './TabBar.jsx'
import {useStore,DEF} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
vi.mock('../lib/api.js',()=>({api:vi.fn(async()=>({}))}))
globalThis.IS_REACT_ACT_ENVIRONMENT=true
it('keeps the lifted navigation target mounted while workout activity is saved during pointer capture',()=>{
 localStorage.clear();localStorage.setItem('gym_guest','1');useStore.setState({S:{...structuredClone(DEF),active:{id:'live',start:Date.now(),entries:[]}},user:null,needsMobileOnboarding:false})
 useUI.setState({sheets:[],appTourRequest:null,appTourWorkoutPreview:false})
 const box=document.createElement('div');document.body.appendChild(box);const root=createRoot(box)
 const Probe=()=> <output>{useLocation().pathname}</output>
 const capture=()=>useStore.getState().update(s=>{s.active.lastActivityAt=Date.now()})
 document.addEventListener('pointerdown',capture,true)
 try {
  act(()=>root.render(<MemoryRouter initialEntries={['/workout']}><TabBar/><Probe/></MemoryRouter>))
  const toggle=box.querySelector('#navigation-dock-toggle');act(()=>toggle.click())
  const home=box.querySelector('.navigation-dock-tab');act(()=>home.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1})))
  expect(home.isConnected).toBe(true);act(()=>home.click())
  expect(box.querySelector('output').textContent).toBe('/home');expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(useUI.getState().sheets).toHaveLength(0)
 } finally {document.removeEventListener('pointerdown',capture,true);act(()=>root.unmount());useUI.getState().closeAll();box.remove();localStorage.clear()}
})
