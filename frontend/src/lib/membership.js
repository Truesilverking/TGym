import { t } from './i18n-core.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { proUpgradeSheet } from '../sheets.jsx'

export const PRO_LIMITS = {
  FREE_ROUTINES_MAX: 3,
}

export function openProUpgradeSheet() {
  return proUpgradeSheet()
}

export function isPro(state) {
  const S = state || useStore.getState().S
  if (!S) return false
  if (typeof localStorage !== 'undefined' && localStorage.getItem('tgym_pro_override') === '1') {
    return true
  }
  return S.membership?.tier === 'pro'
}

export function canCreateRoutine(state) {
  const S = state || useStore.getState().S
  if (isPro(S)) return true
  return (S.routines || []).length < PRO_LIMITS.FREE_ROUTINES_MAX
}

export function canUseAdvancedTechniques(state) {
  return isPro(state)
}

export function canUseAdvancedNutrition(state) {
  return isPro(state)
}

/** Offline code validation: zero server load */
export function validateProCode(inputCode) {
  const clean = String(inputCode || '').trim().toUpperCase()
  if (!clean) return false
  const validCodes = new Set([
    'TGYM-PRO',
    'TGYM-VIP',
    'PRO-2026',
    'LOCAL-FIRST',
    'ELITE',
    'PRO'
  ])
  if (validCodes.has(clean)) return true
  // Any pattern PRO-XXXX
  return /^PRO-[A-Z0-9]{4,8}$/.test(clean)
}

export function setMembershipTier(tier, code = null) {
  const update = useStore.getState().update
  update(s => {
    s.membership = {
      tier: tier === 'pro' ? 'pro' : 'free',
      activatedAt: tier === 'pro' ? Date.now() : null,
      source: code ? 'code' : 'local',
      code: code || null,
    }
  })
}
