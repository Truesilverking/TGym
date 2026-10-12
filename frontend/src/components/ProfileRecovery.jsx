import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { exportProfileRecovery } from '../lib/profile-resources.js'
import { saveReportFile } from '../lib/report-file.js'
import { routineImportDiagnostics } from '../lib/routine-import-feedback.js'
import { Button } from './ui.jsx'

export default function ProfileRecovery({ error }) {
  const [busy, setBusy] = useState(false), [prepared, setPrepared] = useState(null), [failure, setFailure] = useState(null)
  const working = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const run = async operation => {
    if (working.current) return
    working.current = true; setBusy(true); setFailure(null)
    try { await operation() }
    catch (error) { if (mounted.current) setFailure(error) }
    finally { working.current = false; if (mounted.current) setBusy(false) }
  }
  const prepare = () => run(async () => {
    const raw = localStorage.getItem('gym_state_v1')
    if (raw == null) throw new Error('The saved profile text is unavailable')
    const bundle = await exportProfileRecovery(raw)
    const file = { name: 'TGym-profile-recovery.json', blob: new Blob([JSON.stringify(bundle)], { type: 'application/json' }) }
    if (mounted.current) setPrepared({ file, included: bundle.resources.length, unavailable: bundle.unavailable.length })
  })
  const retry = () => run(async () => { await useStore.getState().retryStorage() })
  return <main className="narrow card">
    <h1>{t('Saved data needs attention')}</h1>
    <p>{t('Your saved profile has not been overwritten. Export it before restoring a backup or opening a newer app version.')}</p>
    <p className="small dim">{t('This technical recovery bundle keeps the saved profile text and every readable offline resource. It lists missing resources and cannot be imported as a normal TGym backup.')}</p>
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
      <Button disabled={busy} onClick={prepare}>{t('Export saved data')}</Button>
      <Button disabled={busy} onClick={retry}>{t('Retry loading saved data')}</Button>
    </div>
    {prepared && <div>
      <p role="status">{t('Recovery bundle prepared: {0} resources included · {1} unavailable.', prepared.included, prepared.unavailable)}</p>
      <Button disabled={busy} onClick={() => run(() => saveReportFile(prepared.file))}>{t('Download recovery bundle')}</Button>
    </div>}
    {failure && <p role="alert">{t('Could not complete recovery. Your saved data was kept. Retry when storage access is available.')}</p>}
    <details className="profile-recovery-diagnostics"><summary>{t('Technical details')}</summary><pre className="small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 300, overflowY: 'auto' }}>{JSON.stringify(routineImportDiagnostics(failure || error, { stage: 'profile-recovery' }), null, 2)}</pre></details>
  </main>
}
