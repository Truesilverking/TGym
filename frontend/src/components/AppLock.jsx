import { useEffect, useRef, useState } from 'react'
import { authenticateDeviceBiometry, biometricEnabled, deviceLockEnabled, recoverWithKey, verifyDevicePin } from '../lib/app-lock.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

export default function AppLock({ children }) {
  const [locked, setLocked] = useState(() => deviceLockEnabled())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const biometricAttempted = useRef(false)
  const tryBiometric = async () => {
    if (!biometricEnabled() || biometricBusy) return
    setBiometricBusy(true); setError('')
    try { await authenticateDeviceBiometry(); setLocked(false); setPin('') }
    catch { /* cancellation or rejection leaves the TGym PIN available */ }
    finally { setBiometricBusy(false) }
  }
  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
        // Hide private training data from the operating system's recent-app snapshot.
        document.body.classList.add('framegym-private')
      } else {
        document.body.classList.remove('framegym-private')
        if (deviceLockEnabled() && hiddenAt && Date.now() - hiddenAt >= 5 * 60 * 1000) { biometricAttempted.current = false; setLocked(true); setPin('') }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility); document.body.classList.remove('framegym-private') }
  }, [])
  useEffect(() => {
    if (!locked || !biometricEnabled() || biometricAttempted.current) return
    biometricAttempted.current = true
    tryBiometric()
  }, [locked])
  if (!locked) return children
  const submit = async e => {
    e.preventDefault()
    if (recovery) {
      if (await recoverWithKey(pin)) { setLocked(false); setPin(''); setError(''); return }
      setError(t('Invalid recovery key')); return
    }
    const result = await verifyDevicePin(pin)
    if (result.ok) { setLocked(false); setPin(''); setError(''); return }
    setPin(''); setError(result.waitMs ? t('Try again in a moment.') : t('Incorrect PIN'))
  }
  return <div id="app"><form onSubmit={submit} className="narrow" style={{ paddingTop: '24vh', textAlign: 'center' }}>
    <Icon name="lock" style={{ fontSize: 42, color: 'var(--acc)', margin: '0 auto 14px' }} />
    <h1>TGym</h1><div className="muted" style={{ marginBottom: 18 }}>{recovery ? t('Enter your recovery key') : t('Enter your 4-digit PIN')}</div>
    <input autoFocus className="input" style={{ textAlign: 'center', fontSize: recovery ? 17 : 26, letterSpacing: recovery ? 2 : 12, maxWidth: 260 }} type="password" inputMode={recovery ? 'text' : 'numeric'} pattern={recovery ? undefined : '[0-9]{4}'} maxLength={recovery ? 19 : 4} value={pin} onChange={e => setPin(recovery ? e.target.value.toUpperCase().slice(0, 19) : e.target.value.replace(/\D/g, '').slice(0, 4))} />
    {error && <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>{error}</div>}
    <button className="btn primary" style={{ marginTop: 16, maxWidth: 260 }} disabled={recovery ? pin.length < 16 : pin.length !== 4}>{t('Unlock')}</button>
    {!recovery && biometricEnabled() && <button type="button" className="btn" style={{ marginTop: 8, maxWidth: 260 }} disabled={biometricBusy} onClick={tryBiometric}><Icon name="personCircle" /> {t('Use fingerprint or Face ID')}</button>}
    <button type="button" className="btn ghost" style={{ marginTop: 8, maxWidth: 260 }} onClick={() => { setRecovery(v => !v); setPin(''); setError('') }}>{recovery ? t('Use PIN') : t('Use recovery key')}</button>
  </form></div>
}
