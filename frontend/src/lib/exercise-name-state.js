// The browser store binds its live snapshot after initialization. Keeping this reader
// separate lets locale readers and pure naming helpers load without a DOM or store.
let readState = () => ({})
export const bindExerciseNameState = reader => { readState = reader }
export const exerciseNameState = () => readState()
