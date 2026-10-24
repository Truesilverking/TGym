/* The editor only calls its ephemeral loopback session. No publishing endpoint exists. */
const token = location.hash.slice(1) || sessionStorage.getItem('tgym-catalog-session') || ''
if (token) sessionStorage.setItem('tgym-catalog-session', token)
history.replaceState(null, '', '/')
const el = id => document.getElementById(id)
let master, revision, selected, nextId, dirty = false, jsonDirty = false, fieldsDirty = false
const note = message => { el('notice').textContent = message }
const api = async (path, value, binary = false) => {
  const response = await fetch('/api/' + path, { method: value === undefined ? 'GET' : 'POST', headers: { 'X-TGym-Catalog-Token': token, ...(binary ? {} : { 'Content-Type': 'application/json' }) }, body: value === undefined ? undefined : binary ? value : JSON.stringify(value) })
  const data = await response.json()
  if (!response.ok) throw Error(data.error || 'Error local')
  return data
}
const run = action => async () => {
  const buttons = [...document.querySelectorAll('button')]
  buttons.forEach(button => { button.disabled = true })
  try { await action() } catch (error) { note(error.message) }
  finally { buttons.forEach(button => { button.disabled = false }) }
}
const current = () => master.exercises.find(ex => ex.id === selected)
const mark = () => { dirty = true }
function list() {
  const query = el('search').value.toLocaleLowerCase(), target = el('list')
  target.replaceChildren()
  for (const ex of master.exercises.filter(ex => (ex.n + ' ' + ex.id).toLocaleLowerCase().includes(query))) {
    const option = document.createElement('option'); option.value = ex.id; option.textContent = `${ex.n} [${ex.id}]`; option.selected = ex.id === selected; target.append(option)
  }
}
const imageBase = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/'
const gifBase = imageBase.replace('/images/', '/videos/')
function preview() {
  const ex = current(), panel = el('preview'); panel.replaceChildren()
  if (!ex) return
  const heading = document.createElement('h2'); heading.textContent = ex.n; panel.append(heading)
  for (const field of ['img', 'gif']) if (ex[field]) {
    const image = new Image(); image.alt = `${field === 'gif' ? 'Animación' : 'Imagen'}: ${ex.n}`; image.id = field === 'gif' ? 'animation' : 'poster'
    const info = document.createElement('p'); info.textContent = 'Comprobando decodificación…'
    image.onload = () => { info.textContent = `${field}: decodifica correctamente (${image.naturalWidth} × ${image.naturalHeight}).${field === 'gif' ? ' Confirma visualmente el movimiento.' : ''}` }
    image.onerror = () => { info.textContent = `${field}: no se pudo abrir el recurso. Comprueba archivo/conexión antes de publicar.` }
    image.src = ex[field].startsWith('media/') ? '/' + ex[field] + '?token=' + encodeURIComponent(token) : (field === 'gif' ? gifBase : imageBase) + ex[field]
    panel.append(image, info)
    if (field === 'gif' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const button = document.createElement('button'); button.textContent = 'Reproducir animación'; button.onclick = () => { image.style.display = 'block'; button.remove() }; panel.append(button)
    }
  }
  for (const text of ex.st || []) { const p = document.createElement('p'); p.textContent = text; panel.append(p) }
}
function select(id) {
  selected = id; const ex = current(); if (!ex) return
  el('name').value = ex.n; el('bodypart').value = ex.bp; el('equipment').value = ex.eq; el('target').value = ex.tg; el('steps').value = (ex.st || []).join('\n'); el('json').value = JSON.stringify(ex, null, 2); jsonDirty = false; fieldsDirty = false
  preview()
}
function applyFields() {
  const ex = current(), oldName = ex.n, name = el('name').value.trim()
  if (name !== oldName) ex.legacyNames = [...new Set([...(ex.legacyNames || []), oldName])]
  Object.assign(ex, { n: name, bp: el('bodypart').value.trim(), eq: el('equipment').value.trim(), tg: el('target').value.trim(), st: el('steps').value.split('\n').map(x => x.trim()).filter(Boolean) })
  el('json').value = JSON.stringify(ex, null, 2); jsonDirty = false; fieldsDirty = false; mark(); list(); preview()
}
function applyDefinition() {
  if (!jsonDirty) return
  const ex = JSON.parse(el('json').value)
  if (ex.id !== selected) throw Error('El ID es estable: crea un ejercicio nuevo para un movimiento diferente.')
  master.exercises[master.exercises.findIndex(item => item.id === selected)] = ex; mark(); list(); select(selected)
}
function metadata() { if (fieldsDirty) applyFields(); applyDefinition(); master.version = el('version').value.trim(); master.changes = el('changes').value.split('\n').map(x => x.trim()).filter(Boolean) }
async function load() {
  const data = await api('draft'); master = data.master; revision = data.revision; nextId = data.newId
  selected = master.exercises.some(ex => ex.id === selected) ? selected : master.exercises[0]?.id
  el('path').textContent = data.path; el('version').value = master.version; el('changes').value = master.changes.join('\n'); dirty = false; list(); select(selected); note('Borrador local cargado. Nada publicado.')
}
el('search').oninput = list
el('list').onchange = () => { try { const id = el('list').value; if (fieldsDirty) applyFields(); applyDefinition(); select(id) } catch (error) { el('list').value = selected; note(error.message) } }
for (const id of ['name', 'bodypart', 'equipment', 'target', 'steps']) { el(id).onchange = applyFields; el(id).oninput = () => { fieldsDirty = true; mark() } }
for (const id of ['version', 'changes']) el(id).oninput = mark
el('json').oninput = () => { jsonDirty = true; mark() }
el('new').onclick = run(async () => {
  if (fieldsDirty) applyFields()
  applyDefinition()
  const id = nextId; nextId = `official_${crypto.randomUUID()}`
  master.exercises.push({ id, n: 'Nuevo ejercicio', bp: '', eq: '', tg: '', sm: [], st: [] }); mark(); selected = id; el('search').value = ''; list(); select(id); note('Ejercicio nuevo pendiente de completar. Conserva su ID.')
})
el('apply').onclick = run(async () => { applyDefinition() })
el('upload').onchange = run(async () => {
  if (fieldsDirty) applyFields()
  applyDefinition()
  const file = el('upload').files[0]; if (!file) return
  const result = await api('media', file, true), field = el('mediafield').value
  if (field === 'gif' && !['gif', 'webp'].includes(result.type)) throw Error('La animación debe ser GIF o WebP.')
  current()[field] = result.ref; mark(); select(selected); el('upload').value = ''; note(`Recurso importado: ${result.width} × ${result.height}; ${result.bytes} bytes. Revisa la reproducción. Nada publicado.`)
})
el('save').onclick = run(async () => { metadata(); const data = await api('save', { master, revision }); revision = data.revision; dirty = false; note('Borrador validado y guardado. Copia anterior respaldada automáticamente. Nada publicado.') })
el('validate').onclick = run(async () => { metadata(); const result = await api('validate', master); note(result.errors.length ? result.errors.join('\n') : `Validación correcta. ${result.resources.length} recursos nuevos. Revisa visualmente claridad y movimiento antes de preparar.`) })
el('prepare').onclick = run(async () => {
  if (dirty) throw Error('Guarda el borrador antes de preparar el paquete.')
  const data = await api('prepare', {}); note(`Paquete para revisión: ${data.path}\nNo firmado. No autorizado para publicar. No se distribuyó a ningún usuario.`)
})
el('reload').onclick = run(async () => { if (!dirty || confirm('Descartar cambios locales sin guardar y recargar desde disco?')) await load() })
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = '' } })
load().catch(error => note(error.message))
