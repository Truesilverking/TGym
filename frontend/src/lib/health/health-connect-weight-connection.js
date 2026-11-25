import { Capacitor, registerPlugin } from '@capacitor/core'
import { useStore } from '../../store/useStore.js'
import { mergeHealthConnectWeightRecords } from './health-connect-weight-records.js'

const Native = registerPlugin('HealthWeights')
const PERIOD = 15 * 60000
const generation = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
let syncing = null, epoch = 0
const error = code => Object.assign(new Error(code), { code })
const selected = state => state.scaleWeightSource === 'health-connect' && state.healthConnectWeight?.enabled === true
const bounded = (promise, milliseconds, code) => {
  let timer
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(error(code)), milliseconds)
  })]).finally(() => clearTimeout(timer))
}

export async function healthConnectWeightStatus() {
  if (Capacitor.getPlatform() !== 'android') return { available: false, granted: false }
  const status = await bounded(Native.status(), 5000, 'health-weight-status-timeout')
  if (!status || typeof status.available !== 'boolean' || typeof status.granted !== 'boolean') throw error('health-weight-unavailable')
  return { available: status.available, granted: status.available && status.granted }
}
export async function connectHealthConnectWeight() {
  if (Capacitor.getPlatform() !== 'android') throw error('health-weight-unavailable')
  const before = useStore.getState().S
  const source = before.scaleWeightSource, previousGeneration = before.healthConnectWeight?.generation
  const sameSelection = state => state.scaleWeightSource === source &&
    state.healthConnectWeight?.generation === previousGeneration
  const requestEpoch = ++epoch
  const status = await Native.connect()
  if (status?.available !== true || status.granted !== true) throw error(status?.available === true ? 'health-weight-permission' : 'health-weight-unavailable')
  if (requestEpoch !== epoch || !sameSelection(useStore.getState().S)) throw error('health-weight-connection-changed')
  await useStore.getState().updateAtomic(state => {
    if (requestEpoch !== epoch || !sameSelection(state)) throw error('health-weight-connection-changed')
    state.scaleWeightSource = 'health-connect'
    state.healthConnectWeight = { enabled: true, autoSync: true, lastSyncAt: 0, generation: generation() }
    state.smartScaleConnection = { ...state.smartScaleConnection, enabled: false, generation: generation() }
  })
  await useStore.getState().flushPersistence()
  return { available: true, granted: true }
}
export async function setHealthConnectWeightAutoSync(enabled) {
  epoch++
  await useStore.getState().updateAtomic(state => {
    if (!selected(state)) throw error('health-weight-not-connected')
    state.healthConnectWeight = { ...state.healthConnectWeight, autoSync: Boolean(enabled), generation: generation() }
  })
  await useStore.getState().flushPersistence()
}
export async function disconnectHealthConnectWeight() {
  epoch++
  await useStore.getState().updateAtomic(state => {
    state.healthConnectWeight = { ...state.healthConnectWeight, enabled: false, autoSync: false, generation: generation() }
  })
  await useStore.getState().flushPersistence()
}
export async function openHealthConnectWeightSettings() {
  if (Capacitor.getPlatform() !== 'android') throw error('health-weight-unavailable')
  return Native.openSettings()
}
export function syncHealthConnectWeight({ automatic = false } = {}) {
  if (syncing) return syncing
  const operation = async () => {
    const snapshot = useStore.getState().S, settings = { ...snapshot.healthConnectWeight }
    if (!selected(snapshot)) {
      if (automatic) return null
      throw error('health-weight-not-connected')
    }
    if (automatic && (!settings.autoSync || Date.now() - (settings.lastSyncAt || 0) < PERIOD)) return null
    const requestEpoch = epoch
    const unchanged = state => requestEpoch === epoch && selected(state) &&
      state.healthConnectWeight.generation === settings.generation && state.healthConnectWeight.lastSyncAt === settings.lastSyncAt &&
      state.healthConnectWeight.autoSync === settings.autoSync
    const status = await healthConnectWeightStatus()
    if (!status.available || !status.granted) throw error(status.available ? 'health-weight-permission' : 'health-weight-unavailable')
    if (!unchanged(useStore.getState().S)) throw error('health-weight-connection-changed')
    const data = await bounded(Native.readWeights(), 15000, 'health-weight-read-timeout')
    const refreshed = await healthConnectWeightStatus()
    if (!refreshed.available || !refreshed.granted) throw error('health-weight-permission')
    if (!unchanged(useStore.getState().S)) throw error('health-weight-connection-changed')
    let result
    await useStore.getState().updateAtomic(state => {
      if (!unchanged(state)) throw error('health-weight-connection-changed')
      result = mergeHealthConnectWeightRecords(state, data)
      state.healthConnectWeight = { ...state.healthConnectWeight, lastSyncAt: Date.now() }
    }, true, !automatic)
    await useStore.getState().flushPersistence()
    return result
  }
  syncing = operation().finally(() => { syncing = null })
  return syncing
}
