import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { SOUND_EVENTS, SOUND_PRESETS, MAX_CUSTOM_SOUNDS, MAX_SOUND_SECONDS, soundChoice, importCustomSound, removeCustomSound } from '../lib/sound-preferences.js'
import { playAppSound, stopSound } from '../lib/sound.js'
import { syncNativeSounds } from '../lib/native-sound.js'
import { Button, SelectRow } from './ui.jsx'
import Icon from './Icon.jsx'
import './SoundSettings.css'

const EVENT_ICONS = { rest: 'timer', work: 'figureStrength', countdown: 'clock', set: 'check', completion: 'sparkles', notification: 'bell' }

export const openSoundSettings = () => useUI.getState().openSheet(() => <SoundSettings />)

export default function SoundSettings() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const input = useRef(null)
  const mounted = useRef(false)
  const importing = useRef(false)
  const previewRequest = useRef(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [legacyNotificationSound, setLegacyNotificationSound] = useState(false)
  const custom = S.customSounds || []
  const options = [
    ...SOUND_PRESETS.map(p => ({ value: p.id, label: t(p.label) })),
    ...(!SOUND_PRESETS.some(p => p.id === 'silent') ? [{ value: 'silent', label: t('Silent') }] : []),
    ...custom.map(sound => ({ value: sound.id, label: sound.name })),
  ]

  useEffect(() => {
    mounted.current = true
    syncNativeSounds(useStore.getState().S).then(result => {
      if (mounted.current) setLegacyNotificationSound(result?.notificationSoundsSupported === false)
    }).catch(() => {})
    return () => { mounted.current = false; previewRequest.current++; stopSound() }
  }, [])

  const choose = (event, id) => {
    previewRequest.current++
    stopSound()
    update(s => { s.sounds = { ...s.sounds, [event]: id } })
  }
  const preview = async event => {
    const request = ++previewRequest.current
    setError('')
    stopSound()
    try {
      const played = await playAppSound(useStore.getState().S, event, { preview: true })
      if (played === false && mounted.current && request === previewRequest.current) setError(t('Could not play this sound. Try another audio file.'))
    }
    catch { if (mounted.current && request === previewRequest.current) setError(t('Could not play this sound. Try another audio file.')) }
  }
  const importFile = async ev => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file || importing.current) return
    setError(''); setMessage('')
    if ((useStore.getState().S.customSounds || []).length >= MAX_CUSTOM_SOUNDS) {
      setError(t('Remove a custom sound before adding another.')); return
    }
    importing.current = true
    setBusy(true)
    let saving = false
    try {
      const sound = await importCustomSound(file)
      if (!mounted.current) return
      // Recheck after decoding: another view or restored profile may have changed the list.
      if ((useStore.getState().S.customSounds || []).length >= MAX_CUSTOM_SOUNDS) {
        setError(t('Remove a custom sound before adding another.')); return
      }
      saving = true
      update(s => { s.customSounds = [...(s.customSounds || []), sound] })
      setMessage(t('Sound added. Choose it for an alert above.'))
    } catch (e) {
      if (!mounted.current) return
      setError(saving ? t('Could not save the sound. Free some storage and try again.')
        : e.code === 'too_large' ? t('Choose an audio file smaller than 2 MB.')
        : e.code === 'too_long' ? t('Choose a sound no longer than {0} seconds.', MAX_SOUND_SECONDS)
          : t('This audio could not be read. Try a different MP3, WAV or OGG file.'))
    } finally {
      importing.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const remove = id => {
    previewRequest.current++
    stopSound()
    update(s => removeCustomSound(s, id))
    setError(''); setMessage(t('Sound removed. Alerts using it now use Classic.'))
  }

  return <div className="sound-settings">
    <h3>{t('Sound preferences')}</h3>
    <p className="muted small">{t('Choose a sound for each alert. Preview works even when sounds are turned off.')}</p>
    {!S.sound && <div className="sound-settings-note"><Icon name="bellSlash" /><span>{t('Sounds are off. Enable Sounds in Settings to hear these alerts.')}</span></div>}
    <div className="sect-b">
      {SOUND_EVENTS.map(event => {
        const choice = soundChoice(S, event.id)
        return <div key={event.id} className="sound-setting-row">
          <SelectRow icon={EVENT_ICONS[event.id] || 'bell'} iconTint="var(--acc)" title={t(event.label)}
            stackedValue value={choice.id} options={options} onChange={id => choose(event.id, id)} />
          <button className="iconbtn" type="button" aria-label={t('Preview {0}', t(event.label))}
            disabled={choice.id === 'silent'} onClick={() => preview(event.id)}><Icon name="play" /></button>
        </div>
      })}
    </div>
    <p className="sect-f">{t('Your device’s volume, silent mode and notification settings still apply. Browser notifications may use the system sound.')}</p>
    {legacyNotificationSound && <p className="sect-f">{t('On Android 7 or earlier, scheduled reminders use the device notification sound.')}</p>}
    <div className="sound-settings-heading"><h4>{t('Custom sounds')}</h4><span className="small muted">{custom.length} / {MAX_CUSTOM_SOUNDS}</span></div>
    <p className="muted small">{t('Add up to {0} short audio files, each no longer than {1} seconds and smaller than 2 MB.', MAX_CUSTOM_SOUNDS, MAX_SOUND_SECONDS)}</p>
    {!!custom.length && <div className="sect-b sound-custom-list">
      {custom.map(sound => <div className="lrow" key={sound.id}>
        <span className="lrow-m"><span className="lrow-t">{sound.name}</span><span className="lrow-s">{t('{0} seconds', Number(sound.duration || 0).toFixed(1))}</span></span>
        <button type="button" className="iconbtn" aria-label={t('Delete {0}', sound.name)} onClick={() => remove(sound.id)}><Icon name="trash" /></button>
      </div>)}
    </div>}
    <input ref={input} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" aria-label={t('Import audio')} hidden onChange={importFile} />
    <Button icon="upload" disabled={busy || custom.length >= MAX_CUSTOM_SOUNDS} onClick={() => input.current?.click()}>
      {busy ? t('Reading audio…') : t('Add custom sound')}
    </Button>
    {error && <p className="sound-settings-error small" role="alert">{error}</p>}
    {message && <p className="small muted" role="status">{message}</p>}
  </div>
}
