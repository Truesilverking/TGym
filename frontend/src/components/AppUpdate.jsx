import { useEffect, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import { checkForAppUpdate, dismissUpdate, updateUrlFor } from '../lib/app-update.js'
import { APP_DISTRIBUTION } from '../lib/app-meta.js'
import { createBackup } from '../lib/backup.js'
import { initializeUpdatePush } from '../lib/update-push.js'

const Installer = registerPlugin('AppInstaller')
async function snapshotBeforeUpdate() {
  const data = JSON.stringify(createBackup(useStore.getState().S))
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({path:'tgym-pre-update.json', directory:Directory.Data, encoding:Encoding.UTF8, data})
  } else localStorage.setItem('tgym_pre_update_backup', data)
  if (useStore.getState().S.cloudSync?.on) useStore.getState().update(s => { s.cloudSync.dirtyAt = Date.now() })
}
function UpdateDialog({manifest, close}) {
  const [busy, setBusy] = useState(false), [percent, setPercent] = useState(0)
  const [permission, setPermission] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let gone = false, listener
    Installer.addListener('progress', e => setPercent(e.percent)).then(h => { if (gone) void h.remove(); else listener = h })
    return () => { gone = true; void listener?.remove() }
  }, [])
  const install = async () => {
    setBusy(true); setError('')
    try {
      await snapshotBeforeUpdate()
      if (APP_DISTRIBUTION === 'github' && Capacitor.getPlatform() === 'android') {
        const result = permission ? await Installer.resumeInstall() : await Installer.install({url: manifest.android.apk, sha256:manifest.android.sha256, versionCode:manifest.versionCode})
        setPermission(!!result.permissionRequired)
        if (result.installerOpened) close()
      } else if (APP_DISTRIBUTION === 'pwa') {
        const reg = await navigator.serviceWorker?.getRegistration()
        await reg?.update()
        if (reg?.waiting) {
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {once:true})
          reg.waiting.postMessage({type:'SKIP_WAITING'})
        } else location.reload()
      } else {
        const url = updateUrlFor(manifest)
        if (!url) throw new Error('Update unavailable')
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({url}); close()
      }
    } catch { setError(t('Update failed. Please try again.')) }
    finally { setBusy(false) }
  }
  return <><h3>{t('Update available')}</h3><p>{t('TGym {0} is available.', manifest.version)}</p>
    {!!manifest.notes.length && <ul>{manifest.notes.map((note,i) => <li key={i}>{note}</li>)}</ul>}
    {busy && <progress max="100" value={percent} style={{width:'100%'}} />}
    {permission && <p>{t('Allow updates from TGym in Android settings, then return and tap Update.')}</p>}
    {error && <p role="alert">{error}</p>}
    <Button variant="primary" disabled={busy} onClick={install}>{busy ? `${t('Working…')} ${percent}%` : t('Update')}</Button>
    {!manifest.mandatory && <Button disabled={busy} onClick={() => {dismissUpdate(manifest.version); close()}}>{t('Later')}</Button>}
  </>
}
let visibleVersion = null
export function showUpdateSheet(manifest) {
  if (visibleVersion === manifest.version) return
  visibleVersion = manifest.version
  useUI.getState().openSheet(close => <UpdateDialog manifest={manifest} close={close} />, {onClose: () => {visibleVersion = null}})
}
export async function manualUpdateCheck() {
  const result = await checkForAppUpdate({force:true})
  if (result.update) showUpdateSheet(result.update)
  else useUI.getState().toast(t('TGym is up to date.'))
}
export default function AppUpdate() {
  useEffect(() => {
    let gone = false, stopPush = () => {}
    const check = (force = false) => checkForAppUpdate({force}).then(r => {if (!gone && r.update) showUpdateSheet(r.update)}).catch(() => {})
    void check()
    void initializeUpdatePush(() => {if (!gone) void check(true)}).then(stop => {if (gone) stop(); else stopPush = stop})
    const visible = () => {if (document.visibilityState === 'visible') void check()}
    const online = () => {void check()}
    const interval = setInterval(visible, 4 * 60 * 60 * 1000)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('online', online)
    return () => {gone = true; stopPush(); clearInterval(interval); document.removeEventListener('visibilitychange',visible); window.removeEventListener('online',online)}
  }, [])
  return null
}
