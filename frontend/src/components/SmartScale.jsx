import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { beginScaleAuthorization, createScalePairingCode, disconnectScale, forgetScaleServer, pairScaleServer, scaleConnection, scaleRequest, syncScale } from '../lib/health/scale-connection.js'
import { MOBILE } from '../lib/mobile.js'
import { Button } from './ui.jsx'
import './SmartScale.css'

// Foreground-only polling is shared by Android and PWA. Background execution is
// neither needed nor promised; records sync after opening/resuming TGym online.
export function SmartScaleAutoSync() {
  const enabled = useStore(s => s.S.smartScaleConnection?.enabled)
  useEffect(() => {
    if (!enabled) return
    const sync = () => { if (!document.hidden && navigator.onLine !== false) syncScale({ automatic: true }).catch(() => {}) }
    sync()
    document.addEventListener('visibilitychange', sync); window.addEventListener('online', sync)
    const timer = setInterval(sync, 15 * 60000)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', sync); window.removeEventListener('online', sync) }
  }, [enabled])
  return null
}

export default function SmartScale() {
  const settings = useStore(s => s.S.smartScaleConnection)
  const user = useStore(s => s.user)
  const [pairingCode,setPairingCode] = useState('')
  const [status, setStatus] = useState(null), [paired, setPaired] = useState(false), [configure, setConfigure] = useState(false)
  const [base, setBase] = useState(''), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const mounted = useRef(true), locked = useRef(false)
  const refresh = async () => {
    try {
      const config = await scaleConnection()
      if (mounted.current) { setPaired(Boolean(config)); if (config) setBase(config.base) }
      const next = await scaleRequest('status'); if (mounted.current) setStatus(next)
    }
    catch { if (mounted.current) setStatus({ available: false }) }
  }
  useEffect(() => {
    mounted.current = true; refresh()
    const resume = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', resume)
    return () => { mounted.current = false; document.removeEventListener('visibilitychange', resume) }
  }, [])
  const run = async action => {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    try { await action() }
    catch { if (mounted.current) setError(t('Could not sync the scale. Check your server connection, Withings authorization and available storage. Your existing records are kept.')) }
    finally { await refresh(); locked.current = false; if (mounted.current) setBusy(false) }
  }
  const sync = () => run(async () => {
    const result = await syncScale()
    if (mounted.current && result) setMessage(t('Added {0} · updated {1} · unchanged {2}', result.added, result.updated, result.unchanged))
  })
  return <section className="card smart-scale" data-tour="smart-scale">
    <div className="row between"><h4>{t('Smart scale')}</h4><span className="dim small">Withings · {t(status?.connected ? 'Connected' : 'Not connected')}</span></div>
    <p className="dim small">{t('Import weight, body fat percentage and fat mass into Body Weight and body composition. New readings sync when you open or return to TGym online. Existing manual readings are kept.')}</p>
    {status?.configured === false && <p className="small" role="status">{t('Configure the Withings client ID, client secret and callback URL on your TGym server first. Credentials stay on the server.')}</p>}
    {status?.available === false && <p className="dim small">{t('Connect a TGym server to use the Withings API in the PWA or Android app. This connection only imports scale readings; it does not replace or synchronize your full profile.')}</p>}
    <div className="smart-scale-actions">
      {status?.configured && status.available !== false && !status.connected && <Button disabled={busy} onClick={() => run(beginScaleAuthorization)}>{t('Connect Withings')}</Button>}
      {status?.connected && <><Button disabled={busy} onClick={sync}>{t('Sync now')}</Button><Button disabled={busy} onClick={() => run(disconnectScale)}>{t('Disconnect')}</Button></>}
      <Button disabled={busy} onClick={() => setConfigure(v => !v)}>{t(configure ? 'Cancel' : 'API connection')}</Button>
    </div>
    {user && !MOBILE && <div className="smart-scale-pairing"><Button disabled={busy} onClick={()=>run(async()=>{const value=await createScalePairingCode();if(mounted.current)setPairingCode(value)})}>{t('Create pairing code')}</Button>{pairingCode && <p role="status"><b>{pairingCode}</b><br/>{t('Use this code within 5 minutes to connect another device to this server.')}</p>}</div>}
    {configure && <form className="smart-scale-config" onSubmit={e => { e.preventDefault(); run(async () => { await pairScaleServer(base, code); if (mounted.current) { setCode(''); setConfigure(false) } }) }}>
      <label>{t('TGym server URL')}<input className="input" type="url" autoComplete="url" placeholder="https://gym.example.com" value={base} disabled={busy} onChange={e => setBase(e.target.value)} required /></label>
      <label>{t('Pairing code')}<input className="input" value={code} autoComplete="off" maxLength={80} disabled={busy} onChange={e => setCode(e.target.value)} required /></label>
      <p className="dim small">{t('Generate a one-time pairing code in Health on your signed-in TGym server. Register its /api/withings/callback URL in your Withings developer account.')}</p>
      <Button type="submit" variant="primary" disabled={busy}>{t('Connect server')}</Button>
      {paired && <Button type="button" disabled={busy} onClick={() => run(async () => { await useStore.getState().updateAtomic(s => { s.smartScaleConnection = { ...s.smartScaleConnection, enabled: false } }); await forgetScaleServer(); setCode(''); setConfigure(false) })}>{t('Forget server')}</Button>}
    </form>}
    {status?.connected && <label className="smart-scale-auto"><input type="checkbox" checked={Boolean(settings?.enabled)} disabled={busy} onChange={e => run(async () => { const enabled = e.target.checked; await useStore.getState().updateAtomic(s => { s.smartScaleConnection = { ...s.smartScaleConnection, enabled } }); await useStore.getState().flushPersistence() })} />{t('Sync automatically on app open')}</label>}
    {settings?.lastSync > 0 && <p className="small dim">{t('Last sync')}: {new Date(settings.lastSync).toLocaleString()}</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>
}
