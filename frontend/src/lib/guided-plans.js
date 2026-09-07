import { uid } from './format.js'

const slot = (label, hint, bp, sets = 3, repsMin = 8, reps = 12, restSec = 90) =>
  ({ id: uid(), label, hint, bp, sets, repsMin, reps, restSec })

const push = () => [
  slot('Horizontal press', 'Choose a chest press you can perform safely.', 'chest', 3, 6, 10, 120),
  slot('Vertical press', 'Choose an overhead press for the shoulders.', 'shoulders', 3, 8, 12, 90),
  slot('Chest isolation', 'Choose a fly or similar chest movement.', 'chest', 3, 10, 15, 60),
  slot('Lateral deltoids', 'Choose a lateral raise variation.', 'shoulders', 3, 12, 20, 60),
  slot('Triceps', 'Choose one triceps isolation exercise.', 'upper arms', 3, 10, 15, 60)
]
const pull = () => [
  slot('Vertical pull', 'Choose a pull-up or pulldown variation.', 'back', 3, 6, 10, 120),
  slot('Horizontal pull', 'Choose a rowing movement.', 'back', 3, 8, 12, 90),
  slot('Upper-back accessory', 'Choose a rear-delt or upper-back movement.', 'shoulders', 3, 10, 15, 60),
  slot('Biceps', 'Choose one curl variation.', 'upper arms', 3, 8, 12, 60)
]
const legs = () => [
  slot('Knee-dominant movement', 'Choose a squat, leg press or similar movement.', 'upper legs', 3, 6, 10, 120),
  slot('Hip-dominant movement', 'Choose a hinge such as a Romanian deadlift.', 'upper legs', 3, 8, 12, 120),
  slot('Quadriceps isolation', 'Choose a knee-extension movement.', 'upper legs', 3, 10, 15, 60),
  slot('Hamstring isolation', 'Choose a leg-curl movement.', 'upper legs', 3, 10, 15, 60),
  slot('Calves', 'Choose a calf-raise variation.', 'lower legs', 3, 10, 20, 60)
]
const upper = () => [push()[0], pull()[0], pull()[1], push()[1], push()[3], pull()[3]]
const lower = () => legs()
const full = () => [legs()[0], push()[0], pull()[1], legs()[1], push()[3], pull()[3]]

const routine = (name, emoji, guideSlots) => ({ id: uid(), name, emoji, ex: [], guideSlots, prog: 'double' })

export const GUIDED_PLANS = [
  { id: 'ppl3', family: 'PPL', title: 'Push / Pull / Legs · 3 days', description: 'One push, pull and leg session each week.', days: [1, 3, 5], make: () => [routine('Push', 'barbell', push()), routine('Pull', 'pullup', pull()), routine('Legs', 'legs', legs())] },
  { id: 'ppl6', family: 'PPL', title: 'Push / Pull / Legs · 6 days', description: 'Each movement pattern is trained twice per week.', days: [1, 2, 3, 4, 5, 6], make: () => [routine('Push A', 'barbell', push()), routine('Pull A', 'pullup', pull()), routine('Legs A', 'legs', legs()), routine('Push B', 'barbell', push()), routine('Pull B', 'pullup', pull()), routine('Legs B', 'legs', legs())] },
  { id: 'upperLower', family: 'Upper / Lower', title: 'Upper / Lower · 4 days', description: 'Two upper-body and two lower-body sessions.', days: [1, 2, 4, 5], make: () => [routine('Upper A', 'arm', upper()), routine('Lower A', 'legs', lower()), routine('Upper B', 'arm', upper()), routine('Lower B', 'legs', lower())] },
  { id: 'fullBody', family: 'Full Body', title: 'Full Body · 3 days', description: 'Three balanced sessions covering the whole body.', days: [1, 3, 5], make: () => [routine('Full Body A', 'figureStrength', full()), routine('Full Body B', 'figureStrength', full()), routine('Full Body C', 'figureStrength', full())] }
]

export function createGuidedPlan(id, translate = value => value) {
  const spec = GUIDED_PLANS.find(p => p.id === id)
  if (!spec) return null
  // Routine names and guided placeholders are user-visible saved data. Translate
  // them at creation time so onboarding never stores an English plan in Spanish.
  const routines = spec.make().map(item => ({
    ...item,
    name: translate(item.name),
    guideSlots: (item.guideSlots || []).map(guide => ({
      ...guide,
      label: translate(guide.label),
      hint: translate(guide.hint),
    })),
  }))
  return { routines, week: Object.fromEntries(spec.days.map((day, i) => [day, routines[i].id])) }
}
