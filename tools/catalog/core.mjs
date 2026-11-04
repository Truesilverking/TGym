// Local draft tooling only. This module never reads a TGym profile or publishes remotely.
import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { readFile, writeFile, mkdir, rename, copyFile, lstat, realpath, access } from 'node:fs/promises'
import { resolve, relative, isAbsolute, join } from 'node:path'

export const SCHEMA = 1
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024
export const MAX_BUNDLE_BYTES = 96 * 1024 * 1024
export const MAX_ANIMATION_PIXELS = 64 * 1024 * 1024
export const IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/'
export const GIF_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/'
const fields = new Set(['id', 'n', 'bp', 'eq', 'tg', 'mg', 'sm', 'st', 'img', 'gif', 'primaries', 'secondaries', 'legacyNames', 'desc'])
const scalarFields = ['id', 'n', 'bp', 'eq', 'tg', 'mg', 'img', 'gif', 'desc']
const listFields = ['sm', 'st', 'primaries', 'secondaries', 'legacyNames']
const calculationFields = ['bp', 'eq', 'tg', 'mg', 'sm', 'primaries', 'secondaries']
const mediaRef = /^media\/[a-f0-9]{64}\.(png|jpg|gif|webp)$/
const baselineRef = /^[A-Za-z0-9_-]+\.(jpg|png|gif|webp)$/
const safeId = /^(?:[A-Za-z0-9][A-Za-z0-9_-]{0,95})$/
export const hash = value => createHash('sha256').update(value).digest('hex')
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const json = value => JSON.stringify(value, null, 2) + '\n'

export function safePath(root, name) {
  const path = resolve(root, name), rel = relative(resolve(root), path)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Path must remain inside the draft directory')
  return path
}

export async function regularFile(root, name) {
  const path = safePath(root, name), info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) throw Error('Expected a regular local file')
  const base = await realpath(root), actual = await realpath(path), rel = relative(base, actual)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('File leaves the draft directory')
  return path
}

// A lexical child path is insufficient on Windows: a pre-existing junction can
// redirect a write outside the draft. Refuse directory aliases before writing.
export async function checkedDirectory(root, name = '') {
  await mkdir(root, { recursive: true })
  const rootInfo = await lstat(root)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw Error('Draft root must be a regular directory, not an alias')
  const base = await realpath(root)
  if (!name) return base
  const target = safePath(base, name), parts = relative(base, target).split(/[\\/]/)
  let directory = base
  for (const part of parts) {
    directory = join(directory, part)
    try { await mkdir(directory) } catch (error) { if (error.code !== 'EEXIST') throw error }
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Draft directories cannot be symbolic links or junctions')
    const actual = await realpath(directory), rel = relative(base, actual)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Directory leaves the draft root')
  }
  return directory
}

