import { isWarmupRow, modeForSet } from './workout-model.js'
import { hasWorkoutActivity as activity } from '../../../api/session-activity.js'
export { startSessionOrigin, sessionOrigin } from '../../../api/session-activity.js'

// Reuse workout row semantics with the shared persisted-session rules.
export const hasWorkoutActivity = workout => activity(workout, { isWarmupRow, modeForSet })
