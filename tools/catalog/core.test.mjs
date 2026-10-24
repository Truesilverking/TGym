import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { request } from 'node:http'
import { initDraft, readDraft, validateMaster, saveDraft, importMedia, inspectMedia, prepareBundle, hash, safePath, validateFiles } from './core.mjs'

const baseline = [{ id: '0001', n: 'Original movement', bp: 'back', eq: 'cable', tg: 'lats', sm: [], st: ['Original instruction.'], img: '0001-example.jpg', gif: '0001-example.gif' }]
const staticGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')
// A second image descriptor preserves two independent frames without re-encoding pixels.
const animatedGif = Buffer.concat([staticGif.subarray(0, -1), staticGif.subarray(19, -1), Buffer.from([59])])
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'tgym-catalog-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return { root, master: await initDraft(root, baseline) }
}

test('preserves IDs, calculation metadata and former names; rejects private/profile data', async t => {
  const { master } = await fixture(t)
  assert.deepEqual(validateMaster(master, baseline), [])
  assert.match(validateMaster({ ...master, exercises: [] }, baseline).join('\n'), /cannot be removed/)
  const renamed = structuredClone(master); renamed.exercises[0].n = 'Updated name'
  assert.match(validateMaster(renamed, baseline).join('\n'), /previous names/)
  renamed.exercises[0].legacyNames = [baseline[0].n]
  assert.deepEqual(validateMaster(renamed, baseline), [])
  renamed.exercises[0].bp = 'chest'
  assert.match(validateMaster(renamed, baseline).join('\n'), /calculation metadata/)
  assert.match(validateMaster({ ...master, workouts: [] }, baseline).join('\n'), /personal profile/)
  const privateRow = structuredClone(master); privateRow.exercises[0].libraryNote = 'Private note'
  assert.match(validateMaster(privateRow, baseline).join('\n'), /private exercise fields/)
  assert.match(validateMaster({ ...master, exercises: [...master.exercises, ...master.exercises] }, baseline).join('\n'), /Duplicate/)
})

test('validates GIF structure, preserves animation bytes and deduplicates identical resources', async t => {
  const { root } = await fixture(t)
  assert.equal(inspectMedia(staticGif).animated, false)
  assert.equal(inspectMedia(animatedGif).animated, true)
  const a = await importMedia(root, animatedGif), b = await importMedia(root, animatedGif)
  assert.equal(a.ref, b.ref)
  assert.deepEqual(await readdir(join(root, 'media')), [a.ref.slice(6)])
  assert.deepEqual(await readFile(join(root, a.ref)), animatedGif)
  assert.throws(() => inspectMedia(animatedGif.subarray(0, -1)), /Incomplete GIF/)
  const largeCanvas = Buffer.concat([staticGif.subarray(0, 19), ...Array(5).fill(staticGif.subarray(19, -1)), Buffer.from([59])])
  largeCanvas.writeUInt16LE(4096, 6); largeCanvas.writeUInt16LE(4096, 8)
  assert.throws(() => inspectMedia(largeCanvas), /excessive GIF frames/)
  assert.throws(() => inspectMedia(Buffer.from('<svg></svg>')), /file signature/)
  assert.throws(() => inspectMedia(Buffer.alloc(8 * 1024 * 1024 + 1)), /8 MiB/)
  assert.throws(() => safePath(root, '../outside'), /remain inside/)
})

test('backups precede atomic saves; invalid/missing/corrupted resources preserve last valid master and allow retry', async t => {
  const { root, master } = await fixture(t), original = await readFile(join(root, 'master.json'))
  const media = await importMedia(root, animatedGif)
  const next = structuredClone(master); next.exercises[0].gif = media.ref
  await saveDraft(root, next)
  const backups = await readdir(join(root, 'backups'))
  assert.equal(backups.length, 1)
  assert.deepEqual(await readFile(join(root, 'backups', backups[0])), original)
  const committed = await readFile(join(root, 'master.json'))
  await rm(join(root, media.ref))
  await assert.rejects(saveDraft(root, next), /ENOENT/)
  assert.deepEqual(await readFile(join(root, 'master.json')), committed)
  await importMedia(root, animatedGif)
  await saveDraft(root, next)
  await writeFile(join(root, media.ref), staticGif)
  assert.match((await validateFiles(root, next, baseline)).errors.join('\n'), /hash or extension/)
  await assert.rejects(prepareBundle(root), /hash or extension/)
})

