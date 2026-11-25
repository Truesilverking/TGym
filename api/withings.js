import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'
const MEASURE_URL = 'https://wbsapi.withings.net/measure'
const failure = (code, status = 502) => Object.assign(new Error(code), { code, status })

// Provider credentials never enter training state, responses, backups or logs.
// Each server keeps its own encrypted vault, using the existing server secret.
export function createWithings({ directory, secret, clientId = '', clientSecret = '', redirectUri = '', fetcher = fetch, now = Date.now }) {
  const key = crypto.createHash('sha256').update(secret).digest()
  const file = path.join(directory, 'withings.enc')
  let accounts = {}, sequence = 0, vaultError = false
  const states = new Map(), locks = new Map(), disconnecting = new Set(), disconnects = new Map()
  const configured = Boolean(clientId && clientSecret && (() => { try { const u = new URL(redirectUri); return u.protocol === 'https:' && u.pathname === '/api/withings/callback' && !u.username && !u.password && !u.search && !u.hash } catch { return false } })())
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(data.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(data.tag, 'base64'))
    accounts = JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.data, 'base64')), decipher.final()]).toString('utf8'))
  } catch (error) { if (error.code !== 'ENOENT') vaultError = true }
  const requireVault = () => { if (vaultError) throw failure('withings-vault-unreadable', 503) }
  const accountFor = uid => Object.hasOwn(accounts, uid) ? accounts[uid] : null
  function save(next) {
    requireVault()
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(next)), cipher.final()])
    const encrypted = JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') })
    const tmp = `${file}.${process.pid}.${++sequence}.tmp`
    try { fs.writeFileSync(tmp, encrypted, { mode: 0o600 }); fs.renameSync(tmp, file); accounts = next }
    finally { try { fs.unlinkSync(tmp) } catch {} }
  }
  async function post(url, values, accessToken) {
    let response, data
    try {
      response = await fetcher(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: new URLSearchParams(values) })
      const raw = await response.text()
      if (raw.length > 4 * 1024 * 1024) throw failure('withings-response-too-large')
      data = JSON.parse(raw)
    } catch { throw failure('withings-unavailable') }
    if (response.status === 401 || Number(data?.status) === 401) throw failure('withings-reconnect', 401)
    if (!response.ok || data?.status !== 0 || !data.body || typeof data.body !== 'object') throw failure('withings-request-failed')
    return data.body
  }
  function tokens(body) {
    if (typeof body.access_token !== 'string' || !body.access_token || body.access_token.length > 4096 || typeof body.refresh_token !== 'string' || !body.refresh_token || body.refresh_token.length > 4096 || !/^[a-zA-Z0-9_-]{1,128}$/.test(String(body.userid || '')) || !Number.isFinite(Number(body.expires_in)) || Number(body.expires_in) <= 0 || Number(body.expires_in) > 365 * 86400 || body.scope && !String(body.scope).split(',').includes('user.metrics')) throw failure('withings-invalid-token')
    return { accessToken: body.access_token, refreshToken: body.refresh_token, userId: String(body.userid), expiresAt: now() + Number(body.expires_in) * 1000 }
  }
  async function refresh(uid) {
    const account = accountFor(uid)
    if (!account) throw failure('withings-reconnect', 401)
    const next = tokens(await post(TOKEN_URL, { action: 'requesttoken', grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: account.refreshToken }))
    if (next.userId !== account.userId) throw failure('withings-account-mismatch')
    // Refresh rotates the token; durably store the new pair before using it.
    save({ ...accounts, [uid]: next })
    return next
  }
  const serial = (uid, action) => {
    if (locks.has(uid)) return locks.get(uid)
    const pending = Promise.resolve().then(action).finally(() => locks.delete(uid))
    locks.set(uid, pending); return pending
  }
  return {
    status(uid) { return { configured, connected: Boolean(accountFor(uid)), ...(vaultError ? { available: false } : {}) } },
    start(uid) {
      requireVault()
      if (disconnecting.has(uid)) throw failure('withings-busy', 409)
      if (!configured) throw failure('withings-not-configured', 503)
      for (const [id, state] of states) if (state.expiresAt <= now() || state.uid === uid) states.delete(id)
      if (states.size >= 1000) throw failure('withings-busy', 429)
      const state = crypto.randomBytes(32).toString('base64url')
      states.set(state, { uid, expiresAt: now() + 10 * 60000 })
      const url = new URL('https://account.withings.com/oauth2_user/authorize2')
      url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, scope: 'user.metrics', redirect_uri: redirectUri, state }).toString()
      return { url: url.href }
    },
    async callback(query) {
      requireVault()
      const state = states.get(query.get('state'))
      states.delete(query.get('state')) // Single use, including denied/failed exchanges.
      if (!state || state.expiresAt <= now() || query.get('error') || !query.get('code') || query.get('code').length > 2048) throw failure('withings-authorization-failed', 400)
      if (disconnecting.has(state.uid) || locks.has(state.uid)) throw failure('withings-busy', 409)
      return serial(state.uid, async () => {
        const account = tokens(await post(TOKEN_URL, { action: 'requesttoken', grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code: query.get('code') }))
        save({ ...accounts, [state.uid]: account })
        return true
      })
    },
    async disconnect(uid) {
      requireVault()
      if (disconnects.has(uid)) return disconnects.get(uid)
      disconnecting.add(uid)
      for (const [id, state] of states) if (state.uid === uid) states.delete(id)
      const pending = Promise.resolve().then(async () => {
        if (locks.has(uid)) await locks.get(uid).catch(() => {})
        for (const [id, state] of states) if (state.uid === uid) states.delete(id)
        const next = { ...accounts }; delete next[uid]; save(next)
      }).finally(() => { disconnecting.delete(uid); disconnects.delete(uid) })
      disconnects.set(uid, pending)
      return pending
    },
    async measures(uid, since = 0) {
      requireVault()
      if (disconnecting.has(uid)) throw failure('withings-busy', 409)
      if (!configured) throw failure('withings-not-configured', 503)
      return serial(uid, async () => {
        const fetchedAt = now()
        let account = accountFor(uid)
        if (!account) throw failure('withings-reconnect', 401)
        if (account.expiresAt <= now() + 60000) account = await refresh(uid)
        const lastupdate = Math.max(0, Math.min(Math.floor(now() / 1000), Math.floor(Number(since) / 1000) - 86400 || 0))
        const records = [], offsets = new Set()
        let offset = 0, retried = false
        for (let page = 0; page < 25; page++) {
          let body
          const values = { action: 'getmeas', category: '1', meastypes: '1,4,5,6,8', lastupdate: String(lastupdate), offset: String(offset) }
          try { body = await post(MEASURE_URL, values, account.accessToken) }
          catch (error) { if (error.status !== 401 || retried) throw error; retried = true; account = await refresh(uid); body = await post(MEASURE_URL, values, account.accessToken) }
          if (!Array.isArray(body.measuregrps)) throw failure('withings-invalid-measures')
          for (const row of body.measuregrps) {
            if (!row || typeof row !== 'object') continue
            records.push({ id: row.grpid, date: row.date, category: row.category, modified: row.modified, measures: Array.isArray(row.measures) ? row.measures.filter(m => [1,4,5,6,8].includes(m?.type)).map(m => ({ type: m.type, value: m.value, unit: m.unit })) : [] })
          }
          if (records.length > 10000) throw failure('withings-history-too-large')
          if (!body.more) return { records, fetchedAt }
          if (!Number.isInteger(body.offset) || body.offset <= offset || offsets.has(body.offset)) throw failure('withings-invalid-pagination')
          offsets.add(body.offset); offset = body.offset
        }
        throw failure('withings-history-too-large')
      })
    }
  }
}
