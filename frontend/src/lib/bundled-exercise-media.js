import {originalExerciseVariant} from './original-exercise-media.js'

const posters=import.meta.glob('../assets/exercises-original/*-poster.png',{eager:true,query:'?url',import:'default'})
const animations=import.meta.glob('../assets/exercises-original/*.gif',{eager:true,query:'?url',import:'default'})
export function bundledExerciseMedia(ex) {
 const key=originalExerciseVariant(ex)
 if(!key)return null
 const img=posters[`../assets/exercises-original/${key}-poster.png`],gif=animations[`../assets/exercises-original/${key}.gif`]
 return img&&gif?{img,gif}:null
}
