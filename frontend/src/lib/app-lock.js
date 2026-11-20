import { Capacitor } from '@capacitor/core'
const KEY = 'framegym_device_lock_v1'
const enc = new TextEncoder()
const sameCredential = (a, b) => !!a && !!b && a.salt === b.salt && a.hash === b.hash && a.recoveryHash === b.recoveryHash

const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('')
async function digest(pin, salt) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${pin}:TGym`)))
}
export function lockConfig() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}
export async function setDevicePin(pin) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must contain 4 digits')
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  const raw = hex(crypto.getRandomValues(new Uint8Array(8))).toUpperCase()
  const recoveryKey = raw.match(/.{1,4}/g).join('-')
  localStorage.setItem(KEY, JSON.stringify({ salt, hash: await digest(pin, salt), recoveryHash: await digest(recoveryKey, salt), timeoutMin: 5, attempts: 0, blockedUntil: 0 }))
  return recoveryKey
}
export function removeDevicePin() { localStorage.removeItem(KEY) }
export const biometricEnabled = () => !!lockConfig()?.biometric
export function setBiometricEnabled(enabled) {
  const cfg = lockConfig()
  if (!cfg) return false
  localStorage.setItem(KEY, JSON.stringify({ ...cfg, biometric: !!enabled }))
  return true
}
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
const fromB64url = text => Uint8Array.from(atob(String(text).replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
async function isNativePlatform() {
  try { return Capacitor.isNativePlatform() } catch { return false }
}
export async function checkDeviceBiometry() {
  try {
    if (await isNativePlatform()) {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
      const info = await BiometricAuth.checkBiometry()
      return { available: !!info.isAvailable, type: info.biometryType, reason: info.reason || '' }
    }
    const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials
    const available = supported && (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable || await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    return { available: !!available, type: 'platform', reason: available ? '' : 'No platform authenticator' }
  } catch (error) {
    return { available: false, type: 0, reason: error?.message || '' }
  }
}
export async function enrollDeviceBiometry() {
  if (await isNativePlatform()) return authenticateDeviceBiometry()
  const cfg = lockConfig()
  if (!cfg) throw new Error('Create the TGym PIN first.')
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))
  const credential = await navigator.credentials.create({ publicKey: {
    challenge,
    rp: { name: 'TGym' },
    user: { id: userId, name: 'framegym-local', displayName: 'TGym' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
    timeout: 60000,
    attestation: 'none',
  } })
  if (!credential?.rawId) throw new Error('Biometric enrollment was not completed')
  const latest = lockConfig()
  if (!sameCredential(latest, cfg)) throw new Error('Device lock changed during enrollment')
  localStorage.setItem(KEY, JSON.stringify({ ...latest, webCredentialId: b64url(credential.rawId) }))
  return true
}
export async function authenticateDeviceBiometry() {
  const cfg = lockConfig()
  const stillAllowed = () => {
    const latest = lockConfig()
    if (cfg ? !sameCredential(latest, cfg) || (cfg.biometric && !latest.biometric) : latest !== null) throw new Error('Device lock changed during authentication')
    return latest
  }
  if (await isNativePlatform()) {
    const { AndroidBiometryStrength, BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
    await BiometricAuth.authenticate({
      reason: 'Desbloquear TGym',
      cancelTitle: 'Usar PIN de TGym',
      allowDeviceCredential: false,
      iosFallbackTitle: 'Usar PIN de TGym',
      androidTitle: 'Desbloquear TGym',
      androidSubtitle: 'Usa tu huella o reconocimiento facial',
      androidConfirmationRequired: false,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    })
    stillAllowed()
    return true
  }
  const id = cfg?.webCredentialId
  if (!id) throw new Error('Biometric authentication is not configured')
  const credential = await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [{ type: 'public-key', id: fromB64url(id) }],
    userVerification: 'required',
    timeout: 60000,
  } })
  if (!credential) throw new Error('Biometric authentication was not completed')
  if (stillAllowed()?.webCredentialId !== id) throw new Error('Biometric credential changed during authentication')
  return true
}
export async function verifyDevicePin(pin, now = Date.now()) {
  const cfg = lockConfig()
  if (!cfg) return { ok: true }
  if (now < (cfg.blockedUntil || 0)) return { ok: false, waitMs: cfg.blockedUntil - now }
  const matches = await digest(pin, cfg.salt) === cfg.hash
  const latest = lockConfig()
  // Another tab or pending operation may have changed the lock while hashing.
  // Never replace new credentials or lose an intervening attempt/preference.
  if (!sameCredential(latest, cfg)) return { ok: false }
  if (now < (latest.blockedUntil || 0)) return { ok: false, waitMs: latest.blockedUntil - now }
  if (matches) {
    localStorage.setItem(KEY, JSON.stringify({ ...latest, attempts: 0, blockedUntil: 0 }))
    return { ok: true }
  }
  const attempts = (latest.attempts || 0) + 1
  const delay = attempts < 3 ? 0 : Math.min(300000, 5000 * (2 ** (attempts - 3)))
  localStorage.setItem(KEY, JSON.stringify({ ...latest, attempts, blockedUntil: now + delay }))
  return { ok: false, waitMs: delay }
}
export async function recoverWithKey(key, canApply = () => true) {
  const cfg = lockConfig()
  if (!cfg?.recoveryHash) return false
  const normalized = String(key || '').trim().toUpperCase()
  if (await digest(normalized, cfg.salt) !== cfg.recoveryHash) return false
  if (!canApply() || !sameCredential(lockConfig(), cfg)) return false
  removeDevicePin()
  return true
}
export const deviceLockEnabled = () => !!lockConfig()
