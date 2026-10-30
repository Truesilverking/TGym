import { expect, it } from 'vitest'
import { rebaseEmptyApiProfile } from './api-bootstrap.js'

it('keeps a locally reordered slide deck when the first remote profile arrives without merging preference IDs as records',()=>{
 const before={unit:'kg',measurementUnit:'cm',statsPageOrder:['history','consistency']}
 const current={...before,statsPageOrder:['report','bodyweight','history']}
 const remote={unit:'kg',measurementUnit:'cm',statsPageOrder:['records','consistency'],workouts:[{id:'remote-kept'}]}
 const snapshot=structuredClone({before,current,remote})
 const merged=rebaseEmptyApiProfile(before,current,remote,{unit:'kg',measurementUnit:'cm'})
 expect(merged.statsPageOrder).toEqual(current.statsPageOrder)
 expect(merged.workouts).toEqual(remote.workouts)
 expect({before,current,remote}).toEqual(snapshot)
})
