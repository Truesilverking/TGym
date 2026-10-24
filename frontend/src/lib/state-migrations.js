import { orderedRoutines } from './routine-order.js'
import { routineIds } from './daily-plan.js'
import { sessionOrigin } from './session-activity.js'
export const STATE_SCHEMA = 4
export const hasTrainingData = s => !!(s?.trainingStartDate || ['workouts','routines','bodyweight','measurements','inbody','trainingPauses'].some(k => s?.[k]?.length))
// Additive migration: never replace training arrays or discard unknown fields.
export function migrateState(input, { onboarded = false, toured = false, cloneInput = true } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid saved profile')
  if ((input.storageVersion || 0) > STATE_SCHEMA) throw new Error('This profile needs a newer version of TGym')
  // Persistence already owns a cloned draft. Avoid cloning the complete history
  // a second time on every edit; imports/boot retain the default isolation.
  const state = cloneInput ? structuredClone(input) : input
  if (state.active && !state.active.sessionOrigin) state.active.sessionOrigin = {...sessionOrigin(state.active,state.routines)}
  for (const key of ['week','dayPlan']) {
    if (state[key]) {
      const entries = Object.entries(state[key]).map(([day,value])=>[day,routineIds(value)])
      // Retain already-normalized collections on owned, shallow clock writes.
      // Recreating these references makes every schedule consumer recalculate.
      if (entries.some(([day,ids]) => !Array.isArray(state[key][day]) || ids.length !== state[key][day].length || ids.some((id,index) => id !== state[key][day][index]))) {
        state[key] = Object.fromEntries(entries)
      }
    }
  }
  const order = orderedRoutines(state).map(r => r.id)
  if (!Array.isArray(state.routineOrder) || order.length !== state.routineOrder.length || order.some((id,index)=>id !== state.routineOrder[index])) state.routineOrder = order
  state.storageVersion = STATE_SCHEMA
  state.hasCompletedOnboarding = state.hasCompletedOnboarding === true || onboarded || hasTrainingData(state)
  state.hasCompletedAppTour = state.hasCompletedAppTour === true || toured
  return state
}
