import {it,expect} from 'vitest'
import es from '../locales/es.js'
it('keeps Spanish overrides ahead of English fallback for settings and effort labels',()=>{expect(es.Failure).toBe('Fallo');expect(es['Sound preferences']).not.toBe('Sound preferences');expect(es.Help).toBe('Ayuda');expect(es['Activities and health data']).toBe('Actividades y datos de salud')})
