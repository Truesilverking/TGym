// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { ThemePreferences } from './App.jsx'
import { useStore, DEF } from './store/useStore.js'

let host, root, priorLang
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  priorLang = document.documentElement.lang
  useStore.setState({ S: structuredClone(DEF), user: null })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(() => root.unmount()); host.remove(); document.documentElement.lang = priorLang })

it.each([['fr', 'en'], ['constructor', 'en'], ['__proto__', 'en'], ['es', 'es'], ['en', 'en']])('uses the displayed language for HTML accessibility metadata (%s)', async (saved, resolved) => {
  useStore.setState({ S: { ...structuredClone(DEF), lang: saved } })
  await act(async () => root.render(<ThemePreferences />))
  expect(document.documentElement.lang).toBe(resolved)
  expect(useStore.getState().S.lang).toBe(saved)
})
