import { expect, it } from 'vitest'
import english from './english-fallback.js'

const packs = import.meta.glob('../locales/*.js', { eager: true, import: 'default' })
const keys = ['{0} weeks of consistency!', 'You are building a lasting habit. Keep it going!', 'Next milestone: {0} weeks', 'Close celebration', '1 week', '{0} weeks', '1 month', '{0} months', '1 day', "Training days in this streak", "Complete today's workout to keep your streak.", "No workout scheduled today — streak preserved.", "Training paused — streak preserved.", "Streak interrupted. Complete a workout to start a new one.", "Complete a workout to start a streak.", "Completed training days, counted once per day. Scheduled rest days preserve the streak.", "Week and month equivalents use completed training days: 7 per week and 30 per month."]
const placeholders = text => (text.match(/\{\d+\}/g) || []).sort()

it.each(Object.entries(packs))('translates all recognition and period strings in %s', (name, pack) => {
  for (const key of keys) {
    expect(pack[key], key).toBeTruthy()
    expect(pack[key], key).not.toBe(english[key])
    expect(placeholders(pack[key]), key).toEqual(placeholders(key))
  }
})

it('uses the requested Spanish title and next target', () => {
  const es = packs['../locales/es.js']
  expect(es['{0} weeks of consistency!'].replace('{0}', '2')).toBe('¡2 semanas de constancia!')
  expect(es['Next milestone: {0} weeks'].replace('{0}', '4')).toBe('Siguiente hito: 4 semanas')
})
