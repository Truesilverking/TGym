import { restTimerPush, workTimerPush } from './push-messages.js';

export function timerSeconds(value) {
  const seconds = typeof value === 'number' || typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 3600 ? Math.max(1, Math.round(seconds)) : null;
}

export function timerDeadline(value, seconds, now = Date.now()) {
  if (value === undefined) return now + seconds * 1000;
  return typeof value === 'number' && Number.isFinite(value) && value > now && value - now <= 3600000 ? value : null;
}

// Separate families prevent a late rest cancellation from cancelling a new work
// timer. A callback must still own its ticket even after clearTimeout races.
export function createPushTimers(send, { setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now } = {}) {
  const families = { rest: new Map(), work: new Map() };
  const cancel = (kind, userId) => {
    const map = families[kind], previous = map?.get(userId);
    if (!previous) return;
    map.delete(userId); clearTimer(previous.timer);
  };
  return {
    cancel,
    cancelAll(userId) { for (const kind of Object.keys(families)) cancel(kind, userId); },
    schedule(kind, userId, seconds, lang, endsAt) {
      const map = families[kind], duration = timerSeconds(seconds);
      if (!map || duration === null) return false;
      const clock = now(), deadline = timerDeadline(endsAt, duration, clock);
      if (deadline === null) return false;
      cancel(kind, userId);
      const job = { at: deadline };
      map.set(userId, job);
      job.timer = setTimer(() => {
        if (map.get(userId) !== job) return;
        map.delete(userId);
        const message = kind === 'work' ? workTimerPush(lang) : restTimerPush(lang);
        void Promise.resolve().then(() => send(userId, { ...message, timestamp: job.at })).catch(() => {});
      }, deadline - clock);
      return true;
    },
  };
}
