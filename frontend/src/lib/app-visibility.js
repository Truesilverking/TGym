import { Capacitor } from '@capacitor/core'

// Native Android can background the Activity while its WebView still reports a
// visible document. Either source can hide the app; both must permit a resume.
export function observeAppVisibility(callback) {
  if (typeof document === 'undefined') return () => {}
  const doc = document
  let disposed = false, nativeActive = true, active = true, nativeRevision = 0
  let nativeHandle = null
  const publish = () => {
    if (disposed) return
    const next = !doc.hidden && nativeActive
    if (next === active) return
    active = next
    callback(next)
  }
  const removeNative = handle => {
    try { Promise.resolve(handle?.remove()).catch(() => {}) } catch { /* Already removed or unavailable. */ }
  }
  doc.addEventListener('visibilitychange', publish)
  publish()

  let native = false
  try { native = Capacitor.isNativePlatform() } catch { /* Keep browser visibility available. */ }
  if (native) {
    void import('@capacitor/app').then(({ App }) => {
      if (disposed) return
      let subscriptionFailed = false
      const fallbackToDocument = () => {
        if (disposed || subscriptionFailed) return
        subscriptionFailed = true
        nativeRevision++
        nativeActive = true
        publish()
      }
      // A bridge snapshot may resolve after a newer native event.
      const snapshotRevision = nativeRevision
      try {
        Promise.resolve(App.addListener('appStateChange', state => {
          if (disposed || subscriptionFailed || typeof state?.isActive !== 'boolean') return
          nativeRevision++
          nativeActive = state.isActive
          publish()
        })).then(handle => {
          if (disposed) removeNative(handle)
          else nativeHandle = handle
        }).catch(fallbackToDocument)
      } catch { fallbackToDocument() }
      try {
        Promise.resolve(App.getState()).then(state => {
          if (disposed || subscriptionFailed || nativeRevision !== snapshotRevision || typeof state?.isActive !== 'boolean') return
          nativeActive = state.isActive
          publish()
        }).catch(() => {})
      } catch { /* Events remain authoritative when the snapshot is unavailable. */ }
    }).catch(() => {})
  }
  return () => {
    if (disposed) return
    disposed = true
    doc.removeEventListener('visibilitychange', publish)
    if (nativeHandle) { removeNative(nativeHandle); nativeHandle = null }
  }
}
