// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import Settings from './Settings.jsx'
import Modals from '../components/Modals.jsx'
import {bindUI} from '../components/ui.jsx'
import {DEF, useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'

vi.mock('../components/AppUpdate.jsx',()=>({UpdateCheckButton:()=>null}))
vi.mock('../lib/i18n.js',async original=>({...await original(),t:(key,...values)=>key.replace(/\{(\d+)\}/g,(_,i)=>values[i])}))
let host,root
const button = text => [...host.querySelectorAll('button')].find(e=>e.textContent.includes(text))
async function click(text){const e=button(text);expect(e).toBeTruthy();await act(async()=>e.click())}
const data = S => JSON.stringify(Object.fromEntries(Object.entries(S).filter(([key])=>!['exerciseNameMode','_ts'].includes(key))))

beforeEach(async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  localStorage.clear();sessionStorage.clear()
  useStore.setState({user:null,S:{...structuredClone(DEF),lang:'en',hasCompletedOnboarding:true,exerciseAliases:{'0025':'Mi banca'},workouts:[{id:'saved',d:'2026-10-01',entries:[{id:'0025',n:'Original snapshot',sets:[{done:true,w:20,r:8}]}]}]}})
  useUI.setState({sheets:[]})
  bindUI(useUI)
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  await act(async()=>root.render(<MemoryRouter><Settings/><Modals/></MemoryRouter>))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks()})

it('offers both global name modes and persists only the presentation preference without deleting aliases or history',async()=>{
  expect(button('Exercise names').textContent).toContain('My aliases')
  expect(host.textContent).toContain('Missing aliases use the original name; your aliases are kept.')
  const before=data(useStore.getState().S)
  await click('Exercise names')
  expect(button('My aliases')).toBeTruthy()
  expect(button('Original names')).toBeTruthy()
  await click('Original names')
  expect(useStore.getState().S.exerciseNameMode).toBe('original')
  expect(button('Exercise names').textContent).toContain('Original names')
  expect(data(useStore.getState().S)).toBe(before)
  const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.exerciseNameMode).toBe('original')
  expect(saved.exerciseAliases).toEqual({'0025':'Mi banca'})
  await act(async()=>{root.unmount();useStore.setState({S:saved});root=createRoot(host);root.render(<MemoryRouter><Settings/><Modals/></MemoryRouter>)})
  expect(button('Exercise names').textContent).toContain('Original names')
  await click('Exercise names');await click('My aliases')
  expect(useStore.getState().S.exerciseNameMode).toBe('aliases')
  expect(data(useStore.getState().S)).toBe(before)
})
