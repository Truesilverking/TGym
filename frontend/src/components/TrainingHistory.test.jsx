// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import TrainingHistory from './TrainingHistory.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { setLang } from '../lib/i18n.js'

it('shows a short day/month/year Since date without a weekday and without writing history',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;await setLang('en');localStorage.clear()
 const S={...structuredClone(DEF),trainingStartDate:'2026-09-01'};useStore.setState({S})
 const host=document.createElement('div'),root=createRoot(host);document.body.append(host)
 try{await act(()=>root.render(<TrainingHistory/>));expect(host.textContent).toContain('Since 01/09/2026');expect(host.textContent).not.toContain('Tuesday');expect(useStore.getState().S).toBe(S);expect(localStorage.length).toBe(0)}
 finally{await act(()=>root.unmount());host.remove()}
})
