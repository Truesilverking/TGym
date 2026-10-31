import { Capacitor, registerPlugin } from '@capacitor/core'
const SystemAppearance = registerPlugin('SystemAppearance')

// Android reserves system-bar space outside the WebView. Paint that native
// surface with the same theme and readable system icons, without hiding bars.
export function syncSystemAppearance(theme) {
  if (Capacitor.getPlatform() !== 'android') return
  SystemAppearance.setTheme({ light: theme === 'light' }).catch(() => {
    console.warn('[TGym] Could not synchronize system-bar appearance')
  })
}

// Only this visible control may own Android's edge gesture area. Send CSS
// viewport coordinates; the native WebView maps them to its own pixel bounds.
// No preferences or workout data enter this optional bridge operation.
export function syncStatsGestureExclusion(rect,viewport) {
  if (Capacitor.getPlatform() !== 'android' || Capacitor.isNativePlatform?.() !== true) return
  const width=viewport?.width,height=viewport?.height
  const valid=rect && [rect.left,rect.top,rect.right,rect.bottom,width,height].every(Number.isFinite) && width>0 && height>0
  const left=valid?Math.max(0,rect.left):0,top=valid?Math.max(0,rect.top):0
  const right=valid?Math.min(width,rect.right):0,bottom=valid?Math.min(height,rect.bottom):0
  const payload=valid&&right>left&&bottom>top
    ? {enabled:true,left,top,right,bottom,viewportWidth:width,viewportHeight:height}
    : {enabled:false}
  const failed=()=>console.warn('[TGym] Could not synchronize Stats gesture area')
  try { return Promise.resolve(SystemAppearance.setGestureExclusion(payload)).catch(failed) }
  catch { failed() } // Older native shells keep their ordinary gesture behavior.
}
