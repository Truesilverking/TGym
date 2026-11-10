import { Capacitor, registerPlugin } from '@capacitor/core'

const native = registerPlugin('ProfileSnapshot')
const FILE = 'framegym-state.json'
const CHUNK_CHARACTERS = 16 * 1024
const android = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
export const profileClockJournalAvailable = () => android() && Capacitor.isPluginAvailable?.('ProfileSnapshot') !== false

export async function readProfileClockJournal() {
  if (!profileClockJournalAvailable()) return null
  try { return (await native.readClock()).journal ?? null } catch { return null }
}

export async function writeProfileClockJournal(journal) {
  if (!profileClockJournalAvailable()) throw new Error('Native clock journal is unavailable')
  await native.writeClock(journal)
}

export async function readProfileSnapshot() {
  if (android()) return (await native.read()).data
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  return (await Filesystem.readFile({ path:FILE, directory:Directory.Data, encoding:Encoding.UTF8 })).data
}

export async function writeProfileSnapshot(data) {
  if (!android()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path:FILE, directory:Directory.Data, data, encoding:Encoding.UTF8 })
    return
  }
  // String.length is O(1). Encoding the complete large profile here blocked
  // rendering before the first native call. UTF-8 conversion stays on the worker.
  const { token } = await native.begin({ characters:data.length })
  try {
    let index = 0
    for (let start = 0; start < data.length;) {
      let end = Math.min(start + CHUNK_CHARACTERS, data.length)
      const last=data.charCodeAt(end-1),next=data.charCodeAt(end)
      // One UTF-16 code unit needs at most three UTF-8 bytes. Keep pairs whole,
      // so each small string is valid and never exceeds 48KiB after encoding.
      if(last>=0xd800 && last<=0xdbff && next>=0xdc00 && next<=0xdfff)end--
      await native.append({ token, index:index++, data:data.slice(start,end) })
      start = end
    }
    await native.commit({ token })
  } catch (error) {
    try { await native.abort({ token }) } catch { /* A stale lease cannot abort a newer snapshot. */ }
    throw error
  }
}
