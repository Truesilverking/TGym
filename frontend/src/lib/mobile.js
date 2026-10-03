import { createBackup } from './backup.js'
import { soundEnabled } from './sound-preferences.js'
import { fmtScheduledDate } from './format.js'
// Mobile build (VITE_MOBILE=1) — the standalone app-store version (Capacitor native shell).
//
// There is no backend: nothing to sign in to, everything lives on the phone. Unlike guest
// mode in a browser, this is the user's only copy of their training log, so it can't depend
// on WebView localStorage alone (iOS evicts that under storage pressure). Every persist()
// therefore also lands in a JSON file in the app's private data directory, and boot()
// restores from it. The workout reminder uses native local notifications scheduled per
// planned weekday — no server involved, unlike Web Push in the self-hosted version.
//
// Like the demo build, MOBILE is replaced at build time, so all of this folds away in
// web bundles; the Capacitor plugins are only ever imported behind it.
import { t } from './i18n-core.js'
import { todayISO, ACCENTS } from './format.js'
import { measurementNotificationPlan, measurementReminderValidation, MEASUREMENT_NOTIFICATION_IDS } from './measurement-reminders.js'
import { workoutNotificationPlan, workoutReminderValidation, WORKOUT_NOTIFICATION_IDS, deloadNotificationPlan, DELOAD_NOTIFICATION_IDS } from './workout-reminders.js'
import { syncNativeSounds, finishNativeSoundSync } from './native-sound.js'

export const MOBILE = import.meta.env.VITE_MOBILE === '1'

const FILE = 'framegym-state.json'

export async function nativeLoad() {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 })
    return JSON.parse(r.data)
  } catch (e) { return null }   // first launch, or unreadable — localStorage copy takes over
}

let nativeSaveQueue = Promise.resolve()
export function nativeSave(state) {
  const data = JSON.stringify(state)
  // A pending debounced write must not finish after a newer immediate clock snapshot.
  nativeSaveQueue = nativeSaveQueue.then(async () => {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      await Filesystem.writeFile({ path: FILE, directory: Directory.Data, data, encoding: Encoding.UTF8 })
      return true
    } catch (e) { return false /* keep the localStorage copy */ }
  })
  return nativeSaveQueue
}

// "Connect to my server" mode (lib/remote.js): which of local-only / a paired remote account this
// device chose, kept in its own file — never inside opengym-state.json, since that file's content
// is exactly what pushState() PUTs to a server, and a device's own connection secret must never
// travel as if it were training data.
const REMOTE_FILE = 'framegym-remote.json'

export async function loadRemoteFile() {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const r = await Filesystem.readFile({ path: REMOTE_FILE, directory: Directory.Data, encoding: Encoding.UTF8 })
    return JSON.parse(r.data)
  } catch (e) { return null }   // never decided yet
}

export async function saveRemoteFile(data) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path: REMOTE_FILE, directory: Directory.Data, data: JSON.stringify(data), encoding: Encoding.UTF8 })
  } catch (e) { /* worst case: onboarding asks again next launch */ }
}

