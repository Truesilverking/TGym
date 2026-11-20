// @vitest-environment happy-dom
import {expect,it} from 'vitest'
import {motionSnapshot} from './motion-snapshot.js'

it('captures only visible content without duplicating identities or live handlers',()=>{
 const source=document.createElement('section')
 source.innerHTML='<h2 id="title">Title</h2><button id="action" data-tour="action"><svg aria-hidden="true"><path/></svg>Export</button><section inert data-app-pane="hidden"><p>Hidden draft</p></section><div hidden>Hidden card</div>'
 let presses=0;source.querySelector('button').addEventListener('click',()=>presses++)
 const picture=motionSnapshot(source)
 expect(picture.inert).toBe(true);expect(picture.getAttribute('aria-hidden')).toBe('true')
 expect(picture.textContent).toBe('TitleExport');expect(picture.querySelector('[id],[data-app-pane],[data-tour]')).toBeNull()
 expect(picture.querySelector('svg path')).not.toBeNull();picture.querySelector('button').click();expect(presses).toBe(0)
 expect(source.querySelector('#action')).not.toBeNull();expect(source.textContent).toContain('Hidden draft')
})
it('copies current form presentation and conceals password contents',()=>{
 const source=document.createElement('div')
 source.innerHTML='<input value="old"><input type="password"><textarea>old</textarea><select><option>A</option><option>B</option></select>'
 const fields=source.querySelectorAll('input,textarea,select');fields[0].value='Draft';fields[1].value='private';fields[2].value='Notes';fields[3].value='B'
 const copies=motionSnapshot(source).querySelectorAll('input,textarea,select')
 expect([...copies].map(node=>node.value)).toEqual(['Draft','','Notes','B']);expect(fields[1].value).toBe('private')
})
it('keeps SVG paint references local without duplicate live IDs and permits file controls',()=>{
 const source=document.createElement('div')
 source.innerHTML='<input type="file"><svg><defs><linearGradient id="paint"/></defs><path fill="url(#paint)"/></svg>'
 const picture=motionSnapshot(source),gradient=picture.querySelector('linearGradient')
 expect(gradient.id).not.toBe('paint');expect(picture.querySelector('path').getAttribute('fill')).toBe(`url(#${gradient.id})`)
 expect(source.querySelector('linearGradient').id).toBe('paint');expect(picture.querySelector('input').type).toBe('file')
})
