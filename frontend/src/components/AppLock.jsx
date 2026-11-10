import { useEffect, useRef, useState } from 'react'
import { authenticateDeviceBiometry, biometricEnabled, deviceLockEnabled, lockConfig, recoverWithKey, verifyDevicePin } from '../lib/app-lock.js'
import { t, useLang } from '../lib/i18n.js'
import { observeAppVisibility } from '../lib/app-visibility.js'
import Icon from './Icon.jsx'
import './AppLock.css'

export default function AppLock({ children }) {
  useLang()
  const [locked, setLocked] = useState(() => deviceLockEnabled())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retryAt, setRetryAt] = useState(() => Number(lockConfig()?.blockedUntil) || 0)
  const [now, setNow] = useState(Date.now)
  const [lockCycle, setLockCycle] = useState(0)
  const input = useRef(null)
  const value = useRef('')
  const operation = useRef(null)
  const mounted = useRef(true)
  const biometricAttempted = useRef(false)
  const waiting = !recovery && now < retryAt
  const disabled = busy || biometricBusy
  const setValue = next => { value.current = next; setPin(next) }
  const current = token => mounted.current && operation.current === token
  const finish = token => {
    if (!current(token)) return
    operation.current = null
    setBusy(false); setBiometricBusy(false)
  }
  const unlock = () => { setValue(''); setVisible(false); setError(''); setLocked(false) }

  const tryBiometric = async () => {
    if (!biometricEnabled() || operation.current) return
    const token = {}; operation.current = token
    setValue(''); setVisible(false); setBiometricBusy(true); setError(''); setNotice(false)
    try {
      await authenticateDeviceBiometry()
      if (current(token)) unlock()
    } catch {
      // Cancellation returns to a usable PIN field without opening private data.
      if (current(token)) setNotice(true)
    } finally { finish(token) }
  }

  useEffect(() => {
    mounted.current = true
    let hiddenAt = null
    const onVisibility = active => {
      if (!active) {
        hiddenAt = Date.now()
        setValue(''); setVisible(false)
        if (deviceLockEnabled()) document.body.classList.add('framegym-private')
      } else {
        document.body.classList.remove('framegym-private')
        if (deviceLockEnabled() && hiddenAt !== null && Date.now() - hiddenAt >= 5 * 60 * 1000) {
          // An old verification cannot unlock a newly locked session.
          operation.current = null; biometricAttempted.current = false
          setBusy(false); setBiometricBusy(false); setLocked(true)
          setValue(''); setVisible(false); setRecovery(false); setError(''); setNotice(false)
          setRetryAt(Number(lockConfig()?.blockedUntil) || 0); setNow(Date.now())
          setLockCycle(cycle => cycle + 1)
        }
        hiddenAt = null
      }
    }
    const stopVisibility = observeAppVisibility(onVisibility)
    return () => {
      // StrictMode replays effects on the same instance. Retain the in-flight
      // prompt across that replay; mounted still rejects real unmount results.
      mounted.current = false
      stopVisibility()
      document.body.classList.remove('framegym-private')
    }
  }, [])
  useEffect(() => {
    if (!locked || !biometricEnabled() || biometricAttempted.current) return
    biometricAttempted.current = true
    tryBiometric()
  }, [locked, lockCycle])
  useEffect(() => {
    if (locked && !disabled) input.current?.focus({ preventScroll: true })
  }, [locked, recovery, disabled, waiting, lockCycle])
  useEffect(() => {
    if (!locked || retryAt <= Date.now()) return
    setNow(Date.now())
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time)
      if (time >= retryAt) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  }, [locked, retryAt])

  const verify = async (key, recover = recovery) => {
    if (operation.current || (recover ? key.length < 16 : key.length !== 4 || Date.now() < retryAt)) return
    const token = {}; operation.current = token
    setBusy(true); setError(''); setNotice(false)
    try {
      if (recover) {
        const ok = await recoverWithKey(key, () => current(token))
        if (!current(token)) return
        if (ok) { unlock(); return }
        setVisible(false); setError('Invalid recovery key'); return
      }
      const result = await verifyDevicePin(key)
      if (!current(token)) return
      if (result.ok) { unlock(); return }
      setValue(''); setVisible(false)
      setRetryAt(result.waitMs ? Date.now() + result.waitMs : 0); setNow(Date.now())
      setError(result.waitMs ? 'Try again in a moment.' : 'Incorrect PIN')
    } catch {
      if (current(token)) { setValue(''); setVisible(false); setError('Could not unlock. Try again.') }
    } finally { finish(token) }
  }
  const changePin = text => {
    if (operation.current || waiting) return
    const next = recovery ? text.toUpperCase().slice(0, 19) : text.replace(/\D/g, '').slice(0, 4)
    setError(''); setNotice(false); setValue(next)
    // Fresh input alone submits; rendering or returning to the app cannot retry.
    if (!recovery && next.length === 4) verify(next, false)
  }
  const switchMode = () => {
    if (operation.current) return
    setRecovery(mode => !mode); setValue(''); setError(''); setNotice(false); setVisible(false)
  }

  if (!locked) return children
  return <main id="app" className="lock-screen" data-nodrag="true">
    <form className={'lock-card' + (recovery ? ' is-recovery' : '')} onSubmit={e => { e.preventDefault(); verify(value.current) }} aria-labelledby="app-lock-title" aria-busy={disabled}>
      <header className="lock-heading">
        <div className="lock-brand-row"><span className="brand-mark">TGym<i aria-hidden="true" /></span><span className="lock-security-badge"><Icon name="lock" /><span>{t('App locked')}</span></span></div>
        <div className="lock-emblem" aria-hidden="true"><Icon name="lock" /></div>
        <h1 id="app-lock-title">{recovery ? t('Recover access') : t('Welcome back')}</h1>
        <p>{t('Your private training space')}</p>
      </header>
      <div className="lock-entry">
        <label htmlFor="app-unlock-key" className="lock-prompt">{recovery ? t('Enter your recovery key') : t('Enter your 4-digit PIN')}</label>
        <div className={'lock-key-field' + (recovery ? ' recovery' : '')}>
          <div className="lock-input-wrap">
            <input id="app-unlock-key" ref={input} aria-describedby={error ? 'app-unlock-error' : 'app-unlock-hint'} aria-invalid={!!error} disabled={disabled || waiting} autoComplete="off" autoCapitalize={recovery ? 'characters' : 'off'} spellCheck={false} className="lock-key-input" type={visible ? 'text' : 'password'} inputMode={recovery ? 'text' : 'none'} pattern={recovery ? undefined : '[0-9]{4}'} maxLength={recovery ? 19 : 4} value={pin} onChange={e => changePin(e.target.value)} />
            {!recovery && <div className="lock-pin-slots" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i} className={(pin.length > i ? 'filled' : '') + (pin.length === i && !disabled && !waiting ? ' current' : '')}>{pin.length > i ? visible ? pin[i] : <i /> : null}</span>)}</div>}
          </div>
          <button type="button" className="lock-visibility" aria-label={visible ? t('Hide key') : t('Show key')} aria-pressed={visible} disabled={disabled} onClick={() => { setVisible(v => !v); input.current?.focus({ preventScroll: true }) }}><Icon name={visible ? 'eyeSlash' : 'eye'} /></button>
        </div>
        <div className="lock-feedback">
          <p id="app-unlock-error" role={error ? 'alert' : undefined} className="lock-error">{error && t(error)}</p>
          <p id="app-unlock-hint" className="lock-hint" aria-live="polite">{busy ? t('Verifying…') : biometricBusy ? t('Waiting for biometrics…') : waiting ? t('Try again in {seconds}s').replace('{seconds}', Math.ceil((retryAt - now) / 1000)) : notice ? (biometricEnabled() ? t('Use your PIN or try biometrics again.') : t('Use PIN')) : recovery ? t('Your recovery key removes the app lock.') : !error ? t('Your PIN unlocks automatically') : ''}</p>
        </div>
      </div>
      {!recovery && <div className="lock-keypad" role="group" aria-label={t('PIN keypad')}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => <button key={digit} type="button" className="lock-digit" data-pin-digit={digit} disabled={disabled || waiting} onClick={() => changePin(value.current + digit)}>{digit}</button>)}
        {biometricEnabled() ? <button type="button" className="lock-key-action lock-biometric" aria-label={t('Use fingerprint or Face ID')} disabled={disabled} onClick={tryBiometric}><Icon name="fingerprint" /></button> : <span aria-hidden="true" />}
        <button type="button" className="lock-digit" data-pin-digit="0" disabled={disabled || waiting} onClick={() => changePin(value.current + '0')}>0</button>
        <button type="button" className="lock-key-action" aria-label={t('Delete last digit')} disabled={disabled || waiting || !pin.length} onClick={() => changePin(value.current.slice(0, -1))}><Icon name="backspace" /></button>
      </div>}
      {recovery && <button className="btn primary lock-submit" aria-busy={busy} disabled={disabled || pin.length < 16}>{t('Unlock')}</button>}
      <button type="button" className="btn ghost lock-recovery" disabled={disabled} onClick={switchMode}>{recovery ? <Icon name="chevronLeft" /> : <Icon name="key" />}{recovery ? t('Use PIN') : t('Use recovery key')}</button>
    </form>
  </main>
}
