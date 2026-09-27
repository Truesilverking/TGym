// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import BodyMap from './BodyMap.jsx'
import MeasurementBodyMap from './MeasurementBodyMap.jsx'
import geometry from '../lib/body-paths.js'
import {loadBodyGeometry} from '../lib/body-geometry.js'
vi.mock('../lib/body-geometry.js',()=>({loadBodyGeometry:vi.fn()}))
globalThis.IS_REACT_ACT_ENVIRONMENT=true
let host,root
beforeEach(()=>{loadBodyGeometry.mockReset().mockResolvedValue(geometry);host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove()})
it('recovers from a failed asset request and preserves both heatmap views',async()=>{
 loadBodyGeometry.mockRejectedValueOnce(new Error('offline'))
 await act(async()=>root.render(<BodyMap load={{chest:12}}/>))
 expect(host.textContent).toContain('Could not load body model.')
 await act(async()=>host.querySelector('button').click())
 expect(host.querySelectorAll('svg.bm-v')).toHaveLength(2)
 expect(host.querySelector('.bm-m.l4')).not.toBeNull()
 expect(loadBodyGeometry).toHaveBeenCalledTimes(2)
})
it.each(['male','female'])('reuses the %s geometry and allows keyboard selection without changing the data',async(body)=>{
 const onSelect=vi.fn(),metrics=[{key:'neck',label:'Neck',first:30,last:31,delta:1,unit:'cm'}]
 await act(async()=>root.render(<MeasurementBodyMap body={body} metrics={metrics} selected="neck" onSelect={onSelect}/>))
 expect(host.querySelectorAll('svg.bm-v')).toHaveLength(1)
 expect(host.querySelector('svg').getAttribute('viewBox')).toBe(geometry[body].front.vb)
 expect(Object.values(geometry[body].front.p).flat()).toContain(host.querySelector('path').getAttribute('d'))
 const marker=host.querySelector('[role="button"]')
 expect(marker.getAttribute('aria-pressed')).toBe('true')
 act(()=>marker.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})))
 expect(onSelect).toHaveBeenCalledWith('neck');expect(metrics[0].last).toBe(31)
})
