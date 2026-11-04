// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals from './Modals.jsx'

const mocks = vi.hoisted(() => {
  const listeners = new Set()
  const state = { sheets: [], closeSheet(id) {
    state.sheets = state.sheets.filter(sheet => sheet.id !== id)
    listeners.forEach(listener => listener())
  } }
  return { state, subscribe(listener) { listeners.add(listener);return()=>listeners.delete(listener) }, setSheets(sheets) {
    state.sheets = sheets;listeners.forEach(listener => listener())
  } }
})
vi.mock('../store/useUI.js', async () => {
  const React = await import('react')
  const useUI = (selector = state => state) => React.useSyncExternalStore(mocks.subscribe,()=>selector(mocks.state),()=>selector(mocks.state))
  useUI.getState = () => mocks.state
  return { useUI }
})
let root,container,historyMock
function sheet(id,{locked=false,kind='sheet',render=()=>React.createElement('div')}={}) { return {id,locked,kind,render} }
async function setSheets(sheets) { await act(async()=>mocks.setSheets(sheets)) }
function pointer(target,type,options={}) { target.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:1,isPrimary:true,...options})) }
function mouse(target,type,clientY) { target.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientY})) }
function click(target,detail=1) { target.dispatchEvent(new MouseEvent('click',{bubbles:true,detail})) }
beforeEach(async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;mocks.state.sheets=[]
  history.replaceState({idx:0,key:'original'},'','/#/workout')
  vi.spyOn(history,'go').mockImplementation(()=>{})
  historyMock=history
  container=document.createElement('div');document.body.append(container);root=createRoot(container)
  await act(async()=>root.render(<Modals/>))
})
afterEach(async()=>{
  await act(async()=>root.unmount());container.remove();vi.restoreAllMocks()
})

describe('Modals backdrop contact ownership', () => {
  it.each(['sheet','center'])('keeps a new %s open when the initiating hold releases through its backdrop',async kind=>{
    const lower=sheet('workout',{render:()=>React.createElement('button',null,'Hold exercise')})
    await setSheets([lower])
    const source=container.querySelector('.sheet button:not(.sheet-close)')
    await act(async()=>pointer(source,'pointerdown'))
    await setSheets([lower,sheet('sets',{kind})])
    const backdrop=[...container.querySelectorAll('.mback')].at(-1)
    await act(async()=>{
      pointer(source,'pointerup')
      // Touch compatibility events are retargeted after the new sheet appears.
      mouse(backdrop,'mousedown',100);mouse(backdrop,'mouseup',100);click(backdrop)
    })
    expect(mocks.state.sheets.map(item=>item.id)).toEqual(['workout','sets'])
    expect(historyMock.go).not.toHaveBeenCalled()
  })
  it.each(['sheet','center'])('dismisses only the top %s after a fresh backdrop pointer tap',async kind=>{
    await setSheets([sheet('lower'),sheet('upper',{kind})])
    const backdrop=[...container.querySelectorAll('.mback')].at(-1)
    await act(async()=>{pointer(backdrop,'pointerdown');pointer(backdrop,'pointerup');click(backdrop)})
    expect(mocks.state.sheets.map(item=>item.id)).toEqual(['lower'])
    expect(historyMock.go).toHaveBeenCalledWith(-1)
  })
  it('ignores a click ending on the backdrop when its pointer began in the panel',async()=>{
    await setSheets([sheet('detail')])
    const backdrop=container.querySelector('.mback'),panel=container.querySelector('.sheet')
    await act(async()=>{pointer(panel,'pointerdown');pointer(backdrop,'pointerup');click(backdrop)})
    expect(mocks.state.sheets).toHaveLength(1)
  })
  it.each(['pointercancel','blur','outside-release','different-pointer','new-contact','multitouch'])('invalidates backdrop dismissal on %s',async kind=>{
    await setSheets([sheet('detail')])
    const backdrop=container.querySelector('.mback'),panel=container.querySelector('.sheet')
    await act(async()=>{
      pointer(backdrop,'pointerdown')
      if(kind==='blur')window.dispatchEvent(new Event('blur'))
      else if(kind==='outside-release')pointer(panel,'pointerup')
      else if(kind==='different-pointer')pointer(backdrop,'pointerup',{pointerId:2})
      else if(kind==='new-contact')pointer(panel,'pointerdown',{pointerId:2,isPrimary:false})
      else if(kind==='multitouch'){
        const event=new Event('touchstart',{bubbles:true});Object.defineProperty(event,'touches',{value:[{},{}]});document.dispatchEvent(event)
      }else pointer(backdrop,'pointercancel')
      pointer(backdrop,'pointerup');click(backdrop)
    })
    expect(mocks.state.sheets).toHaveLength(1)
    expect(historyMock.go).not.toHaveBeenCalled()
  })
  it.each([{button:2},{isPrimary:false}])('ignores a secondary backdrop contact %j',async options=>{
    await setSheets([sheet('detail')]);const backdrop=container.querySelector('.mback')
    await act(async()=>{pointer(backdrop,'pointerdown',options);pointer(backdrop,'pointerup',options);click(backdrop)})
    expect(mocks.state.sheets).toHaveLength(1)
  })
  it('permits a new backdrop tap after an ignored compatibility click',async()=>{
    await setSheets([sheet('detail')]);const backdrop=container.querySelector('.mback')
    await act(async()=>{mouse(backdrop,'mousedown',100);mouse(backdrop,'mouseup',100);click(backdrop)})
    expect(mocks.state.sheets).toHaveLength(1)
    await act(async()=>{pointer(backdrop,'pointerdown');pointer(backdrop,'pointerup');click(backdrop)})
    expect(mocks.state.sheets).toHaveLength(0)
  })
  it('preserves keyboard and assistive clicks without a pointer contact',async()=>{
    await setSheets([sheet('detail')]);await act(async()=>click(container.querySelector('.mback'),0))
    expect(mocks.state.sheets).toHaveLength(0)
  })
  it('keeps covered and locked backdrops inert to both pointer and assistive activation',async()=>{
    await setSheets([sheet('lower'),sheet('locked',{locked:true})])
    for(const backdrop of container.querySelectorAll('.mback'))await act(async()=>{
      pointer(backdrop,'pointerdown');pointer(backdrop,'pointerup');click(backdrop);click(backdrop,0)
    })
    expect(mocks.state.sheets.map(item=>item.id)).toEqual(['lower','locked'])
    expect(historyMock.go).not.toHaveBeenCalled()
  })
})


