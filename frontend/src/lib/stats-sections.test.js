import { describe, expect, it } from 'vitest'
import { STATS_VIEW_SECTIONS as STATS_SECTIONS, normalizeStatsSections, normalizeStatsSectionOrder, statsSelectionOrder } from './stats-sections.js'

const ids = STATS_SECTIONS.map(([id]) => id)

describe('Stats selection order', () => {
  it('keeps valid selected IDs in their selection order and removes the retired recent card', () => {
    expect(normalizeStatsSections(['exercise', 'history', 'exercise', 'recent'])).toEqual(['exercise', 'history'])
    for (const invalid of [undefined, null, {}, 'history', [], ['recent']]) expect(normalizeStatsSections(invalid)).toEqual(['history', 'consistency'])
    expect(ids).not.toContain('recent')
  })
  it('respects an existing explicit order while preserving all valid selections', () => {
    expect(statsSelectionOrder(['history', 'bodyweight', 'exercise'], ['bodyweight', 'history', 'retired'])).toEqual(['bodyweight', 'history', 'exercise'])
    expect(statsSelectionOrder(['exercise', 'history'])).toEqual(['exercise', 'history'])
    expect(normalizeStatsSectionOrder(['bodyweight', 'recent', 'history', 'bodyweight'])).toEqual(['bodyweight', 'history', ...ids.filter(id => !['bodyweight', 'history'].includes(id))])
  })
})