// Reconcile each reminder family with the native pending list. Opening Settings, restoring
// a profile and foreground checks do not replace unchanged alarms. `interactive` is only
// passed by an explicit enable/retry action; background reconciliation never asks permission.
const reminderKinds = ['workout', 'measurement', 'deload']
const ownedReminderIds = {workout:[...WORKOUT_NOTIFICATION_IDS,3000], measurement:MEASUREMENT_NOTIFICATION_IDS, deload:DELOAD_NOTIFICATION_IDS}
const reminderListeners = new Set()
let reminderStatus = Object.fromEntries(reminderKinds.map(kind => [kind,{status:MOBILE ? 'syncing' : 'unsupported',count:0,nextAt:null,error:null,validation:null}]))
export const getReminderStatus = () => reminderStatus
export const reminderSyncStatus = kind => reminderStatus[kind]
export function subscribeReminderStatus(listener) {
  reminderListeners.add(listener)
  return () => reminderListeners.delete(listener)
}
function setReminderStatus(kind, status, notices = [], error = null, validation = null) {
  const next = {status,count:status === 'configured' ? notices.length : 0,nextAt:status === 'configured' && notices.length ? notices[0].schedule.at.toISOString() : null,error,validation}
  if (JSON.stringify(next) === JSON.stringify(reminderStatus[kind])) return
  reminderStatus = {...reminderStatus,[kind]:next}
  for (const listener of reminderListeners) listener()
}
const stableValue = value => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(stableValue) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,stableValue(value[key])])) : value
const noticeIdentity = notice => {
  const at = +new Date(notice.schedule?.at)
  // Android's pending list can contain Java Date strings with local zone abbreviations
  // (e.g. AST), which JavaScript cannot parse. Our stable epoch preserves that comparison.
  return JSON.stringify(stableValue({id:notice.id,title:notice.title,body:notice.body,at:Number.isFinite(at) ? at : notice.extra?.tgymReminderAt,extra:notice.extra || {}}))
}
function samePending(pending, desired) {
  const identities = new Map(pending.map(notice => [notice.id,noticeIdentity(notice)]))
  return pending.length === desired.length && desired.every(notice => identities.get(notice.id) === noticeIdentity(notice))
}
const lastScheduled = new Map()
let reminderQueue = Promise.resolve()
export function syncReminder(S, interactive = false, requestedKind = null) {
  const snapshot = structuredClone(S)
  reminderQueue = reminderQueue.catch(() => false).then(() => syncReminderNow(snapshot, interactive, requestedKind))
  return reminderQueue
}
async function syncReminderNow(S, interactive = false, requestedKind = null) {
  const now = new Date()
  const families = {
    workout:{enabled:!!S.reminder?.on,validation:workoutReminderValidation(S)},
    measurement:{enabled:!!S.measurementReminders?.notifications,validation:measurementReminderValidation(S)},
    deload:{enabled:!!S.deload?.on && S.deload?.notifications !== false,validation:{valid:true,reason:null}},
  }
  let soundSettings
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const enabled = reminderKinds.some(kind => families[kind].enabled && families[kind].validation.valid)
    let perm = enabled ? await LocalNotifications.checkPermissions() : {display:'granted'}
    const requestable = requestedKind ? families[requestedKind]?.enabled && families[requestedKind]?.validation.valid : enabled
    if (interactive && requestable && ['prompt','prompt-with-rationale'].includes(perm.display)) perm = await LocalNotifications.requestPermissions()
    let soundError = null
    if (enabled && perm.display === 'granted') {
      try { soundSettings = await syncNativeSounds(S) } catch (error) { soundError = error }
    }
    const decorate = notices => notices.map(n => {
      const sound = notificationSoundOptions(S,soundSettings,n.schedule?.at), iconColor = ACCENTS[S.accent] || ACCENTS.red
      // getPending omits native channel/icon properties, so retain our applied identity in
      // extra for reconciliation after reopening as well as within the current process.
      return {...n,...sound,smallIcon:'ic_workout_notification',iconColor,extra:{...n.extra,tgymReminderAt:+n.schedule.at,tgymReminderStyle:JSON.stringify([sound.channelId || null,'ic_workout_notification',iconColor])}}
    }).sort((a,b)=>+a.schedule.at - +b.schedule.at || a.id - b.id)
    families.deload.notices = deloadNotificationPlan(S, now).map(n => ({id:n.id, title:t('Deload week'), body:t('Deload: {0} – {1}. Follow your reduced training targets.',n.start,n.end), schedule:{at:n.at,allowWhileIdle:true},extra:{type:'deload'}}))
    families.measurement.notices = measurementNotificationPlan(S, now).map(group => ({
      id: group.id, title: t('Time to update your measurements'), body: group.labels.map(label => t(label)).join(', '),
      schedule: { at: group.at, allowWhileIdle: true }, extra: { type: 'measurement', metrics: group.metrics },
    }))
    families.workout.notices = workoutNotificationPlan(S, now).map(notice => ({
      id: notice.id,
      title: t(notice.kind === 'today' ? 'Workout reminder' : 'Next workout reminder'),
      body: (notice.kind === 'today' ? t('You still have {0} scheduled for today.', notice.name) : t('{0} is scheduled for {1}.',notice.name,fmtScheduledDate(notice.date))) + (notice.remaining>1 ? ' · '+t('{0} workouts remaining',notice.remaining) : ''),
      schedule: {at:notice.at,allowWhileIdle:true},
      extra: {type:'workout',routineId:notice.routineId,date:notice.date},
    }))
    let pending = (await LocalNotifications.getPending()).notifications || [], successful = true
    for (const kind of reminderKinds) {
      const family = families[kind]
      const status = !family.enabled ? 'off' : !family.validation.valid ? 'incomplete' : perm.display !== 'granted' ? 'permission-denied' : soundError ? 'error' : 'configured'
      const notices = status === 'configured' ? decorate(family.notices) : []
      const fingerprint = JSON.stringify(notices)
      const owned = pending.filter(notice => ownedReminderIds[kind].includes(notice.id))
      try {
        if (!samePending(owned, notices) || (lastScheduled.has(kind) && lastScheduled.get(kind) !== fingerprint)) {
          setReminderStatus(kind,'syncing')
          await LocalNotifications.cancel({notifications:ownedReminderIds[kind].map(id => ({id}))})
          if (notices.length) await LocalNotifications.schedule({notifications:notices})
          pending = (await LocalNotifications.getPending()).notifications || []
          if (!samePending(pending.filter(notice => ownedReminderIds[kind].includes(notice.id)),notices)) throw new Error('Reminder scheduling could not be verified')
        }
        lastScheduled.set(kind,fingerprint)
        setReminderStatus(kind,status,notices,soundError ? 'Reminder scheduling failed' : null,family.validation.valid ? null : family.validation.reason)
        if (family.enabled && status !== 'configured') successful = false
      } catch (error) {
        lastScheduled.delete(kind)
        setReminderStatus(kind,'error',[],'Reminder scheduling failed')
        successful = false
        // A failed measurement update must not prevent reconciliation of workout/deload.
        pending = (await LocalNotifications.getPending()).notifications || []
      }
    }
    return requestedKind && families[requestedKind] ? ['off','configured'].includes(reminderStatus[requestedKind].status) : successful
  } catch (error) {
    const unsupported = ['UNIMPLEMENTED','NOT_IMPLEMENTED'].includes(error?.code)
    for (const kind of reminderKinds) setReminderStatus(kind,unsupported ? 'unsupported' : 'error',[],unsupported ? null : 'Reminder scheduling failed')
    return false
  } finally { await finishNativeSoundSync(soundSettings) }
}

