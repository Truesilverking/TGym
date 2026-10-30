// Display-only fallbacks for explicitly recognised custom exercise variants.
// Never merge identities or write artwork into the portable profile. User media
// always wins, and unrelated exercises keep their existing placeholder.
const normalise = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim()
const variants = [
 ['overhead-cable-triceps-ez-bar',['Overhead Cable Triceps Extension'],['upper arms']],
 ['cross-body-lat-pull-around',['Cross-Body Lat Pull-Around'],['back']],
 ['plate-pinch-hold',['Plate Pinch Hold'],['lower arms']],
 ['bayesian-cable-curl',['Bayesian Cable Curl'],['upper arms']],
 ['spanish-squat-hold',['Spanish Squat Hold'],['upper legs']],
 ['nordic-hold',['Nordic Hold'],['upper legs']],
 ['dead-hang',['Dead Hang'],['back']],
 ['standing-bent-knee-calf-raise',['Bent Knee Calf Raise','Standing Bent Knee Calf Raise'],['lower legs']],
 ['machine-hip-thrust',['Hip Thrust en máquina o Smith','Machine Hip Thrust','Hip Thrust en máquina'],['upper legs']],
 ['captains-chair-knee-raise',['Captain’s Chair Knee Raise'],['waist']],
 ['suitcase-carry',['Suitcase Carry'],['waist','lower arms']],
 ['walking-flat-ground',['Walking'],['cardio']],
 ['stepmill-continuous-walk',['Stepmill — Continuous Timed Walk'],['cardio']],
]
export const ORIGINAL_EXERCISE_VARIANTS = Object.freeze(variants.map(([key])=>key))
export function originalExerciseVariant(ex) {
 if(!ex?.custom || ex.img || ex.gif)return null
 const name=normalise(ex.n),part=normalise(ex.bp)
 const row=variants.find(([,names,parts])=>names.some(value=>normalise(value)===name)&&(!part||parts.includes(part)))
 if(!row)return null
 // A specific contrary variant takes precedence over a generic legacy title.
 const details=normalise([ex.eq,ex.desc,...(Array.isArray(ex.st)?ex.st:[])].filter(Boolean).join(' '))
 if(row[0]==='standing-bent-knee-calf-raise'&&/\b(seated|sentado|sentada|straight knee|rodilla extendida)\b/.test(details))return null
 if(row[0]==='overhead-cable-triceps-ez-bar'&&/\b(seated|sentado|sentada|rope|cuerda|straight bar|barra recta)\b/.test(details))return null
 if(row[0]==='machine-hip-thrust'&&/\b(smith only|solo smith|barbell|barra libre)\b/.test(details))return null
 return row[0]
}
