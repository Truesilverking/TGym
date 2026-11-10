import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modals from './Modals.jsx'

const mocks = vi.hoisted(() => {
  const listeners = new Set()
  const state = {
    sheets: [],
    closeSheet(id) {
      state.sheets = state.sheets.filter(sheet => sheet.id !== id)
      listeners.forEach(listener => listener())
    },
  }
  return {
    state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setSheets(sheets) {
      state.sheets = sheets
      listeners.forEach(listener => listener())
    },
  }
})

vi.mock('../store/useUI.js', async () => {
  const React = await import('react')
  const useUI = (selector = state => state) => React.useSyncExternalStore(
    mocks.subscribe,
    () => selector(mocks.state),
    () => selector(mocks.state),
  )
  useUI.getState = () => mocks.state
  return { useUI }
})

let dom
let root
let container
let historyMock
let locationMock
let historyStack, historyIndex, queuedTraversal

function sheet(id, { locked = false, render = () => React.createElement('div') } = {}) {
  return { id, locked, kind: 'sheet', render }
}

function installDom() {
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  dom.scrollTo = vi.fn()
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  locationMock = { href: 'https://opengym.test/#/workout' }
  historyStack = [{state:{idx:0,key:'original'},url:locationMock.href}];historyIndex=0;queuedTraversal=null
  historyMock = {
    get state(){return historyStack[historyIndex].state},
    pushState:vi.fn((state,title,url)=>{const entry={state:structuredClone(state),url:url?new URL(url,locationMock.href).href:locationMock.href};historyStack.splice(++historyIndex,Infinity,entry);locationMock.href=entry.url}),
    replaceState:vi.fn((state,title,url)=>{const entry={state:structuredClone(state),url:url?new URL(url,locationMock.href).href:locationMock.href};historyStack[historyIndex]=entry;locationMock.href=entry.url}),
    go:vi.fn(delta=>{queuedTraversal=historyIndex+delta}),
  }
  Object.defineProperty(globalThis, 'location', { configurable: true, value: locationMock })
  Object.defineProperty(globalThis, 'history', { configurable: true, value: historyMock })

  container = document.getElementById('root')
  root = createRoot(container)
}

async function setSheets(sheets) {
  await act(async () => { mocks.setSheets(sheets) })
}

async function popstate() {
  await act(async () => {
    historyIndex=Math.max(0,queuedTraversal??historyIndex-1);queuedTraversal=null
    locationMock.href=historyStack[historyIndex].url
    window.dispatchEvent(new dom.Event('popstate'))
  })
}

function mouse(target, type, clientY) {
  const event = new dom.Event(type, { bubbles: true })
  Object.defineProperties(event, {
    button: { value: 0 },
    clientY: { value: clientY },
  })
  target.dispatchEvent(event)
}

beforeEach(async () => {
  mocks.state.sheets = []
  installDom()
  await act(async () => { root.render(React.createElement(Modals)) })
})

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container = null
  dom = null
  vi.restoreAllMocks()
})

