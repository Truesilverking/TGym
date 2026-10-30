import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtNum, fmtWeight, isoOf } from '../lib/format.js'
import { validMeasurementDate } from '../lib/body-records.js'
import { bwSheet, goalSheet, heightSheet, measurementsSheet } from '../sheets.jsx'
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
  const [name, setName] = useState(S.profile?.name ?? user?.name ?? '')
  const [photo, setPhoto] = useState(S.profile?.photo || '')
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const file = useRef(null), request = useRef(0)
  useEffect(() => () => { request.current++ }, [])
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
    if (busy || saving) return
    setSaving(true); setError('')
    try {
      useStore.getState().update(s => { s.profile = { ...s.profile, name: name.trim().slice(0, 80), photo: photo || null } })
      await useStore.getState().flushPersistence()
      useUI.getState().toast(t('Profile saved')); close()
    } catch { setError(t('Could not save. Check available storage and try again.')) }
    finally { setSaving(false) }
  }
  const weight = (Array.isArray(S.bodyweight) ? S.bodyweight : []).map(row => {
    const stamp = row?.t != null && row.t !== '' ? Number(row.t) : NaN
    const date = validMeasurementDate(row?.d, '9999-12-31') ? row.d : Number.isFinite(stamp) ? isoOf(new Date(stamp)) : ''
    return { row, date }
  }).filter(({row,date}) => validMeasurementDate(date, '9999-12-31') && Number.isFinite(Number(row?.w)) && Number(row.w) > 0)
    .sort((a,b) => b.date.localeCompare(a.date) || (Number(b.row.t) || 0) - (Number(a.row.t) || 0))[0]?.row
  return <div className="local-profile" data-tour="profile-editor">
    <h3>{t('Profile')}</h3><p className="muted small">{t('Your profile is saved with your training data. No cloud account is required.')}</p>
    <form onSubmit={save}>
      <div className="profile-photo-row"><div className="profile-avatar">{photo ? <img src={photo} alt={t('Profile photo')} /> : <Icon name="person" />}</div>
        <div className="profile-photo-actions"><Button type="button" icon="plus" onClick={() => file.current?.click()} disabled={busy || saving}>{photo ? t('Change photo') : t('Add photo')}</Button>
          {photo && <Button type="button" variant="ghost" icon="trash" disabled={busy || saving} onClick={() => {request.current++;setPhoto('')}}>{t('Remove photo')}</Button>}</div>
      </div>
      <input ref={file} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} />
      <label className="profile-name"><span>{t('Profile name')}</span><input className="input" name="profile-name" autoComplete="name" disabled={saving} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      {error && <p role="alert" className="profile-error">{error}</p>}
      <div className="profile-form-actions"><Button type="button" variant="ghost" onClick={close} disabled={saving}>{t('Cancel')}</Button><Button variant="primary" type="submit" disabled={busy || saving}>{t('Save')}</Button></div>
    </form>
    <Section title={t('Personal data')} footer={t('These values use your existing measurements and goals.')}>
      <Row icon="scale" title={t('Body Weight')} value={weight ? `${fmtWeight(weight.w)} ${S.unit}` : '—'} accessory="chevron" onClick={() => bwSheet()} />
      <Row icon="person" title={t('Height')} value={S.heightCm ? `${fmtNum(S.heightCm)} ${S.measurementUnit || 'cm'}` : '—'} accessory="chevron" onClick={() => heightSheet()} />
      <Row icon="target" title={t('Goal')} value={S.targetW ? `${fmtWeight(S.targetW)} ${S.unit}` : '—'} accessory="chevron" onClick={() => goalSheet()} />
      <Row icon="figureStrength" title={t('Body measurements')} accessory="chevron" onClick={() => measurementsSheet()} />
    </Section>
  </div>
}

export const openLocalProfile = () => useUI.getState().openSheet(close => <LocalProfile close={close} />)
