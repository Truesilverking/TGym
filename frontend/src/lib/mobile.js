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
import { todayISO } from './format.js'
import { measurementNotificationPlan, MEASUREMENT_NOTIFICATION_IDS } from './measurement-reminders.js'
import { workoutNotificationPlan, WORKOUT_NOTIFICATION_IDS } from './workout-reminders.js'
import { lastWorkoutActivity, INACTIVITY_WARNING_MINUTES } from './workout-time.js'

export const MOBILE = import.meta.env.VITE_MOBILE === '1'

const FILE = 'framegym-state.json'

export async function nativeLoad() {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 })
    return JSON.parse(r.data)
  } catch (e) { return null }   // first launch, or unreadable — localStorage copy takes over
}

export async function nativeSave(state) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path: FILE, directory: Directory.Data, data: JSON.stringify(state), encoding: Encoding.UTF8 })
  } catch (e) { /* keep the localStorage copy */ }
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

// (Re)schedule the workout-day reminder: one repeating notification per weekday that has a
// routine in the weekly plan. Cheap enough to run after any state change — the plan or the
// reminder time may just have been edited. `interactive` gates the OS permission prompt to
// the Settings toggle; a background resync never pops a dialog.
let reminderQueue = Promise.resolve()
export function syncReminder(S, interactive = false) {
  const snapshot = structuredClone(S)
  reminderQueue = reminderQueue.catch(() => false).then(() => syncReminderNow(snapshot, interactive))
  return reminderQueue
}
async function syncReminderNow(S, interactive = false) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: WORKOUT_NOTIFICATION_IDS.map(id => ({ id })) })
    await LocalNotifications.cancel({ notifications: MEASUREMENT_NOTIFICATION_IDS.map(id => ({id})) })
    await LocalNotifications.cancel({ notifications: [{id:3000}] })
    const r = S.reminder
    if (!r?.on && !S.measurementReminders?.notifications && !S.active) return true
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted' && interactive) perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return false
    if (S.active && S.active.timerPausedAt == null) {
      const at = new Date(lastWorkoutActivity(S.active) + INACTIVITY_WARNING_MINUTES * 60000)
      if (at > new Date()) await LocalNotifications.schedule({notifications:[{id:3000,title:t('Still training?'),body:t('No activity has been recorded for a while.'),schedule:{at,allowWhileIdle:true},extra:{type:'workout',routineId:S.active.routineId,date:S.active.d}}]})
    }
    const measurementNotices = measurementNotificationPlan(S).map(group => ({
      id: group.id, title: t('Time to update your measurements'), body: group.labels.map(label => t(label)).join(', '),
      schedule: { at: group.at, allowWhileIdle: true }, extra: { type: 'measurement', metrics: group.metrics },
    }))
    if (measurementNotices.length) await LocalNotifications.schedule({ notifications: measurementNotices })
    if (!r?.on) return true
    const notifications = workoutNotificationPlan(S).map(notice => ({
      id: notice.id,
      title: t(notice.kind === 'today' ? 'Workout reminder' : 'Next workout reminder'),
      body: notice.kind === 'today' ? t('You still have {0} scheduled for today.', notice.name) : t('{0} is scheduled for {1}.',notice.name,notice.date),
      schedule: {at:notice.at,allowWhileIdle:true},
      extra: {type:'workout',routineId:notice.routineId,date:notice.date},
    }))
    if (notifications.length) await LocalNotifications.schedule({ notifications })
    return true
  } catch (e) { return false }
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
      data: JSON.stringify((await import('./backup.js')).createBackup(state)),
      encoding: Encoding.UTF8,
      recursive: true,
    })
  } catch (e) { /* best effort — the private mirror in Directory.Data still has the data */ }
}
