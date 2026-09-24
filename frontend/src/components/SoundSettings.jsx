import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { SOUND_EVENTS, SOUND_PRESETS, MAX_CUSTOM_SOUNDS, MAX_SOUND_SECONDS, soundChoice, soundVolume, soundEnabled, importCustomSound, removeCustomSound } from '../lib/sound-preferences.js'
import { playAppSound, stopSound, subscribeSound, getSoundPlayback, reportSoundError } from '../lib/sound.js'
import { syncNativeSounds } from '../lib/native-sound.js'
import { Button, Row, Switch } from './ui.jsx'
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
  const playback = useSyncExternalStore(subscribeSound, getSoundPlayback)
  const [browsing, setBrowsing] = useState(null)
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
    }).catch(error => { reportSoundError('settings-sync', error); if (mounted.current) setError(t('Could not sync alert sounds. Try again.')) })
    return () => { mounted.current = false; previewRequest.current++; stopSound() }
  }, [])

  const choose = (event, id) => {
    previewRequest.current++
    stopSound()
    update(s => { s.sounds = { ...s.sounds, [event]: id } })
  }
  const preview = async (event, soundId) => {
    if (playback.event === event && playback.soundId === soundId && ['playing','loading'].includes(playback.status)) { previewRequest.current++; stopSound(); return }
    const request = ++previewRequest.current
    setError('')
    stopSound()
    try {
      const played = await playAppSound(useStore.getState().S, event, { preview: true, soundId })
      if (played === false && mounted.current && request === previewRequest.current) setError(t(getSoundPlayback().error === 'audio_blocked' ? 'Audio is blocked. Tap Play again to enable it.' : 'Could not play this sound. Check device volume and try again.'))
    }
    catch { if (mounted.current && request === previewRequest.current) setError(t(getSoundPlayback().error === 'audio_blocked' ? 'Audio is blocked. Tap Play again to enable it.' : 'Could not play this sound. Check device volume and try again.')) }
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

  const changePreference = (key, value) => { previewRequest.current++; stopSound(); setError(''); update(s => { s[key] = value }) }
  const previewButton = (event, id, label) => {
    const active = playback.event === event && playback.soundId === id && ['playing','loading'].includes(playback.status)
    return <button className={'iconbtn sound-play' + (active ? ' playing' : '')} type="button"
      aria-label={t(active ? 'Stop {0}' : 'Preview {0}', label)} aria-pressed={active}
      disabled={id === 'silent' || !soundEnabled(S)} onClick={() => preview(event, id)}>
      <Icon name={active ? 'pause' : 'play'} />
    </button>
  }
  return <div className="sound-settings" data-nodrag>
    <h3>{t('Sound preferences')}</h3>
    <p className="muted small">{t('Listen before choosing. Preview never changes your saved sound.')}</p>
    <div className="sect-b sound-controls">
      <Row icon="bell" title={t('Sounds')}><Switch checked={S.sound !== false} onChange={v => changePreference('sound', v)} /></Row>
      <Row icon="bellSlash" title={t('Mute')}><Switch checked={!!S.soundMuted} onChange={v => changePreference('soundMuted', v)} /></Row>
      <div className="sound-volume"><label htmlFor="sound-volume">{t('Volume')} <output>{Math.round(soundVolume(S)*100)}%</output></label>
        <input id="sound-volume" type="range" min="0" max="100" step="1" value={Math.round(soundVolume(S)*100)} onChange={e => changePreference('soundVolume', Number(e.target.value)/100)} />
      </div>
    </div>
    {!soundEnabled(S) && <div className="sound-settings-note"><Icon name="bellSlash" /><span>{t('Audio is muted. Enable Sounds, turn off Mute and raise the volume to preview.')}</span></div>}
    <div className="sect-b">
      {SOUND_EVENTS.map(event => {
        const choice = soundChoice(S, event.id), expanded = browsing === event.id
        return <div key={event.id} className="sound-event">
          <div className="sound-setting-row">
            <button className="lrow tap" type="button" aria-expanded={expanded} onClick={() => { stopSound(); setBrowsing(expanded ? null : event.id) }}>
              <span className="lrow-i"><Icon name={EVENT_ICONS[event.id]} /></span>
              <span className="lrow-m"><span className="lrow-t">{t(event.label)}</span><span className="lrow-s">{options.find(o=>o.value===choice.id)?.label}</span></span>
              <Icon name="chevronDown" />
            </button>
            {previewButton(event.id, choice.id, t(event.label))}
          </div>
          {expanded && <div className="sound-options" aria-label={t(event.label)}>
            {options.map(option => <div key={option.value} className={'sound-option' + (choice.id === option.value ? ' selected' : '')}>
              <button type="button" className="sound-choice" aria-pressed={choice.id === option.value} onClick={() => choose(event.id, option.value)}>
                <span>{option.label}</span>{choice.id === option.value && <Icon name="checkCircle" />}
              </button>
              {previewButton(event.id, option.value, `${t(event.label)}: ${option.label}`)}
            </div>)}
          </div>}
        </div>
      })}
    </div>
    {playback.preview && ['playing','loading'].includes(playback.status) && <p className="sound-playing" role="status">{t(playback.status === 'playing' ? 'Playing: {0}' : 'Loading: {0}', options.find(o=>o.value===playback.soundId)?.label || '')}</p>}
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
