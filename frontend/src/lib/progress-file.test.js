// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { saveProgressFile } from './progress-file.js'
const native = vi.hoisted(() => ({ mobile: false, share: vi.fn() }))
vi.mock('./mobile.js', () => ({ get MOBILE() { return native.mobile }, shareBase64: (...args) => native.share(...args) }))
afterEach(() => { native.mobile = false; vi.restoreAllMocks(); vi.unstubAllGlobals(); native.share.mockReset() })
const file = () => ({ blob: new Blob(['%PDF-1.3\n%%EOF'], { type: 'application/pdf' }), name: 'TGym-Progress-Report-2026-07-01_2026-09-26.pdf', url: 'blob:report' })
it('downloads an attached PDF link with its stable filename and removes it', async () => {
  const result = file()
  vi.stubGlobal('navigator', {})
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    expect(this.isConnected).toBe(true); expect(this.download).toBe(result.name); expect(this.href).toBe(result.url)
  })
  await saveProgressFile(result)
  expect(click).toHaveBeenCalledOnce(); expect(document.querySelector('a')).toBeNull()
})
it('keeps Download a file download even when the browser offers Web Share', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { canShare: () => true, share })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await saveProgressFile(file())
  expect(click).toHaveBeenCalledOnce(); expect(share).not.toHaveBeenCalled()
})
it('writes native PDF bytes as base64 rather than corrupting them with UTF-8', async () => {
  native.mobile = true
  await saveProgressFile(file())
  expect(atob(native.share.mock.calls[0][0])).toBe('%PDF-1.3\n%%EOF')
  expect(native.share.mock.calls[0][1]).toBe(file().name)
})
it('propagates save failures for the UI to handle', async () => {
  native.mobile = true; native.share.mockRejectedValueOnce(new Error('Disk full'))
  await expect(saveProgressFile(file())).rejects.toThrow('Disk full')
})
