import { useEffect } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import { checkForAppUpdate, dismissUpdate, updateUrlFor } from '../lib/app-update.js'

async function openUpdateUrl(url) {
  if (!url) { location.reload(); return }
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
      return
    }
  } catch {}
  window.open(url, '_blank', 'noopener')
}

export function showUpdateSheet(manifest) {
  useUI.getState().openSheet(close => <><h3>{t('Update available')}</h3><p>{t('TGym {0} is available.', manifest.version)}</p>
    {!!manifest.notes.length && <ul className="small muted">{manifest.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>}
    <Button variant="primary" onClick={() => { const url = updateUrlFor(manifest); close(); void openUpdateUrl(url) }}>{t('Update')}</Button>
    {!manifest.mandatory && <><div style={{ height: 8 }} /><Button onClick={() => { dismissUpdate(manifest.version); close() }}>{t('Later')}</Button></>}</>)
}
export async function manualUpdateCheck() {
  const result = await checkForAppUpdate({ force: true })
  if (result.update) showUpdateSheet(result.update)
  else useUI.getState().toast(t('TGym is up to date.'))
}
export default function AppUpdate() {
  useEffect(() => {
    let gone = false
    const check = () => checkForAppUpdate().then(r => { if (!gone && r.update) showUpdateSheet(r.update) }).catch(() => {})
    check()
    const visible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', visible)
    return () => { gone = true; document.removeEventListener('visibilitychange', visible) }
  }, [])
  return null
}
