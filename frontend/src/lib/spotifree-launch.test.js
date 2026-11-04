// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const browser = vi.hoisted(() => ({ open: vi.fn(async () => {}) }))
vi.mock('./mobile.js', () => ({ MOBILE: true }))
vi.mock('@capacitor/browser', () => ({ Browser: browser }))
import { launchSpotifree } from './spotifree-sync.js'

beforeEach(() => { vi.clearAllMocks(); browser.open.mockResolvedValue(); vi.stubGlobal('Capacitor', {}) })
afterEach(() => { vi.unstubAllGlobals() })

it('uses the installed HTTPS Browser fallback when no native AppLauncher exists', async () => {
  expect(await launchSpotifree()).toBe(true)
  expect(browser.open).toHaveBeenCalledWith({ url: 'https://spotifree.app' })
})

it('does not claim a rejected native URL was opened and uses the HTTPS fallback', async () => {
  const openUrl = vi.fn(async () => ({ completed: false }))
  vi.stubGlobal('Capacitor', { Plugins: { AppLauncher: { canOpenUrl: vi.fn(async () => ({ value: true })), openUrl } } })
  expect(await launchSpotifree('playlist-1')).toBe(true)
  expect(openUrl).toHaveBeenCalledWith({ url: 'spotifree://playlist/playlist-1' })
  expect(browser.open).toHaveBeenCalledOnce()
})

it('returns false when both native and web launch requests fail', async () => {
  vi.stubGlobal('Capacitor', { Plugins: { AppLauncher: { canOpenUrl: vi.fn(async () => { throw new Error('unavailable') }), openUrl: vi.fn() } } })
  browser.open.mockRejectedValueOnce(new Error('unavailable'))
  expect(await launchSpotifree()).toBe(false)
})

it('accepts a confirmed native launch without also opening the fallback website', async () => {
  const openUrl = vi.fn(async () => ({ completed: true }))
  vi.stubGlobal('Capacitor', { Plugins: { AppLauncher: { canOpenUrl: vi.fn(async () => ({ value: true })), openUrl } } })
  expect(await launchSpotifree()).toBe(true)
  expect(openUrl).toHaveBeenCalledWith({ url: 'spotifree://' })
  expect(browser.open).not.toHaveBeenCalled()
})