test('prepares one immutable unsigned version with portable hash references and no invented exercises', async t => {
  const { root, master } = await fixture(t)
  const media = await importMedia(root, animatedGif); master.exercises[0].gif = media.ref
  await saveDraft(root, master)
  const output = await prepareBundle(root), review = JSON.parse(await readFile(join(output, 'review.json'))), catalogue = JSON.parse(await readFile(join(output, 'catalog.json')))
  assert.equal(review.published, false)
  assert.equal(catalogue.exercises.length, baseline.length)
  assert.equal(catalogue.exercises[0].id, baseline[0].id)
  assert.match(catalogue.exercises[0].img, /^https:\/\/cdn\.jsdelivr\.net\/gh\/.*@[a-f0-9]{40}\//)
  assert.equal(review.catalogue.sha256, hash(await readFile(join(output, 'catalog.json'))))
  assert.deepEqual(await readFile(join(output, media.ref)), animatedGif)
  await assert.rejects(prepareBundle(root), /already been prepared/)
})

test('refuses directory junctions before writing media/backups/prepared output', async t => {
  const { root, master } = await fixture(t), outside = await mkdtemp(join(tmpdir(), 'tgym-catalog-outside-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  for (const directory of ['media', 'backups', 'prepared']) {
    const link = join(root, directory)
    await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir')
    const operation = directory === 'media' ? importMedia(root, staticGif) : directory === 'backups' ? saveDraft(root, master) : prepareBundle(root)
    await assert.rejects(operation, /symbolic links or junctions/)
    assert.deepEqual(await readdir(outside), [])
    await rm(link, { recursive: true, force: true })
  }
})

test('loopback editor rejects unauthenticated/cross-origin/stale requests and has no publish endpoint', async t => {
  const { root } = await fixture(t)
  const child = spawn(process.execPath, [new URL('./admin.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), 'serve', '--root', root], { stdio: ['ignore', 'pipe', 'pipe'] })
  t.after(() => child.kill())
  let output = ''
  const session = await new Promise((done, fail) => {
    child.stdout.on('data', data => { output += data; const match = output.match(/Local editor: (http:\/\/127\.0\.0\.1:\d+)\/#([a-f0-9]+)/); if (match) done({ origin: match[1], token: match[2] }) })
    child.on('error', fail); child.once('exit', code => { if (code) fail(Error(`Editor exited ${code}`)) })
    setTimeout(() => fail(Error('Editor did not start')), 10000).unref()
  })
  const headers = { 'X-TGym-Catalog-Token': session.token, 'Content-Type': 'application/json' }
  assert.equal((await fetch(session.origin + '/api/draft')).status, 403)
  assert.equal((await fetch(session.origin + '/api/draft', { headers: { ...headers, 'X-TGym-Catalog-Token': 'é'.repeat(64) } })).status, 403)
  assert.equal((await fetch(session.origin + '/api/draft', { headers: { ...headers, Origin: 'https://example.invalid' } })).status, 403)
  const invalidHostStatus = await new Promise((done, fail) => {
    const req = request(session.origin + '/api/draft', { headers: { ...headers, Host: 'example.invalid' } }, res => { res.resume(); done(res.statusCode) })
    req.on('error', fail); req.end()
  })
  assert.equal(invalidHostStatus, 403)
  const state = await (await fetch(session.origin + '/api/draft', { headers })).json()
  const stale = await fetch(session.origin + '/api/save', { method: 'POST', headers, body: JSON.stringify({ master: state.master, revision: 'stale' }) })
  assert.equal(stale.status, 400); assert.match((await stale.json()).error, /another editor/)
  assert.equal((await fetch(session.origin + '/api/publish', { method: 'POST', headers, body: '{}' })).status, 404)
  assert.deepEqual((await readDraft(root)).master, state.master)
  child.kill(); await once(child, 'exit')
})