export function inspectMedia(bytes) {
  const b = Buffer.from(bytes)
  if (!b.length || b.length > MAX_MEDIA_BYTES) throw Error('Media must contain 1 byte to 8 MiB')
  let type, width, height, animated = false
  if (b.length >= 33 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.toString('ascii', 12, 16) === 'IHDR') {
    type = 'png'; width = b.readUInt32BE(16); height = b.readUInt32BE(20)
  } else if (b.length >= 14 && /GIF8[79]a/.test(b.toString('ascii', 0, 6))) {
    type = 'gif'; width = b.readUInt16LE(6); height = b.readUInt16LE(8)
    let offset = 13 + (b[10] & 128 ? 3 * (2 ** ((b[10] & 7) + 1)) : 0), frames = 0, pixels = 0, trailer = false
    const blocks = () => { while (offset < b.length) { const count = b[offset++]; if (!count) return; offset += count; if (offset > b.length) throw Error('Truncated GIF'); } throw Error('Truncated GIF') }
    while (offset < b.length) {
      const tag = b[offset++]
      if (tag === 0x3b) { trailer = true; break }
      if (tag === 0x21) { if (offset >= b.length) throw Error('Truncated GIF'); offset++; blocks() }
      else if (tag === 0x2c) {
        if (offset + 9 > b.length) throw Error('Truncated GIF')
        const left = b.readUInt16LE(offset), top = b.readUInt16LE(offset + 2), fw = b.readUInt16LE(offset + 4), fh = b.readUInt16LE(offset + 6), packed = b[offset + 8]
        // Decoders may retain a composited full canvas for every small delta frame.
        pixels += width * height
        if (!fw || !fh || left + fw > width || top + fh > height || ++frames > 2000 || pixels > MAX_ANIMATION_PIXELS) throw Error('Invalid or excessive GIF frames')
        offset += 9 + (packed & 128 ? 3 * (2 ** ((packed & 7) + 1)) : 0)
        if (offset >= b.length || b[offset] < 2 || b[offset] > 8) throw Error('Invalid GIF image data')
        offset++; blocks()
      } else throw Error('Invalid GIF block')
    }
    if (!trailer || !frames || offset !== b.length) throw Error('Incomplete GIF or unexpected trailing data')
    animated = frames > 1
  } else if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' && b.readUInt32LE(4) + 8 === b.length) {
    type = 'webp'
    const chunk = b.toString('ascii', 12, 16)
    if (chunk === 'VP8X' && b.length >= 30) { animated = !!(b[20] & 2); width = 1 + b.readUIntLE(24, 3); height = 1 + b.readUIntLE(27, 3) }
    else if (chunk === 'VP8 ' && b.length >= 30 && b.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) { width = b.readUInt16LE(26) & 0x3fff; height = b.readUInt16LE(28) & 0x3fff }
    else if (chunk === 'VP8L' && b.length >= 25 && b[20] === 47) { const size = b.readUInt32LE(21); width = 1 + (size & 0x3fff); height = 1 + ((size >>> 14) & 0x3fff) }
    else throw Error('Invalid WebP dimensions')
    let offset = 12, pixels = 0, frames = 0
    while (offset < b.length) {
      if (offset + 8 > b.length) throw Error('Truncated WebP chunk')
      const tag = b.toString('ascii', offset, offset + 4), size = b.readUInt32LE(offset + 4), start = offset + 8
      if (start + size > b.length) throw Error('Truncated WebP chunk')
      if (tag === 'ANMF') {
        if (size < 16) throw Error('Invalid WebP animation frame')
        const fw = 1 + b.readUIntLE(start + 6, 3), fh = 1 + b.readUIntLE(start + 9, 3)
        pixels += width * height
        if (fw > width || fh > height || ++frames > 2000 || pixels > MAX_ANIMATION_PIXELS) throw Error('Invalid or excessive WebP frames')
      }
      offset = start + size + (size % 2)
    }
    if (offset !== b.length || (animated && !frames)) throw Error('Incomplete WebP animation')
  } else if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[b.length - 2] === 255 && b[b.length - 1] === 217) {
    type = 'jpg'
    let offset = 2
    while (offset + 4 < b.length) {
      if (b[offset++] !== 255) throw Error('Invalid JPEG marker')
      while (b[offset] === 255) offset++
      const marker = b[offset++], size = b.readUInt16BE(offset)
      if (size < 2 || offset + size > b.length) throw Error('Invalid JPEG segment')
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (size < 8) throw Error('Invalid JPEG frame')
        height = b.readUInt16BE(offset + 3); width = b.readUInt16BE(offset + 5); break
      }
      if (marker === 218) break
      offset += size
    }
  } else throw Error('Use a PNG, JPEG, GIF or WebP file with a matching file signature')
  if (!width || !height || width > 4096 || height > 4096 || width * height > 16777216) throw Error('Image dimensions must be 1–4096 pixels per side')
  return { type, width, height, animated, bytes: b.length, sha256: hash(b) }
}

