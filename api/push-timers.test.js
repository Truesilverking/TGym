import test from 'node:test';
import assert from 'node:assert/strict';
import { createPushTimers, timerSeconds, timerDeadline } from './push-timers.js';

const fixture = () => {
  const jobs = [], cleared = [], sent = [];
  const timers = createPushTimers((...args) => sent.push(args), {
    setTimer(callback, delay) { const job = { callback, delay }; jobs.push(job); return job; },
    clearTimer(job) { cleared.push(job); }, now: () => 100000,
  });
  return { timers, jobs, cleared, sent };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('timer durations reject coercible non-numbers and bound schedules to one hour', () => {
  for (const value of [null, undefined, false, true, [], {}, '', ' ', 'invalid', 0, -1, 3601, Infinity, NaN]) assert.equal(timerSeconds(value), null);
  assert.equal(timerSeconds(0.1), 1);
  assert.equal(timerSeconds('60'), 60);
  assert.equal(timerSeconds(3599.9), 3600);
});

test('rest and work jobs are independent per user and carry their original expiration', async () => {
  const f = fixture();
  f.timers.schedule('rest', 'a', 10, 'es');
  f.timers.schedule('work', 'a', 20, 'pt-BR');
  f.timers.schedule('work', 'b', 30, 'en');
  assert.deepEqual(f.jobs.map(job => job.delay), [10000, 20000, 30000]);
  f.jobs.forEach(job => job.callback()); await flush();
  assert.deepEqual(f.sent.map(([user, notice]) => [user, notice.tag, notice.timestamp]), [
    ['a', 'rest-timer', 110000], ['a', 'work-timer', 120000], ['b', 'work-timer', 130000],
  ]);
  assert.equal(f.sent[0][1].title, 'Descanso terminado');
  assert.equal(f.sent[1][1].title, 'Cronômetro terminado');
});

test('a client deadline removes network delay without accepting expired or unbounded alarms', async () => {
  const f=fixture();
  assert.equal(timerDeadline(undefined,10,100000),110000);
  for(const value of [null,'110000',NaN,Infinity,100000,90000,3700001])assert.equal(timerDeadline(value,10,100000),null);
  assert.equal(f.timers.schedule('work','a',10,'en',108000),true);
  assert.equal(f.jobs[0].delay,8000);
  f.jobs[0].callback();await flush();assert.equal(f.sent[0][1].timestamp,108000);
});

test('replacement, repeated cancellation and late timer callbacks cannot emit stale alerts', async () => {
  const f = fixture();
  f.timers.schedule('work', 'a', 10);
  f.timers.schedule('work', 'a', 20);
  f.jobs[0].callback(); await flush(); assert.equal(f.sent.length, 0);
  f.timers.cancel('work', 'a'); f.timers.cancel('work', 'a');
  f.jobs[1].callback(); await flush(); assert.equal(f.sent.length, 0);
  assert.equal(f.cleared.length, 2);
  f.timers.schedule('rest', 'a', 3); f.timers.schedule('work', 'a', 3);
  f.timers.cancelAll('a'); f.jobs.forEach(job => job.callback()); await flush();
  assert.equal(f.sent.length, 0);
});

test('each valid job emits at most once, and a delivery failure does not retry an expired set', async () => {
  const callbacks = [], calls = [];
  const timers = createPushTimers(async (...args) => { calls.push(args); throw Error('offline'); }, {
    setTimer: callback => callbacks.push(callback), clearTimer() {},
  });
  assert.equal(timers.schedule('unknown', 'a', 10), false);
  assert.equal(timers.schedule('work', 'a', 0), false);
  assert.equal(timers.schedule('work', 'a', 10), true);
  callbacks[0](); callbacks[0](); await flush(); await flush();
  assert.equal(calls.length, 1);
});
