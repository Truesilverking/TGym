import {useState} from 'react'
import {useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {t,exerciseNameFor} from '../lib/i18n.js'
import {nav} from '../lib/nav.js'
import {routineMusclePreview,MUSCLE_NAME} from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import {Button} from './ui.jsx'

export default function RoutineMusclePreview({routineId,close}) {
  const S=useStore(s=>s.S),[selected,setSelected]=useState(null)
  const routine=S.routines.find(r=>r.id===routineId)
  if(!routine)return <p>{t('Muscle information unavailable')}</p>
  const preview=routineMusclePreview(routine)
  const group=(title,muscles)=>muscles.length>0&&<section><h4>{t(title)}</h4><div className="routine-muscle-tags">{muscles.map(m=><button key={m} className={'tag'+(selected===m?' acc':'')} onClick={()=>setSelected(m)}>{t(MUSCLE_NAME[m])}</button>)}</div></section>
  return <div className="routine-muscle-preview"><h3>{routine.name}</h3><p>{t('Muscles trained')}</p>
    <BodyMap load={preview.load} body={S.body} selected={selected} onMuscle={setSelected} />
    {group('Primary muscles',preview.primary)}{group('Secondary muscles',preview.secondary)}{group('Muscles trained',preview.other)}
    {!Object.keys(preview.load).length&&<p className="muted">{t('Muscle information unavailable')}</p>}
    {selected&&<section><h4>{t('Exercises for this muscle')} · {t(MUSCLE_NAME[selected])}</h4><ul>{(preview.exercises[selected]||[]).map(ex=><li key={ex.id}>{exerciseNameFor(ex)||ex.n||ex.id}</li>)}</ul></section>}
    <p>{t('{0} exercises',routine.ex?.length||0)}</p><Button onClick={()=>{close();nav('/plan/r/'+routine.id)}}>{t('View Routine')}</Button>
  </div>
}
export const routineMuscleSheet=routineId=>useUI.getState().openSheet(close=><RoutineMusclePreview routineId={routineId} close={close} />)
