// @vitest-environment happy-dom
import { it, expect, beforeEach } from 'vitest'
import { isPro, canCreateRoutine, validateProCode, setMembershipTier, PRO_LIMITS } from './membership.js'
import { useStore, DEF } from '../store/useStore.js'

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: null })
})

it('starts on free tier by default', () => {
  const S = useStore.getState().S
  expect(isPro(S)).toBe(false)
  expect(S.membership?.tier).toBe('free')
})

it('allows routine creation up to the free limit, then restricts', () => {
  const S = useStore.getState().S
  S.routines = [{ id: '1' }, { id: '2' }]
  expect(canCreateRoutine(S)).toBe(true)

  S.routines.push({ id: '3' })
  expect(canCreateRoutine(S)).toBe(false)

  // Once pro, can create unlimited
  setMembershipTier('pro')
  const SPro = useStore.getState().S
  expect(isPro(SPro)).toBe(true)
  expect(canCreateRoutine(SPro)).toBe(true)
})

it('validates offline promo and license codes correctly without server requests', () => {
  expect(validateProCode('TGYM-PRO')).toBe(true)
  expect(validateProCode('tgym-pro')).toBe(true)
  expect(validateProCode('ELITE')).toBe(true)
  expect(validateProCode('PRO-VIP99')).toBe(true)
  expect(validateProCode('INVALID-CODE')).toBe(false)
  expect(validateProCode('')).toBe(false)
})

it('activates and deactivates pro tier in store reactively', () => {
  setMembershipTier('pro', 'TGYM-PRO')
  expect(isPro()).toBe(true)
  expect(useStore.getState().S.membership.code).toBe('TGYM-PRO')

  setMembershipTier('free')
  expect(isPro()).toBe(false)
})