export function validateMaster(master, baseline) {
  const errors = []
  if (!object(master) || master.schema !== SCHEMA || !Array.isArray(master.exercises)) return ['Unsupported draft schema']
  if (Object.keys(master).some(key => !['schema', 'version', 'changes', 'exercises'].includes(key))) errors.push('Unknown draft fields; personal profile data are not accepted')
  if (!/^\d+\.\d+\.\d+$/.test(master.version || '')) errors.push('Version must be major.minor.patch')
  if (!Array.isArray(master.changes) || !master.changes.length || master.changes.length > 100 || master.changes.some(x => typeof x !== 'string' || !x.trim() || x.length > 1000)) errors.push('Provide 1–100 nonempty change descriptions (up to 1000 characters each)')
  if (master.exercises.length > 10000) errors.push('Too many exercises')
  const old = new Map(baseline.map(ex => [ex.id, ex])), seen = new Set()
  for (const ex of master.exercises) {
    if (!object(ex)) { errors.push('Exercise must be an object'); continue }
    const id = ex.id
    if (typeof id !== 'string' || !safeId.test(id) || ['constructor', 'prototype', '__proto__'].includes(id)) errors.push('Unsafe exercise ID')
    if (seen.has(id)) errors.push(`Duplicate exercise ID: ${id}`)
    seen.add(id)
    if (Object.keys(ex).some(key => !fields.has(key))) errors.push(`${id}: unknown/private exercise fields`)
    for (const key of scalarFields) if (ex[key] != null && (typeof ex[key] !== 'string' || ex[key].length > (key === 'desc' ? 10000 : 1000) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(ex[key]))) errors.push(`${id}: invalid ${key}`)
    for (const key of ['n', 'bp', 'eq', 'tg']) if (typeof ex[key] !== 'string' || !ex[key].trim()) errors.push(`${id}: ${key} is required`)
    for (const key of listFields) if (ex[key] != null && (!Array.isArray(ex[key]) || ex[key].length > 100 || ex[key].some(value => typeof value !== 'string' || !value.trim() || value.length > 2000))) errors.push(`${id}: invalid ${key}`)
    const previous = old.get(id)
    if (!previous && !/^official_[a-f0-9-]{36}$/.test(id || '')) errors.push(`${id}: new IDs must use the generated official_ UUID namespace`)
    if (previous) {
      for (const key of calculationFields) if (JSON.stringify(ex[key]) !== JSON.stringify(previous[key])) errors.push(`${id}: ${key} changes existing calculation metadata; requires a separately reviewed migration`)
      if (ex.n !== previous.n && (!ex.legacyNames?.includes(previous.n) || previous.legacyNames?.some(name => !ex.legacyNames.includes(name)))) errors.push(`${id}: retain all previous names in legacyNames`)
    }
    for (const key of ['img', 'gif']) if (ex[key] && !mediaRef.test(ex[key]) && !(previous?.[key] === ex[key] && baselineRef.test(ex[key]))) errors.push(`${id}: ${key} must reference an imported content-addressed file or the unchanged baseline resource`)
    if (mediaRef.test(ex.gif || '') && !/\.(gif|webp)$/.test(ex.gif)) errors.push(`${id}: animation must be GIF or WebP`)
  }
  for (const id of old.keys()) if (!seen.has(id)) errors.push(`${id}: existing IDs cannot be removed`)
  return errors
}

export async function initDraft(root, baseline) {
  await checkedDirectory(root)
  const master = { schema: SCHEMA, version: '1.0.0', changes: ['Baseline imported from the current bundled official catalogue; no user profile data.'], exercises: structuredClone(baseline) }
  const errors = validateMaster(master, baseline)
  if (errors.length) throw Error(errors.join('\n'))
  await writeFile(join(root, 'baseline.json'), json(baseline), { flag: 'wx' })
  await writeFile(join(root, 'master.json'), json(master), { flag: 'wx' })
  return master
}

export async function readDraft(root) {
  const master = JSON.parse(await readFile(await regularFile(root, 'master.json'), 'utf8'))
  const baseline = JSON.parse(await readFile(await regularFile(root, 'baseline.json'), 'utf8'))
  return { master, baseline }
}

