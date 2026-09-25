import { routineIds } from './daily-plan.js'
export const STATE_SCHEMA = 3
export const hasTrainingData = s => !!(s?.trainingStartDate || ['workouts','routines','bodyweight','measurements','inbody','trainingPauses'].some(k => s?.[k]?.length))
// Additive migration: never replace training arrays or discard unknown fields.
export function migrateState(input, { onboarded = false, toured = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid saved profile')
  if ((input.storageVersion || 0) > STATE_SCHEMA) throw new Error('This profile needs a newer version of TGym')
  const state = structuredClone(input)
  for (const key of ['week','dayPlan']) {
    if (state[key]) state[key] = Object.fromEntries(Object.entries(state[key]).map(([day,value])=>[day,routineIds(value)]))
  }
  state.storageVersion = STATE_SCHEMA
  state.hasCompletedOnboarding = state.hasCompletedOnboarding === true || onboarded || hasTrainingData(state)
  state.hasCompletedAppTour = state.hasCompletedAppTour === true || toured
  return state
}
