import { useEffect, useRef, useState } from 'react'
import { authenticateDeviceBiometry, biometricEnabled, deviceLockEnabled, recoverWithKey, verifyDevicePin } from '../lib/app-lock.js'
import { t, useLang } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import AuthIdentity from './AuthIdentity.jsx'
import './AppLock.css'

export default function AppLock({ children }) {
  useLang()
  const [locked, setLocked] = useState(() => deviceLockEnabled())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const biometricAttempted = useRef(false)
  const tryBiometric = async () => {
    if (!biometricEnabled() || biometricBusy || busy) return
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
        if (deviceLockEnabled() && hiddenAt && Date.now() - hiddenAt >= 5 * 60 * 1000) { biometricAttempted.current = false; setLocked(true); setPin(''); setVisible(false) }
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
  useEffect(() => {
    // Verification temporarily disables the field. Focus it only after React
    // enables it again, so retrying an incorrect key keeps the keyboard usable.
    if (locked && error && !busy && !biometricBusy) input.current?.focus()
  }, [locked, error, busy, biometricBusy])
  if (!locked) return children
  const submit = async e => {
    e.preventDefault()
    if (busy || biometricBusy) return
    setBusy(true)
    try {
    if (recovery) {
      if (await recoverWithKey(pin)) { setLocked(false); setPin(''); setError(''); return }
      setError(t('Invalid recovery key')); return
    }
    const result = await verifyDevicePin(pin)
    if (result.ok) { setLocked(false); setPin(''); setError(''); return }
    setPin(''); setError(result.waitMs ? t('Try again in a moment.') : t('Incorrect PIN'))
    } catch { setError(t('Could not unlock. Try again.')) }
    finally { setBusy(false) }
  }
  return <div id="app" className="lock-screen"><form onSubmit={submit} className="narrow auth-panel auth-lock">
    <AuthIdentity locked />
    <label htmlFor="app-unlock-key" className="auth-prompt">{recovery ? t('Enter your recovery key') : t('Enter your 4-digit PIN')}</label>
    <div className="lock-key-field"><input id="app-unlock-key" ref={input} aria-describedby={error ? 'app-unlock-error' : undefined} aria-invalid={!!error} disabled={busy || biometricBusy} autoFocus autoComplete="off" spellCheck={false} className={'input auth-code' + (recovery ? ' recovery' : '')} type={visible ? 'text' : 'password'} inputMode={recovery ? 'text' : 'numeric'} pattern={recovery ? undefined : '[0-9]{4}'} maxLength={recovery ? 19 : 4} value={pin} onChange={e => {setError('');setPin(recovery ? e.target.value.toUpperCase().slice(0, 19) : e.target.value.replace(/\D/g, '').slice(0, 4))}} />
      <button type="button" className="iconbtn lock-visibility" aria-label={visible ? t('Hide key') : t('Show key')} aria-pressed={visible} disabled={busy || biometricBusy} onClick={() => {setVisible(v => !v);input.current?.focus()}}><Icon name={visible ? 'eyeSlash' : 'eye'} /></button>
    </div>
    {!recovery && <div className="auth-pin-progress" aria-hidden="true">{[0,1,2,3].map(i=><span key={i} className={pin.length>i?'filled':''} />)}</div>}
    <div id="app-unlock-error" role={error ? 'alert' : undefined} className="lock-error">{error}</div>
    <button className="btn primary lock-submit" aria-busy={busy} disabled={busy || biometricBusy || (recovery ? pin.length < 16 : pin.length !== 4)}>{t('Unlock')}</button>
    {!recovery && biometricEnabled() && <button type="button" className="btn" style={{ marginTop: 8, maxWidth: 260 }} disabled={biometricBusy || busy} onClick={tryBiometric}><Icon name="personCircle" /> {t('Use fingerprint or Face ID')}</button>}
    <button type="button" className="btn ghost" style={{ marginTop: 8, maxWidth: 320 }} disabled={busy || biometricBusy} onClick={() => { setRecovery(v => !v); setPin(''); setError(''); setVisible(false); input.current?.focus() }}>{recovery ? t('Use PIN') : t('Use recovery key')}</button>
  </form></div>
}