describe('Modals sheet history accounting', () => {
  it('preserves the real previous page and an immediate navigation while a close traversal is pending',async()=>{
    const push=historyMock.pushState,replace=historyMock.replaceState
    await setSheets([sheet('times')])
    expect(historyMock.state.idx).toBe(0);expect(historyMock.state.key).toBe('original')
    await setSheets([])
    history.pushState({idx:1,key:'stats'},'','#/stats')
    expect(location.href).toBe('https://opengym.test/#/stats')
    await popstate()
    expect(location.href).toBe('https://opengym.test/#/stats')
    expect(historyMock.state).toEqual({idx:1,key:'stats'})
    expect(historyMock.pushState).toBe(push);expect(historyMock.replaceState).toBe(replace)
    expect(historyStack).toHaveLength(2)
    await popstate();expect(location.href).toBe('https://opengym.test/#/workout')
    expect(mocks.state.sheets).toHaveLength(0)
  })

  it('replays intervening route replacement as replacement instead of adding a page',async()=>{
    await setSheets([sheet('times')]);await setSheets([])
    history.replaceState({idx:0,key:'library'},'','#/library')
    await popstate()
    expect(location.href).toBe('https://opengym.test/#/library');expect(historyStack).toHaveLength(2)
    expect(historyMock.state).toEqual({idx:0,key:'library'})
  })

  it('restores a newly opened sheet across a pending close without duplicating its active history count',async()=>{
    await setSheets([sheet('first')]);await setSheets([]);await setSheets([sheet('second')])
    await popstate()
    expect(mocks.state.sheets.map(item=>item.id)).toEqual(['second'])
    expect(historyMock.state.openGymSheet).toBe(true)
    await popstate();expect(mocks.state.sheets).toHaveLength(0)
    expect(historyMock.go).toHaveBeenCalledTimes(1)
  })

  it('coalesces consecutive closes and does not resurrect a sheet opened and closed during the rewind',async()=>{
    await setSheets([sheet('lower'),sheet('upper')]);await setSheets([sheet('lower')]);await setSheets([])
    await setSheets([sheet('transient')]);await setSheets([])
    expect(historyMock.go).toHaveBeenCalledTimes(1)
    await popstate();expect(historyMock.go).toHaveBeenLastCalledWith(-1)
    await popstate()
    expect(mocks.state.sheets).toHaveLength(0);expect(historyMock.state.openGymSheet).toBeUndefined()
    expect(historyMock.pushState).toBeTypeOf('function')
  })

  it('restores temporary history methods after a failed traversal and on unmount',async()=>{
    const push=historyMock.pushState,replace=historyMock.replaceState
    await setSheets([sheet('first')]);historyMock.go.mockImplementationOnce(()=>{throw new Error('blocked traversal')})
    await setSheets([])
    expect(historyMock.pushState).toBe(push);expect(historyMock.replaceState).toBe(replace)
    await setSheets([sheet('second')]);await setSheets([])
    expect(historyMock.pushState).not.toBe(push)
    await act(async()=>root.unmount());root=null
    expect(historyMock.pushState).toBe(push);expect(historyMock.replaceState).toBe(replace)
  })

  it('does not replay a failed navigation write during a pending close',async()=>{
    const push=historyMock.pushState
    await setSheets([sheet('times')]);await setSheets([])
    push.mockImplementationOnce(()=>{throw new Error('uncloneable state')})
    expect(()=>history.pushState({idx:1,key:'failed'},'','#/stats')).toThrow('uncloneable state')
    await popstate()
    expect(location.href).toBe('https://opengym.test/#/workout')
    expect(historyMock.state).toEqual({idx:0,key:'original'});expect(historyMock.pushState).toBe(push)
  })

  it('keeps an unspent leak counted if a later traversal in a consecutive close fails',async()=>{
    const push=historyMock.pushState
    await setSheets([sheet('lower'),sheet('upper')]);await setSheets([sheet('lower')]);await setSheets([])
    historyMock.go.mockImplementationOnce(()=>{throw new Error('blocked second traversal')})
    await popstate();expect(historyMock.pushState).toBe(push)
    await popstate() // Spend the remaining leak before opening a fresh sheet.
    const locked=sheet('locked',{locked:true});await setSheets([locked]);await popstate();await setSheets([])
    expect(historyMock.go).toHaveBeenCalledTimes(2)
  })

  it('does not rewind a real page after back spends a locked FinishSummary entry', async () => {
    const confirm = sheet('confirm')
    const summary = sheet('summary', { locked: true })

    await setSheets([confirm])
    expect(historyMock.pushState).toHaveBeenCalledTimes(1)

    // ConfirmDialog closes and FinishSummary opens in the same batch: length remains one,
    // so the existing pushed entry now belongs to the locked summary.
    await setSheets([summary])
    await popstate()
    expect(mocks.state.sheets).toEqual([summary])

    await act(async () => { mocks.state.closeSheet('summary') })
    expect(historyMock.go).not.toHaveBeenCalled()
  })

  it('pushes and rewinds the exact number of entries for batched sheets', async () => {
    await setSheets([sheet('one'), sheet('two')])
    expect(historyMock.pushState).toHaveBeenCalledTimes(2)

    await setSheets([])
    expect(historyMock.go).toHaveBeenCalledTimes(1)
    expect(historyMock.go).toHaveBeenCalledWith(-2)
  })

  it('closes stacked sheets one entry at a time on back', async () => {
    await setSheets([sheet('one'), sheet('two')])
    await popstate()

    expect(mocks.state.sheets.map(item => item.id)).toEqual(['one'])
    expect(historyMock.pushState).toHaveBeenCalledTimes(2)

    await popstate()
    expect(mocks.state.sheets).toEqual([])
    expect(historyMock.go).not.toHaveBeenCalled()
  })

  it('closes an unlocked sheet on back without rewinding its already-spent entry', async () => {
    await setSheets([sheet('open')])
    await popstate()

    expect(mocks.state.sheets).toEqual([])
    expect(historyMock.go).not.toHaveBeenCalled()
  })

  it('accounts for a moved-on entry even when popstate has no current sheet', async () => {
    await setSheets([sheet('navigating')])
    locationMock.href = 'https://opengym.test/#/home'
    await setSheets([])
    expect(historyMock.go).not.toHaveBeenCalled()

    // This spends the deliberately leaked entry with top === undefined.
    await popstate()

    const locked = sheet('locked', { locked: true })
    await setSheets([locked])
    await popstate()
    await setSheets([])
    expect(historyMock.go).not.toHaveBeenCalled()
  })
})