export async function validateFiles(root, master, baseline) {
  const errors = validateMaster(master, baseline), resources = []
  if (errors.length) return { errors, resources }
  const refs = [...new Set(master.exercises.flatMap(ex => [ex.img, ex.gif]).filter(value => mediaRef.test(value || '')))]
  let bytes = 0
  for (const ref of refs) {
    try {
      const path = await regularFile(root, ref), buffer = await readFile(path), metadata = inspectMedia(buffer)
      if (ref !== `media/${metadata.sha256}.${metadata.type}`) throw Error('Resource hash or extension differs')
      resources.push({ path: ref, ...metadata }); bytes += metadata.bytes
    } catch (error) { errors.push(`${ref}: ${error.message}`) }
  }
  if (bytes > MAX_BUNDLE_BYTES) errors.push('New resources exceed the 96 MiB preparation limit')
  return { errors, resources }
}

export async function saveDraft(root, master) {
  const { baseline } = await readDraft(root), result = await validateFiles(root, master, baseline)
  if (result.errors.length) throw Error(result.errors.join('\n'))
  const backups = await checkedDirectory(root, 'backups')
  await copyFile(await regularFile(root, 'master.json'), join(backups, `${Date.now()}-${randomUUID()}.json`), constants.COPYFILE_EXCL)
  const temporary = join(root, `master-${randomUUID()}.tmp`)
  await writeFile(temporary, json(master), { flag: 'wx' })
  await rename(temporary, join(root, 'master.json'))
  return result
}

export async function importMedia(root, bytes) {
  const metadata = inspectMedia(bytes), ref = `media/${metadata.sha256}.${metadata.type}`
  await checkedDirectory(root, 'media')
  try { await writeFile(safePath(root, ref), bytes, { flag: 'wx' }) }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    if (hash(await readFile(await regularFile(root, ref))) !== metadata.sha256) throw Error('Existing resource differs from its hash')
  }
  return { ref, ...metadata }
}

export async function prepareBundle(root) {
  const { master, baseline } = await readDraft(root), result = await validateFiles(root, master, baseline)
  if (result.errors.length) throw Error(result.errors.join('\n'))
  const prepared = await checkedDirectory(root, 'prepared'), output = join(prepared, master.version)
  // Immutable preparation: a version cannot silently be overwritten after review.
  try { await access(output); throw Error('This version has already been prepared; choose a new version') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const stage = await checkedDirectory(root, `prepared/.staging-${randomUUID()}`)
  await checkedDirectory(stage, 'media')
  for (const resource of result.resources) {
    const target = safePath(stage, resource.path)
    await copyFile(await regularFile(root, resource.path), target, constants.COPYFILE_EXCL)
    if (hash(await readFile(target)) !== resource.sha256) throw Error('Resource changed while preparing; retry with a stable draft')
  }
  const catalogue = { schema: SCHEMA, version: master.version, changes: master.changes, exercises: master.exercises.map(ex => ({ ...ex, ...(ex.img && !mediaRef.test(ex.img) ? { img: IMAGE_BASE + ex.img } : {}), ...(ex.gif && !mediaRef.test(ex.gif) ? { gif: GIF_BASE + ex.gif } : {}) })) }
  const content = json(catalogue)
  await writeFile(join(stage, 'catalog.json'), content)
  await writeFile(join(stage, 'review.json'), json({ schema: SCHEMA, version: master.version, published: false, createdAt: new Date().toISOString(), catalogue: { path: 'catalog.json', sha256: hash(content), bytes: Buffer.byteLength(content) }, changes: master.changes, resources: result.resources, authorization: 'Not signed or authorized for publication. No runtime channel is configured.' }))
  await rename(stage, output)
  return output
}

export function previewMedia(ex, key) {
  const value = ex?.[key]
  if (!value) return ''
  return mediaRef.test(value) ? '/' + value : (key === 'gif' ? GIF_BASE : IMAGE_BASE) + value
}
