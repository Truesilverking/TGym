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