describe('Modals mouse dragging', () => {
  it('lets the visible grab handle drag the sheet while the close button stays clickable',async()=>{
    await setSheets([sheet('grab')])
    const panel=container.querySelector('.sheet');panel.scrollTop=0
    await act(async()=>{mouse(panel.querySelector('.grab'),'mousedown',10);mouse(panel,'mousemove',60)})
    expect(panel.style.transform).toBe('translateY(50px)')
    await act(async()=>window.dispatchEvent(new dom.Event('mouseup')))
    expect(panel.style.transform).toBe('')
    await act(async()=>panel.querySelector('.sheet-close').click())
    expect(mocks.state.sheets).toHaveLength(0)
  })
  it('does not move a sheet for natural tap jitter or gestures beginning on a button',async()=>{
    await setSheets([sheet('tap',{render:()=>React.createElement('button',null,'Choose')})])
    const panel=container.querySelector('.sheet');panel.scrollTop=0
    await act(async()=>{mouse(panel,'mousedown',10);mouse(panel,'mousemove',15)})
    expect(panel.style.transform).toBe('')
    await act(async()=>window.dispatchEvent(new dom.Event('mouseup')))
    await act(async()=>{mouse(panel.querySelector('button:not(.sheet-close)'),'mousedown',10);mouse(panel,'mousemove',150);window.dispatchEvent(new dom.Event('mouseup'))})
    expect(panel.style.transform).toBe('');expect(mocks.state.sheets).toHaveLength(1)
  })
  it('leaves range sliders opted out of sheet dragging', async () => {
    await setSheets([sheet('slider', {
      render: () => React.createElement('input', { type: 'range' }),
    })])
    const sheetEl = container.querySelector('.sheet')
    const slider = container.querySelector('input[type="range"]')
    sheetEl.scrollTop = 0

    await act(async () => {
      mouse(slider, 'mousedown', 10)
      mouse(sheetEl, 'mousemove', 150)
      window.dispatchEvent(new dom.Event('mouseup'))
    })

    expect(sheetEl.style.transform).toBe('')
    expect(mocks.state.sheets).toHaveLength(1)
  })

  it('releases a drag when mouseup occurs outside the sheet', async () => {
    await setSheets([sheet('drag')])
    const sheetEl = container.querySelector('.sheet')
    sheetEl.scrollTop = 0

    await act(async () => {
      mouse(sheetEl, 'mousedown', 10)
      mouse(sheetEl, 'mousemove', 60)
    })
    expect(sheetEl.style.transform).toBe('translateY(50px)')

    await act(async () => { window.dispatchEvent(new dom.Event('mouseup')) })
    expect(sheetEl.style.transform).toBe('')

    await act(async () => { mouse(sheetEl, 'mousemove', 120) })
    expect(sheetEl.style.transform).toBe('')
    expect(mocks.state.sheets).toHaveLength(1)
  })
})


describe('Modals accessible presentation', () => {
  it('labels the dialog and offers a close control without spending unrelated history', async () => {
    await setSheets([sheet('detail', { render: () => React.createElement('h3', null, 'Details') })])
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe(dialog.querySelector('h3').id)
    await act(async () => { dialog.querySelector('.sheet-close').click() })
    expect(mocks.state.sheets).toHaveLength(0)
    expect(historyMock.go).toHaveBeenCalledWith(-1)
  })
  it('keeps locked dialogs locked and makes covered sheets inert', async () => {
    await setSheets([sheet('lower'), sheet('locked', { locked: true })])
    const dialogs = container.querySelectorAll('[role="dialog"]')
    expect(dialogs[0].parentElement.hasAttribute('inert')).toBe(true)
    expect(dialogs[1].parentElement.hasAttribute('inert')).toBe(false)
    expect(dialogs[1].querySelector('.sheet-close')).toBe(null)
    expect(dialogs[1].getAttribute('aria-modal')).toBe('true')
  })
  it('restores the page availability after closing the last dialog', async () => {
    const page = document.createElement('main'); page.id = 'app'; document.body.appendChild(page)
    await setSheets([sheet('detail')])
    expect(page.hasAttribute('inert')).toBe(true)
    await setSheets([])
    expect(page.hasAttribute('inert')).toBe(false)
    page.remove()
  })
})
