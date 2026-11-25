import { createServer } from 'node:http'
import { readFile, realpath } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, join, relative, isAbsolute, dirname, basename } from 'node:path'
import { randomBytes, timingSafeEqual, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { initDraft, readDraft, saveDraft, validateFiles, importMedia, prepareBundle, regularFile, hash, MAX_MEDIA_BYTES } from './core.mjs'

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url))
const args = process.argv.slice(2), command = args[0] || 'help', rootIndex = args.indexOf('--root')
const root = resolve(rootIndex >= 0 ? args[rootIndex + 1] : join(process.env.LOCALAPPDATA || homedir(), 'TGymCatalog'))
const workspaceRelative = relative(sourceRoot, root)
if (!workspaceRelative || (!workspaceRelative.startsWith('..') && !isAbsolute(workspaceRelative))) throw Error('Keep drafts outside the public repository; choose --root outside TGym')

async function main() {
  // Check the canonical path too: an outside junction may point into the repo.
  let ancestor = root, suffix = [], canonicalRoot
  while (!canonicalRoot) {
    try { canonicalRoot = join(await realpath(ancestor), ...suffix) }
    catch (error) {
      if (error.code !== 'ENOENT' || dirname(ancestor) === ancestor) throw error
      suffix.unshift(basename(ancestor)); ancestor = dirname(ancestor)
    }
  }
  const rel = relative(await realpath(sourceRoot), canonicalRoot)
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw Error('Draft location resolves inside the public repository')
  if (command === 'init') {
    const { CATALOGUE } = await import('../../frontend/src/lib/exercises.js')
    const master = await initDraft(root, CATALOGUE)
    console.log(`Local official baseline: ${master.exercises.length} exercises\nDraft: ${join(root, 'master.json')}\nNothing was published.`)
  } else if (command === 'validate') {
    const { master, baseline } = await readDraft(root), result = await validateFiles(root, master, baseline)
    if (result.errors.length) throw Error(result.errors.join('\n'))
    console.log(`Valid local draft ${master.version}: ${master.exercises.length} exercises, ${result.resources.length} new resources. Browser preview must verify actual decoding/playback.`)
  } else if (command === 'prepare') {
    console.log(`Review package: ${await prepareBundle(root)}\nNot published. No publishing credentials or content-update channel are configured.`)
  } else if (command === 'serve') {
    await readDraft(root)
    await serve()
  } else {
    console.log('TGym official catalogue — local draft tool\nnode tools/catalog/admin.mjs init|serve|validate|prepare [--root PATH]\nDefault: %LOCALAPPDATA%/TGymCatalog (outside the public repo).\nThis tool cannot publish. See docs/OFFICIAL-CATALOG-PROPOSAL.md.')
  }
}

async function serve() {
  const token = randomBytes(32).toString('hex')
  let port, queue = Promise.resolve()
  const send = (res, code, value, type = 'application/json; charset=utf-8') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.jsdelivr.net blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" })
    res.end(type.startsWith('application/json') ? JSON.stringify(value) : value)
  }
  const body = async (req, limit) => {
    const chunks = []; let size = 0
    for await (const chunk of req) { size += chunk.length; if (size > limit) throw Error('Request exceeds size limit'); chunks.push(chunk) }
    return Buffer.concat(chunks)
  }
  const server = createServer(async (req, res) => {
    // Literal loopback host + Origin checking prevents DNS rebinding and browser CSRF.
    const origin = `http://127.0.0.1:${port}`
    if (req.headers.host !== `127.0.0.1:${port}` || (req.headers.origin && req.headers.origin !== origin)) return send(res, 403, { error: 'Local authorized origin required' })
    const url = new URL(req.url, origin)
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/editor.js')) {
      const name = url.pathname === '/' ? 'editor.html' : 'editor.js'
      return send(res, 200, await readFile(new URL(name, import.meta.url)), name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8')
    }
    const provided = req.headers['x-tgym-catalog-token'] || url.searchParams.get('token') || ''
    if (typeof provided !== 'string' || !/^[a-f0-9]{64}$/.test(provided) || !timingSafeEqual(Buffer.from(provided), Buffer.from(token))) return send(res, 403, { error: 'Local editor authorization required' })
    try {
      if (req.method === 'GET' && url.pathname === '/api/draft') {
        const { master } = await readDraft(root)
        return send(res, 200, { master, revision: hash(JSON.stringify(master)), newId: `official_${randomUUID()}`, path: join(root, 'master.json') })
      }
      if (req.method === 'GET' && /^\/media\/[a-f0-9]{64}\.(gif|png|jpg|webp)$/.test(url.pathname)) {
        const name = url.pathname.slice(1), bytes = await readFile(await regularFile(root, name)), extension = name.split('.').pop()
        return send(res, 200, bytes, 'image/' + (extension === 'jpg' ? 'jpeg' : extension))
      }
      if (req.method === 'POST' && url.pathname === '/api/media') {
        const bytes = await body(req, MAX_MEDIA_BYTES)
        return send(res, 200, await importMedia(root, bytes))
      }
      if (req.method === 'POST' && url.pathname === '/api/validate') {
        const { baseline } = await readDraft(root), master = JSON.parse(await body(req, 16 * 1024 * 1024))
        return send(res, 200, await validateFiles(root, master, baseline))
      }
      if (req.method === 'POST' && url.pathname === '/api/save') {
        const input = JSON.parse(await body(req, 16 * 1024 * 1024))
        const operation = queue.then(async () => {
          const { master } = await readDraft(root)
          if (input.revision !== hash(JSON.stringify(master))) throw Error('Draft changed in another editor. Reload before saving.')
          await saveDraft(root, input.master)
          return { revision: hash(JSON.stringify(input.master)) }
        })
        queue = operation.catch(() => {})
        return send(res, 200, await operation)
      }
      if (req.method === 'POST' && url.pathname === '/api/prepare') {
        const operation = queue.then(() => prepareBundle(root)); queue = operation.catch(() => {})
        return send(res, 200, { path: await operation, published: false })
      }
      return send(res, 404, { error: 'Unknown local operation' })
    } catch (error) { return send(res, 400, { error: error.message }) }
  })
  server.requestTimeout = 30000
  server.headersTimeout = 15000
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done) })
  port = server.address().port
  // Per-launch token lives only in this console/session URL; never in repository or user app.
  console.log(`Local editor: http://127.0.0.1:${port}/#${token}\nDraft: ${root}\nCtrl+C closes the editor and revokes this session. No remote publication is available.`)
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
