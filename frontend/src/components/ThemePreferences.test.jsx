// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { ThemePreferences } from '../App.jsx'
import { useStore } from '../store/useStore.js'
it('applies saved preferences without mounting the locked application shell',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const before=useStore.getState().S
 const container=document.createElement('div'),root=createRoot(container)
 useStore.setState({S:{...before,theme:'dark',accent:'violet',reduceMotion:true}})
 try {
  await act(()=>root.render(<ThemePreferences />))
  expect(document.documentElement.dataset.accent).toBe('violet')
  expect(document.documentElement.dataset.reduceMotion).toBe('true')
  await act(()=>useStore.setState({S:{...before,theme:'light',accent:'teal'}}))
  expect(document.documentElement.dataset.accent).toBe('teal')
  expect(document.documentElement.dataset.theme).toBe('light')
 } finally { await act(()=>root.unmount());useStore.setState({S:before}) }
})
