import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, BIO } from '../lib/api.js'
import { hasData } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { useState, useRef, useEffect } from 'react'
import AuthIdentity from '../components/AuthIdentity.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { parseTGymJson } from '../lib/json-import.js'

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState, loadConfig } = useStore()
  const config = useStore(s => s.config)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const inviteOnly = !!config?.invite_only
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  // Boot already fetched this; retry here only if that attempt failed, so the invite field still
  // appears on an instance whose config arrived late rather than never.
  useEffect(() => { loadConfig() }, [loadConfig])
  const go = async () => {
    const n = name.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Registration failed')) }
  }
  return <>
    <h3>{t('Create your profile')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Pick a name, then confirm with {0}. The passkey is saved in your device — no password needed.', BIO)}</div>
    <input ref={ref} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    {inviteOnly && <>
      <div style={{ height: 10 }} />
      <input className="input" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
      <div className="dim small" style={{ marginTop: 6 }}>{t('This app is invite-only — enter the code you were given.')}</div>
    </>}
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={go}>{t('Create passkey')}</Button>
  </>
}

export default function Login() {
  const { setUser, pullState, setGuest, replaceState } = useStore()
  const config = useStore(s => s.config)
  const canGuest = guestAllowed(config)
  const fileRef = useRef(null)

  const signIn = async () => {
    try {
      const u = await passkeyLogin()
      setUser(u)
      await pullState()
      useUI.getState().toast(t('Welcome back, {0}', u.name))
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        useUI.getState().toast(e.message || t('Sign-in failed'))
      }
    }
  }

  const restoreBackup = e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const imported = parseTGymJson(rd.result)
        if (imported.kind === 'backup') {
          replaceState(imported.data, false)
          setGuest(true)
          useUI.getState().toast(t('Backup imported'))
        } else {
          useUI.getState().toast(t('Invalid backup file'))
        }
      } catch {
        useUI.getState().toast(t('Could not read that backup'))
      }
    }
    rd.readAsText(f)
  }

  const head = <AuthIdentity />

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return (
    <div className="narrow auth-panel">
      {head}
      <div className="muted" style={{ marginBottom: 20 }}>{t('Live demo — everything stays in this browser.')}</div>
      <div className="auth-modes">
        <div className="auth-mode-card featured">
          <div className="auth-mode-top">
            <span className="auth-mode-title">
              <Icon name="sparkles" style={{ color: 'var(--acc)' }} />
              {t('Interactive demo')}
            </span>
            <span className="auth-badge">{t('Instant')}</span>
          </div>
          <div className="auth-mode-desc">
            {t('Try TGym right in your browser with sample data. Nothing is sent to any server.')}
          </div>
          <Button variant="primary" icon="play" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
        </div>
      </div>
      <div className="dim small" style={{ marginTop: 14, lineHeight: 1.6 }}>
        <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  return (
    <div className="narrow auth-panel">
      {head}
      <div className="muted" style={{ marginBottom: 18 }}>{t('Your workouts. Your weights. Your profile.')}</div>

      <div className="auth-modes">
        {/* Local mode first: private, offline, no server load */}
        {canGuest && (
          <div className="auth-mode-card featured">
            <div className="auth-mode-top">
              <span className="auth-mode-title">
                <Icon name="shield" style={{ color: 'var(--acc)' }} />
                {t('Private local mode')}
              </span>
              <span className="auth-badge">
                <Icon name="bolt" style={{ width: 12, height: 12 }} />
                {t('Recommended')}
              </span>
            </div>
            <div className="auth-mode-desc">
              {t('Your routines, loads and history are stored only on this device. Fast, works offline and needs no server.')}
            </div>
            <Button variant="primary" icon="play" onClick={() => setGuest(true)}>
              {t('Start training')}
            </Button>
          </div>
        )}

        {/* Optional server profile */}
        <div className="auth-mode-card">
          <div className="auth-mode-top">
            <span className="auth-mode-title">
              <Icon name="cloud" style={{ color: 'var(--blue)' }} />
              {t('Server profile')}
            </span>
          </div>
          <div className="auth-mode-desc">
            {t('Sync and back up your workouts to your own server with a passkey or biometrics. No passwords.')}
          </div>

          {webauthnOK() ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="tinted" icon="person" onClick={signIn}>
                {t('Sign in with passkey')}
              </Button>
              <Button variant="ghost" icon="sparkles" onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>
                {t('Create new profile')}
              </Button>
            </div>
          ) : (
            <div className="small muted" style={{ textAlign: 'left', lineHeight: 1.4 }}>
              {canGuest
                ? t("This browser doesn't support passkeys — you can still use openGym locally on this device.")
                : t("This browser doesn't support passkeys, and this instance requires an account. Try a browser or device with passkey support.")}
            </div>
          )}
        </div>
      </div>

      {/* Restore a backup */}
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <button type="button" className="auth-restore-btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" />
          <span>{t('Have a backup? Restore a file')}</span>
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={restoreBackup} />
      </div>

      <div className="auth-trust-pill">
        <Icon name="shield" style={{ width: 13, height: 13, color: 'var(--acc)' }} />
        <span>{t('Local-first: in local mode your data never leaves this device')}</span>
      </div>
    </div>
  )
}
