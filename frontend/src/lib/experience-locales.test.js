import { expect, it } from 'vitest'
import spanish from '../locales/es.js'
it('keeps the new Spanish report, profile, scale and tour copy above the English fallback',()=>{
 for(const [key,value] of Object.entries({
  'Smart scale':'Balanza inteligente',
  'Background':'Fondo',
  'Black':'Negro',
  'Creating report':'Creando reporte',
  'One year per PDF page.':'Un año por página PDF.',
  'Choose a nutrition day':'Elige un día de nutrición',
 }))expect(spanish[key]).toBe(value)
})
