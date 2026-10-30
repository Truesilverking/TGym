import {expect,it} from 'vitest'
import {originalExerciseVariant,ORIGINAL_EXERCISE_VARIANTS} from './original-exercise-media.js'

it.each([
 ['Overhead Cable Triceps Extension','upper arms','overhead-cable-triceps-ez-bar'],
 ['Cross-Body Lat Pull-Around','back','cross-body-lat-pull-around'],
 ['Plate Pinch Hold','lower arms','plate-pinch-hold'],
 ['Bayesian Cable Curl','upper arms','bayesian-cable-curl'],
 ['Spanish Squat Hold','upper legs','spanish-squat-hold'],
 ['Nordic Hold','upper legs','nordic-hold'],['Dead Hang','back','dead-hang'],
 ['Bent Knee Calf Raise','lower legs','standing-bent-knee-calf-raise'],
 ['Hip Thrust en máquina o Smith','upper legs','machine-hip-thrust'],
 ['Captain’s Chair Knee Raise','waist','captains-chair-knee-raise'],
 ['Suitcase Carry','waist','suitcase-carry'],['Walking','cardio','walking-flat-ground'],
 ['Stepmill — Continuous Timed Walk','cardio','stepmill-continuous-walk'],
])('provides a display fallback for %s without changing its identity or records',(n,bp,key)=>{
 const ex={id:'kept-custom-id',custom:true,n,bp,desc:'',primaries:['kept']},before=structuredClone(ex)
 expect(originalExerciseVariant(ex)).toBe(key);expect(ex).toEqual(before)
 expect(ORIGINAL_EXERCISE_VARIANTS).toContain(key)
})
it('preserves uploaded media, unmatched names, builtins and contrary variants',()=>{
 for(const ex of [
  {n:'Walking',custom:false},{n:'Walking fast',custom:true,bp:'cardio'},
  {n:'Walking',custom:true,bp:'back'},
  {n:'Walking',custom:true,img:'data:image/gif;base64,kept'},
  {n:'Walking',custom:true,gif:'kept.gif'},
  {n:'Bent Knee Calf Raise',custom:true,desc:'Seated soleus raise'},
  {n:'Overhead Cable Triceps Extension',custom:true,eq:'rope'},
  {n:'Hip Thrust en máquina o Smith',custom:true,desc:'Solo Smith'},
 ])expect(originalExerciseVariant(ex)).toBeNull()
})
it('handles legacy punctuation without treating a different exercise as the same identity',()=>{
 expect(originalExerciseVariant({id:'one',custom:true,n:"CAPTAIN'S CHAIR KNEE RAISE"})).toBe('captains-chair-knee-raise')
 expect(originalExerciseVariant({id:'two',custom:true,n:'Captain’s Chair Straight Leg Raise'})).toBeNull()
})
