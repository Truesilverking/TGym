import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrainingPaused } from './training-pause.js'
test('server respects inclusive start and exclusive resume dates',()=>{
 const s={trainingPauses:[{start:'2026-01-12',end:'2026-01-15'}]}
 assert.equal(isTrainingPaused(s,'2026-01-11'),false)
 assert.equal(isTrainingPaused(s,'2026-01-12'),true)
 assert.equal(isTrainingPaused(s,'2026-01-15'),false)
 assert.equal(isTrainingPaused({trainingPauses:[{start:'2026-02-30'}]},'2026-03-03'),false)
 assert.equal(isTrainingPaused({},'2026-01-12'),false)
})
