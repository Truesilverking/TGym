// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import RoutineDuration from './RoutineDuration.jsx'
vi.mock('../lib/i18n.js',()=>({t:(s,...args)=>s.replace(/\{(\d+)\}/g,(_,i)=>args[i])}))
vi.mock('./ui.jsx',()=>({Segmented:({options,onChange})=><div>{options.map(o=><button key={o.value} onClick={()=>onChange(o.value)}>{o.label}</button>)}</div>}))

it('shows corrected average, sample count and median and reuses period controls',async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const now=Date.now(), start=now-100*86400000
  const container=document.createElement('div'),root=createRoot(container)
  try {
    await act(()=>root.render(<RoutineDuration S={{routines:[{id:'r',name:'Upper A'}],workouts:[{id:'w',routineId:'r',start,end:start+90*60000,pausedDurationMs:12*60000}]}} />))
    expect(container.textContent).toContain('No completed workouts')
    await act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='All').click())
    expect(container.textContent).toContain('Upper A')
    expect(container.textContent).toContain('1h 18m')
    expect(container.textContent).toContain('1 workout')
    expect(container.textContent).toContain('Median: 1h 18m')
  } finally { await act(()=>root.unmount()); container.remove() }
})
