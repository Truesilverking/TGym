import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { healthConnectWeightStatus, connectHealthConnectWeight, setHealthConnectWeightAutoSync, syncHealthConnectWeight, disconnectHealthConnectWeight, openHealthConnectWeightSettings } from '../lib/health/health-connect-weight-connection.js'
import { Button } from './ui.jsx'
import './SmartScale.css'

export function HealthConnectWeightAutoSync() {
  const enabled = useStore(s => s.S.scaleWeightSource === 'health-connect' && s.S.healthConnectWeight?.enabled && s.S.healthConnectWeight?.autoSync)
  useEffect(() => {
    if (!enabled) return
    const sync = () => { if (!document.hidden) syncHealthConnectWeight({ automatic: true }).catch(() => {}) }
    sync()
    document.addEventListener('visibilitychange', sync)
    const timer = setInterval(sync, 15 * 60000)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', sync) }
  }, [enabled])
  return null
}

export default function HealthConnectWeight() {
  const settings = useStore(s => s.S.healthConnectWeight)
  const selected = useStore(s => s.S.scaleWeightSource === 'health-connect')
  const [status, setStatus] = useState(null), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const mounted = useRef(true), locked = useRef(false)
  const refresh = async () => {
    try { const next = await healthConnectWeightStatus(); if (mounted.current) setStatus(next) }
    catch { if (mounted.current) setStatus({ available: false, granted: false, failed: true }) }
  }
  useEffect(() => {
    mounted.current = true
    refresh()
    const resume = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', resume)
    return () => { mounted.current = false; document.removeEventListener('visibilitychange', resume) }
  }, [])
  const run = async action => {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    try { await action() }
    catch { if (mounted.current) setError(t('Could not import weight. Check Health Connect weight access and available storage. Your existing records are kept.')) }
    finally { await refresh(); locked.current = false; if (mounted.current) setBusy(false) }
  }
  const sync = async () => {
    const result = await syncHealthConnectWeight()
    if (!mounted.current || !result) return
    setMessage(result.readings === 0
      ? t('No Withings weight readings found. Check that Withings can write Weight in Health Connect, then sync again.')
      : t('Added {0} · updated {1} · unchanged {2}', result.added, result.updated, result.unchanged))
  }
  if (Capacitor.getPlatform() !== 'android') return null
  const connected = Boolean(selected && settings?.enabled && status?.granted)
  return <section className="card smart-scale health-connect-weight" data-tour="health-connect-weight">
    <div className="row between"><h4>{t('Daily weight')}</h4><span className="dim small">Withings · Health Connect</span></div>
    <p className="dim small">{t('Import Withings weight from Health Connect on this phone. Today’s weight is reused in every workout. No TGym server is needed.')}</p>
    <p className="small" role="status">{t(!status ? 'Checking…' : status.failed ? 'Could not check Health Connect. Try again or log your weight manually.' : connected ? 'Connected' : status.available ? 'Not connected' : 'Weight import requires Android 14 or newer.')}</p>
    {status?.failed && <Button disabled={busy} onClick={() => run(refresh)}>{t('Retry')}</Button>}
    {status?.available && <>
      <p className="dim small">{t('In Withings, enable weight sharing with Health Connect. Then allow TGym to read Weight. Exercise access is separate.')}</p>
      <div className="smart-scale-actions">
        {connected ? <><Button disabled={busy} onClick={() => run(sync)}>{t('Sync now')}</Button><Button disabled={busy} onClick={() => run(disconnectHealthConnectWeight)}>{t('Disconnect')}</Button></>
          : <Button variant="primary" disabled={busy} onClick={() => run(async () => { const next = await connectHealthConnectWeight(); if (!next?.granted) throw Error('denied'); await sync() })}>{t('Allow weight access')}</Button>}
        <Button disabled={busy} onClick={() => run(openHealthConnectWeightSettings)}>{t('Manage permissions')}</Button>
      </div>
      {connected && <label className="smart-scale-auto"><input type="checkbox" checked={Boolean(settings?.autoSync)} disabled={busy} onChange={e => { const enabled = e.target.checked; run(() => setHealthConnectWeightAutoSync(enabled)) }} />{t('Sync automatically on app open')}</label>}
      {selected && settings?.enabled && !status.granted && <p className="small" role="status">{t('Weight access is not granted. Allow weight access again, or log your weight manually.')}</p>}
    </>}
    {settings?.lastSyncAt > 0 && <p className="small dim">{t('Last sync')}: {new Date(settings.lastSyncAt).toLocaleString()}</p>}
    <p className="dim small">{t('If today has no weight reading, TGym asks you to log it once. Imported readings and manual entries stay in your history after disconnecting.')}</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>
}
