import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtNum, fmtWeight, isoOf } from '../lib/format.js'
import { validMeasurementDate } from '../lib/body-records.js'
import { bwSheet, goalSheet, heightSheet } from '../sheets.jsx'
import { weightConversionFactor, weightUnit } from '../lib/weight-units.js'
import { Button, Row, Section } from './ui.jsx'
import Icon from './Icon.jsx'
import './LocalProfile.css'

// A display profile belongs to the existing persisted training state. It never
// creates a server identity or changes the authentication user's stable ID.
export async function readProfilePhoto(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('photo')
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('photo')
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const photo = canvas.toDataURL('image/jpeg', 0.82)
    if (!photo.startsWith('data:image/jpeg;base64,') || photo.length > 350000) throw new Error('photo')
    return photo
  } finally { URL.revokeObjectURL(source) }
}

export default function LocalProfile({ close }) {
  const S = useStore(s => s.S), user = useStore(s => s.user)
  const profileName = state => typeof state.S.profile?.name === 'string' ? state.S.profile.name : typeof state.user?.name === 'string' ? state.user.name : ''
  const profileAge = value => Number.isInteger(value) && value >= 1 && value <= 120 ? String(value) : ''
  const [name, setName] = useState(profileName({ S, user }))
  const [photo, setPhoto] = useState(S.profile?.photo || '')
  const [age, setAge] = useState(profileAge(S.profile?.age))
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const file = useRef(null), request = useRef(0), savePending = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++ } }, [])
  const resetDraft = () => {
    request.current++; setBusy(false); setError('')
    const state = useStore.getState()
    setName(profileName(state))
    setPhoto(state.S.profile?.photo || '')
    setAge(profileAge(state.S.profile?.age))
  }
  const edit = () => { resetDraft(); setEditing(true) }
  const cancel = () => { resetDraft(); setEditing(false) }
  const selectPhoto = async e => {
    const selected = e.target.files?.[0]; e.target.value = ''
    if (!selected) return
    const token = ++request.current
    setBusy(true); setError('')
    try { const next = await readProfilePhoto(selected); if (request.current === token) setPhoto(next) }
    catch { if (request.current === token) setError(t('Choose a JPG, PNG or WebP photo up to 8 MB.')) }
    finally { if (request.current === token) setBusy(false) }
  }
  const save = async e => {
    e.preventDefault()
    if (!editing || busy || savePending.current) return
    const validAge = age.trim() === '' || (/^\d+$/.test(age.trim()) && Number(age) >= 1 && Number(age) <= 120)
    if (!validAge) { setError(t('Enter an age from 1 to 120, or leave it blank.')); return }
    savePending.current = true; setSaving(true); setError('')
    try {
      await useStore.getState().updateAtomic(s => { s.profile = { ...s.profile, name: name.trim().slice(0, 80), photo: photo || null, age: age.trim() === '' ? null : Number(age) } })
      await useStore.getState().flushPersistence()
      if (mounted.current) { useUI.getState().toast(t('Profile saved')); setEditing(false) }
    } catch { if (mounted.current) setError(t('Could not save. Check available storage and try again.')) }
    finally { savePending.current = false; if (mounted.current) setSaving(false) }
  }
  const weight = (Array.isArray(S.bodyweight) ? S.bodyweight : []).map(row => {
    const stamp = row?.t != null && row.t !== '' ? Number(row.t) : NaN
    const date = validMeasurementDate(row?.d, '9999-12-31') ? row.d : Number.isFinite(stamp) ? isoOf(new Date(stamp)) : ''
    return { row, date }
  }).filter(({row,date}) => validMeasurementDate(date, '9999-12-31') && Number.isFinite(Number(row?.w)) && Number(row.w) > 0)
    .sort((a,b) => b.date.localeCompare(a.date) || (Number(b.row.t) || 0) - (Number(a.row.t) || 0))[0]?.row
  const unit = weightUnit(S.unit, 'kg')
  const shownWeight = weight ? Number(weight.w) * weightConversionFactor(weightUnit(weight.unit, unit), unit) : null
  const heightUnit = S.measurementUnit === 'in' ? 'in' : 'cm'
  const displayName = profileName({ S, user })
  const displayPhoto = editing ? photo : S.profile?.photo || ''
  const openRecord = open => event => { event.preventDefault(); if (editing && !savePending.current) open() }
  return <div className={'local-profile' + (editing ? ' is-editing' : '')} data-tour="profile-editor">
    <div className="profile-heading"><h3>{t('Profile')}</h3>{!editing && <Button type="button" icon="pencil" onClick={edit}>{t('Edit')}</Button>}</div>
    <form onSubmit={save}>
      <div className="profile-photo-row"><div className="profile-avatar-wrap"><div className="profile-avatar">{displayPhoto ? <img src={displayPhoto} alt={t('Profile photo')} /> : <Icon name="person" />}</div>
        {editing && <div className="profile-photo-actions"><Button type="button" icon="pencil" aria-label={t(photo ? 'Change photo' : 'Add photo')} onClick={() => file.current?.click()} disabled={busy || saving} />
          {photo && <Button type="button" variant="ghost" icon="trash" aria-label={t('Remove photo')} disabled={busy || saving} onClick={() => {request.current++;setPhoto('')}} />}</div>}
        </div>
        <div className="profile-identity">{editing ? <input className="input" name="profile-name" aria-label={t('Name')} autoComplete="name" disabled={saving} maxLength={80} value={name} onChange={e => setName(e.target.value)} /> : <p className="profile-display-name">{displayName || t('Your name')}</p>}</div>
      </div>
      {editing && <input ref={file} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} disabled={busy || saving} />}
      <Section title={t('Personal data')} footer={editing ? t('Weight, height and goal editors save their own records.') : undefined}>
        <Row icon="scale" title={t('Body Weight')} value={shownWeight == null ? '—' : `${fmtWeight(shownWeight)} ${unit}`} accessory={editing ? 'chevron' : 'none'} onClick={editing && !saving ? openRecord(bwSheet) : undefined} />
        <Row icon="person" title={t('Height')} value={Number(S.heightCm) > 0 ? `${fmtNum(Number(S.heightCm))} ${heightUnit}` : '—'} accessory={editing ? 'chevron' : 'none'} onClick={editing && !saving ? openRecord(heightSheet) : undefined} />
        <Row icon="target" title={t('Goal')} value={S.targetW ? `${fmtWeight(S.targetW)} ${unit}` : '—'} accessory={editing ? 'chevron' : 'none'} onClick={editing && !saving ? openRecord(goalSheet) : undefined} />
        <Row icon="calendar" title={t('Age')} value={editing ? undefined : profileAge(S.profile?.age) || '—'}>{editing && <input className="input profile-age" name="profile-age" type="text" inputMode="numeric" aria-label={t('Age')} autoComplete="off" maxLength={3} disabled={saving} value={age} onChange={e => setAge(e.target.value)} />}</Row>
      </Section>
      {error && <p role="alert" className="profile-error">{error}</p>}
      {editing && <div className="profile-form-actions"><Button type="button" variant="ghost" onClick={cancel} disabled={saving}>{t('Cancel')}</Button><Button variant="primary" type="submit" disabled={busy || saving}>{t('Save')}</Button></div>}
    </form>
  </div>
}

export const openLocalProfile = () => useUI.getState().openSheet(close => <LocalProfile close={close} />)
