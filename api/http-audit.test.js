import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Exercise the real HTTP handlers against a disposable database. No push
// subscription is created, so this suite cannot send notifications to anyone.
let directory, child, origin, port;
const secret = crypto.randomBytes(32).toString('hex');
const token = (id, version = 0) => {
  const payload = `${id}:${Date.now() + 60000}:${version}`;
  return payload + '.' + crypto.createHmac('sha256', secret).update(payload).digest('base64url');
};
const root = path.dirname(fileURLToPath(import.meta.url));
async function start() {
  child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: String(port), DATA_DIR: directory, RP_ID: 'localhost', ORIGIN: origin,
      ADMIN_UIDS: 'audit-admin', INVITE_ONLY: 'true', ALLOW_GUEST: 'false', AUDIT_LOG: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Isolated API startup timeout')), 10000);
    const fail = error => { clearTimeout(timer); reject(error); };
    child.once('error', fail);
    child.once('exit', code => fail(new Error(`Isolated API exited ${code}`)));
    child.stdout.on('data', data => { if (String(data).includes('gym-api on')) { clearTimeout(timer); resolve(); } });
    // Never print environment values, generated credentials or server response bodies.
    child.stderr.resume();
  });
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit'); child.kill(); await exited;
}
async function request(route, { method = 'GET', identity, body, headers = {} } = {}) {
  const response = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json',
    ...(identity ? { Authorization: `Bearer ${token(identity)}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
  return { status: response.status, data: await response.json() };
}
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'tgym-api-audit-'));
  await writeFile(path.join(directory, 'secret'), secret);
  await writeFile(path.join(directory, 'db.json'), JSON.stringify({ users: [
    { id: 'audit-user', name: 'Synthetic trainee' }, { id: 'audit-admin', name: 'Synthetic admin' },
  ], creds: [], subs: [], invites: [] }));
  const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  origin = `http://127.0.0.1:${port}`; await start();
});
after(async () => {
  await stop();
  const target = path.resolve(directory), parent = path.resolve(tmpdir()) + path.sep;
  assert.ok(target.startsWith(parent) && path.basename(target).startsWith('tgym-api-audit-'));
  await rm(target, { recursive: true, force: true });
});

test('HTTP config, authentication and cross-origin boundaries refuse unauthorized state changes', async () => {
  assert.deepEqual((await request('/api/config')).data, { invite_only: true, allow_guest: false });
  assert.equal((await request('/api/data')).status, 401);
  assert.equal((await request('/api/admin/users', { identity: 'audit-user' })).status, 403);
  assert.equal((await request('/api/data', { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  assert.equal((await request('/api/data', { method: 'PUT', body: { state: {} },
    headers: { Cookie: `gymsid=${token('audit-user')}`, Origin: 'https://foreign.invalid' } })).status, 403);
  assert.equal((await request('/api/data', { headers: { Cookie: `gymsid=${token('audit-user')}; gymsid=shadow` } })).status, 401);
  assert.equal((await request('/api/register/options', { method: 'POST', body: { name: '' } })).status, 400);
  assert.equal((await request('/api/register/options', { method: 'POST', body: { name: 'Synthetic', code: 'INVALID' } })).status, 403);
});

test('HTTP profile writes preserve history across restart and keep active workouts device-local', async () => {
  const state = { routines: [{ id: 'r', name: 'Synthetic', ex: [] }], workouts: [{ id: 'w', d: '2026-10-18', entries: [] }],
    bodyweight: [{ d: '2026-10-18', w: 80 }], active: { id: 'local-active', entries: [] }, _ts: 123 };
  assert.equal((await request('/api/data', { method: 'PUT', identity: 'audit-user', body: { state } })).status, 200);
  const expected = { ...state }; delete expected.active;
  assert.deepEqual((await request('/api/data', { identity: 'audit-user' })).data.state, expected);
  await stop(); await start();
  assert.deepEqual((await request('/api/data', { identity: 'audit-user' })).data.state, expected);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'state-audit-user.json'), 'utf8')), expected);
});

test('HTTP invalid top-level state cannot overwrite an existing saved profile', async () => {
  const before = (await request('/api/data', { identity: 'audit-user' })).data.state;
  for (const state of [null, [], 'invalid', 1]) {
    assert.equal((await request('/api/data', { method: 'PUT', identity: 'audit-user', body: { state } })).status, 400);
    assert.deepEqual((await request('/api/data', { identity: 'audit-user' })).data.state, before);
  }
});

test('HTTP pairing codes are single-use and sign-out everywhere revokes the old session', async () => {
  const paired = await request('/api/pair/create', { method: 'POST', identity: 'audit-user' });
  assert.equal(paired.status, 200);
  const redeemed = await request('/api/pair/redeem', { method: 'POST', body: { code: paired.data.code } });
  assert.equal(redeemed.status, 200);
  assert.equal((await request('/api/pair/redeem', { method: 'POST', body: { code: paired.data.code } })).status, 400);
  assert.equal((await request('/api/me', { headers: { Authorization: `Bearer ${redeemed.data.token}` } })).status, 200);
  assert.equal((await request('/api/logout/all', { method: 'POST', identity: 'audit-user' })).status, 200);
  assert.equal((await request('/api/me', { headers: { Authorization: `Bearer ${redeemed.data.token}` } })).status, 401);
});

test('HTTP admin invite, disable and audit operations persist while non-admin access stays refused', async () => {
  const invitation = await request('/api/admin/invites/new', { method: 'POST', identity: 'audit-admin', body: { note: 'Synthetic audit' } });
  assert.equal(invitation.status, 200);
  assert.equal((await request('/api/admin/invites', { identity: 'audit-admin' })).data.invites.length, 1);
  assert.equal((await request('/api/admin/invites/revoke', { method: 'POST', identity: 'audit-admin', body: { code: invitation.data.invite.code } })).status, 200);
  assert.equal((await request('/api/admin/invites', { identity: 'audit-admin' })).data.invites.length, 0);
  assert.equal((await request('/api/admin/user/disable', { method: 'POST', identity: 'audit-admin', body: { id: 'audit-admin', disabled: true } })).status, 400);
  assert.equal((await request('/api/admin/user/disable', { method: 'POST', identity: 'audit-admin', body: { id: 'audit-user', disabled: true } })).status, 200);
  assert.equal((await request('/api/me', { headers: { Authorization: `Bearer ${token('audit-user', 1)}` } })).status, 401);
  const db = JSON.parse(await readFile(path.join(directory, 'db.json'), 'utf8'));
  assert.equal(db.users.find(user => user.id === 'audit-user').disabled, true);
  const audit = await request('/api/admin/audit?cat=admin&limit=2', { identity: 'audit-admin' });
  assert.equal(audit.status, 200); assert.ok(audit.data.events.length <= 2);
  assert.ok(audit.data.events.every(event => event.ev.startsWith('admin.')));
});
