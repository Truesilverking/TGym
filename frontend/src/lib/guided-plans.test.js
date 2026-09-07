import { describe, expect, it } from 'vitest'
import { GUIDED_PLANS, createGuidedPlan } from './guided-plans.js'

describe('guided plans', () => {
  it('offers PPL 3/6, Upper Lower and Full Body', () => {
    expect(GUIDED_PLANS.map(p => p.id)).toEqual(['ppl3', 'ppl6', 'upperLower', 'fullBody'])
  })
  it('creates fresh routines, schedules them and leaves choices to the user', () => {
    const a = createGuidedPlan('ppl3'), b = createGuidedPlan('ppl3')
    expect(a.routines).toHaveLength(3)
    expect(a.routines.every(r => r.ex.length === 0 && r.guideSlots.length > 0)).toBe(true)
    expect(Object.keys(a.week)).toHaveLength(3)
    expect(a.routines[0].id).not.toBe(b.routines[0].id)
    expect(a.routines[0].guideSlots[0]).toMatchObject({ sets: 3, repsMin: 6, reps: 10, restSec: 120 })
  })
  it('stores routine names and guided spaces in the language selected during onboarding', () => {
    const translated = createGuidedPlan('ppl3', value => `ES:${value}`)
    expect(translated.routines[0].name).toBe('ES:Push')
    expect(translated.routines[0].guideSlots[0].label).toBe('ES:Horizontal press')
    expect(translated.routines[0].guideSlots[0].hint).toBe('ES:Choose a chest press you can perform safely.')
  })
})
