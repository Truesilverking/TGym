// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { webauthnOK, api } from './api.js'

const originalPublicKeyCredential = window.PublicKeyCredential
const originalCredentials = navigator.credentials

function setCapability(target, property, value) {
  Object.defineProperty(target, property, { configurable: true, value })
}

afterEach(() => {
  setCapability(window, 'PublicKeyCredential', originalPublicKeyCredential)
  setCapability(navigator, 'credentials', originalCredentials)
})

describe('webauthnOK', () => {
  it('accepts WebAuthn when PublicKeyCredential is exposed', () => {
    setCapability(window, 'PublicKeyCredential', class PublicKeyCredential {})
    setCapability(navigator, 'credentials', {})
    expect(webauthnOK()).toBe(true)
  })

  it('does not reject WebAuthn when the generic credentials check is unavailable', () => {
    setCapability(window, 'PublicKeyCredential', class PublicKeyCredential {})
    setCapability(navigator, 'credentials', undefined)
    expect(webauthnOK()).toBe(true)
  })

  it('rejects browsers without the WebAuthn credential type', () => {
    setCapability(window, 'PublicKeyCredential', undefined)
    setCapability(navigator, 'credentials', {})
    expect(webauthnOK()).toBe(false)
  })
})

it('bounds a stalled connection, including a response whose JSON never finishes',async()=>{
 vi.useFakeTimers()
 for(const bodyStalls of [false,true]){
  const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(()=>bodyStalls?Promise.resolve({ok:true,json:()=>new Promise(()=>{})}):new Promise(()=>{}))
  const request=api('/api/data',{timeoutMs:1000})
  const failed=expect(request).rejects.toMatchObject({code:'timeout'})
  await vi.advanceTimersByTimeAsync(1000);await failed
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  fetcher.mockRestore()
 }
 vi.useRealTimers()
})
it('does not accept malformed JSON as a successful save',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>{throw Error('bad JSON')}})
 await expect(api('/api/data',{method:'PUT'})).rejects.toThrow('Invalid server response')
 fetcher.mockRestore()
})