export function notificationSoundOptions(S, native, at = new Date()) {
  if (!native?.channels || !native.notificationSoundsSupported) return {}
  const r = S.reminder || {}, date = new Date(at)
  const time = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
  const start = /^([01]\d|2[0-3]):[0-5]\d$/.test(r.quietStart || '') ? r.quietStart : '22:00'
  const end = /^([01]\d|2[0-3]):[0-5]\d$/.test(r.quietEnd || '') ? r.quietEnd : '07:00'
  const quiet = r.quietOn && (start < end ? time >= start && time < end : start !== end && (time >= start || time < end))
  return {channelId:native.channels[quiet ? 'silent' : !soundEnabled(S) ? 'muted' : 'audible']}
}

// WKWebView can't do blob-URL downloads, so the backup goes out through the OS share sheet
// (Files, AirDrop, mail, …) from a temp file instead.
export async function shareExport(json, filename) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const w = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: json, encoding: Encoding.UTF8 })
  await Share.share({ title: filename, url: w.uri })
}

// Binary exports (the Stats card is a PNG) must be written as base64. Writing those bytes as
// UTF-8 produces a shareable file whose preview is blank or corrupt on Android/iOS.
export async function shareBase64(base64, filename) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const w = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: base64 })
  await Share.share({ title: filename, url: w.uri })
}

// "Auto-backup on changes" (Settings): a dated snapshot dropped into the Documents folder —
// visible in Files (iOS) / a file manager (Android), unlike the private mirror nativeSave keeps
// — so whatever the user points at that folder (a sync app, a manual copy) always has something
// recent. One file per day; later triggers the same day just overwrite it.
export async function writeAutoBackup(state) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({
      path: `framegym-backup-${todayISO()}.json`,
      directory: Directory.Documents,
      data: JSON.stringify(createBackup(state)),
      encoding: Encoding.UTF8,
      recursive: true,
    })
  } catch (e) { /* best effort — the private mirror in Directory.Data still has the data */ }
}
