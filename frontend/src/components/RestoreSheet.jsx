import { useState } from 'react'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Row, Switch, Button, TextField } from './ui.jsx'
import { backupToGoogleDrive, configuredGoogleClientId, forgetGoogleDriveToken, nativeDriveAuthAvailable, restoreFromGoogleDrive, synchronizeWithGoogleDrive, listGoogleDriveBackups } from '../lib/cloud-sync.js'
import { applyRemoteConflicts } from '../lib/state-merge.js'
import { saveImportUndo } from '../lib/import-undo.js'
import { backupChecksum, portableState } from '../lib/backup.js'
import { confirmSheet } from '../sheets.jsx'

export default function RestoreSheet({ authorize = action => action() }) {
  const S = useStore(s => s.S)
  const { update, replaceState } = useStore()
  const toast = useUI(s => s.toast)
  const [busy, setBusy] = useState(false)
  const nativeDrive = nativeDriveAuthAvailable()
  const guarded = action => { if (!busy) authorize(action) }
  const fail = error => {
    const authCodes = new Set(['auth_required', 'configuration_required', 'access_denied', 'popup_failed_to_open', 'popup_closed'])
    update(s => { s.cloudSync = { ...(s.cloudSync || {}), needsAuth: authCodes.has(error?.code), lastError: error?.message || 'Google Drive error' } }, false)
    toast(error?.code === 'configuration_required' ? t('Add a Google OAuth client ID first.') : t('Google Drive could not complete the operation.'))
  }
  const run = async action => {
    if (busy) return
    setBusy(true)
    try { await action() } catch (error) { fail(error) } finally { setBusy(false) }
  }
  const saveMerged = async next => {
    if (backupChecksum(portableState(useStore.getState().S)) !== backupChecksum(portableState(S))) throw new Error(t('Local data changed. Please synchronize again.'))
    saveImportUndo(useStore.getState().S)
    replaceState(next, false)
    const saved = await backupToGoogleDrive(next, { interactive: false, allowOverwrite: true })
    update(s => { s.cloudSync = { ...(s.cloudSync || {}), on: true, authorizedOnce: true, lastBackupAt: saved.at, lastAttemptAt: saved.at, lastFileId: saved.fileId, lastModifiedTime: saved.modifiedTime, needsAuth: false, lastError: null } }, false)
    toast(t('All devices are synchronized'))
  }
  const synchronize = () => run(async () => {
    const result = await synchronizeWithGoogleDrive(S, { interactive: true })
    if (!result.conflicts.length) { await saveMerged(result.merged); return }
    useUI.getState().openSheet(close => <>
      <h3>{t('Choose conflicting changes')}</h3>
      <p className="muted small">{t('{0} values were edited differently on both devices. Independent workouts and measurements have already been combined.', result.conflicts.length)}</p>
      <div className="sync-conflicts">{result.conflicts.slice(0, 12).map(item => <div key={item.path}><b>{item.path}</b><span>{String(item.local)} ↔ {String(item.remote)}</span></div>)}</div>
      <Button variant="primary" onClick={async () => { close(); await run(() => saveMerged(result.merged)) }}>{t('Keep changes from this device')}</Button>
      <div style={{ height: 8 }} /><Button onClick={async () => { close(); await run(() => saveMerged(applyRemoteConflicts(result.merged, result.conflicts))) }}>{t('Use changes from the other device')}</Button>
    </>)
  })
  const backup = () => run(async () => {
    const result = await backupToGoogleDrive(S, { interactive: true })
    update(s => { s.cloudSync = { ...(s.cloudSync || {}), on: true, authorizedOnce: true, lastBackupAt: result.at, lastFileId: result.fileId, lastModifiedTime: result.modifiedTime, needsAuth: false, lastError: null } }, false)
    toast(t('Google Drive backup saved'))
  })
  const restore = fileId => run(async () => {
    const result = await restoreFromGoogleDrive(S, { interactive: true, fileId })
    update(s => { s.cloudSync = { ...(s.cloudSync || {}), authorizedOnce: true, needsAuth: false, lastError: null } }, false)
    confirmSheet({ title: t('Restore Google Drive backup?'), message: t('This replaces all current TGym data on this device.'), confirmText: t('Restore'), danger: true,
      onConfirm: () => { saveImportUndo(S); replaceState(Object.assign(JSON.parse(JSON.stringify(DEF)), result.data), true); toast(t('Google Drive backup restored')) } })
  })
  const history = () => run(async () => {
    const files = await listGoogleDriveBackups(S)
    useUI.getState().openSheet(close => <><h3>{t('Backup history')}</h3>{!files.length && <p>{t('No cloud backup has been saved yet.')}</p>}<div className="list">{files.map(file => <Row key={file.id} title={file.name} subtitle={new Date(file.modifiedTime).toLocaleString()} accessory="chevron" onClick={() => { close(); restore(file.id) }} />)}</div></>)
  })
  const status = S.cloudSync?.lastBackupAt ? t('Last backup: {0}', new Date(S.cloudSync.lastBackupAt).toLocaleString())
    : S.cloudSync?.needsAuth ? t('Reconnect Google Drive to continue.') : t('No cloud backup has been saved yet.')
  return <><h3>{t('Restore')}</h3><div className="small muted" style={{ marginBottom: 8 }}>{t('Cloud backup status')}</div>
    <div className="list">
      <Row icon="cloud" iconTint="var(--blue)" title="Google Drive" subtitle={status} />
      <Row icon="history" iconTint="var(--blue)" title={t('Automatic Google Drive backup')} subtitle={t('Saves changes while online. Keeps ten daily restore points.')}><Switch disabled={busy} checked={!!S.cloudSync?.on} onChange={v => { if (!v) forgetGoogleDriveToken(); update(s => { s.cloudSync = { ...(s.cloudSync || {}), on: v, needsAuth: v ? s.cloudSync?.needsAuth : false } }) }} /></Row>
      <Row icon="reset" iconTint="var(--acc)" title={busy ? t('Working…') : t('Synchronize all devices')} accessory="chevron" onClick={() => guarded(synchronize)} />
      <Row icon="cloud" iconTint="var(--blue)" title={busy ? t('Working…') : t('Back up now')} accessory="chevron" onClick={() => guarded(backup)} />
      <Row icon="download" iconTint="var(--teal)" title={busy ? t('Working…') : t('Restore latest cloud backup')} subtitle={t('You will confirm before local data is replaced.')} accessory="chevron" onClick={() => guarded(() => restore())} />
      <Row icon="history" title={t('Backup history')} accessory="chevron" onClick={() => guarded(history)} />
      {!nativeDrive ? <div className="lrow" style={{ display: 'block' }}><div className="lrow-t" style={{ marginBottom: 7 }}>{t('Google OAuth client ID')}</div><TextField disabled={busy} value={S.cloudSync?.clientId || ''} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="123…apps.googleusercontent.com" onChange={e => update(s => { s.cloudSync = { ...(s.cloudSync || {}), clientId: e.target.value.trim(), authorizedOnce: false, needsAuth: true } }, false)} /><div className="small muted" style={{ marginTop: 7 }}>{configuredGoogleClientId(S) ? t('The client ID is public configuration; TGym never asks for or stores a Google password.') : t('One free Google Cloud OAuth client ID is required before Drive can authorize TGym.')}</div></div>
        : <Row icon="shield" iconTint="var(--teal)" title={t('Native Google authorization')} subtitle={t('Android uses Google Play services instead of opening sign-in inside the app. Configure package app.framegym.mobile and the certificate SHA-1 in Google Cloud once.')} />}
      {S.cloudSync?.lastError && <div className="small muted" role="status" style={{ padding: '8px 12px' }}>{S.cloudSync.lastError}</div>}
    </div></>
}

export const openRestoreSheet = authorize => useUI.getState().openSheet(() => <RestoreSheet authorize={authorize} />)
