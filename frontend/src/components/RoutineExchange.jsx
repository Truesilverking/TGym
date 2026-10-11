import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { buildRoutineExchangeFile, readRoutineExchangeFile, validateRoutineExchange, applyRoutineExchange, exchangeCatalogue, routineExchangeReviewKey, routineExchangeRows, ROUTINE_EXCHANGE_VERSION } from '../lib/routine-exchange.js'
import { displayReps } from '../lib/history.js'
import { saveReportFile } from '../lib/report-file.js'
import { Button } from './ui.jsx'
import './RoutineExchange.css'

export default function RoutineExchange({ close }) {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const [selection, setSelection] = useState(() => (S.routines || []).map(r => r.id)), [format, setFormat] = useState('json')
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [file, setFile] = useState(null)
  const [imported, setImported] = useState(null), [mappings, setMappings] = useState({}), [choices, setChoices] = useState({}), [schedule, setSchedule] = useState(false), [acceptAdaptations, setAcceptAdaptations] = useState(false)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [committed, setCommitted] = useState(false)
  const [legacyUnit, setLegacyUnit] = useState('')
  const input = useRef(null), abort = useRef(null), mounted = useRef(true), generation = useRef(0), working = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); generation.current++ } }, [])
  const catalogue = useMemo(() => exchangeCatalogue(S), [S])
  const reviewKey = routineExchangeReviewKey(S)
  useEffect(() => { setChoices({}); setReplaceConfirmed(false); setAcceptAdaptations(false) }, [reviewKey])
  const validation = useMemo(() => imported ? validateRoutineExchange(imported.data, S, { exerciseMappings: mappings, legacyUnit, conflicts: choices, locations: imported.locations }) : null, [imported, S, mappings, legacyUnit, choices])
  const errors = [...(imported?.errors || []), ...(validation?.errors || [])]
  const previewRoutines = Array.isArray(validation?.data?.routines) ? validation.data.routines.filter(routine => routine && typeof routine === 'object') : []
  const previewCatalog = Array.isArray(validation?.data?.catalog) ? validation.data.catalog.filter(ex => ex && typeof ex === 'object') : []
  const allChosen = validation?.conflicts.every(conflict => choices[conflict.key])
  const replacing = validation?.conflicts.some(conflict => choices[conflict.key] === 'replace')
  const adaptations = [...(validation?.adaptations || []), ...(imported?.warnings || [])]
  const previewRows = useMemo(() => {
    if (!validation?.data || errors.length) return []
    try { return routineExchangeRows(validation.data).Series } catch { return [] }
  }, [validation, imported])
  const prescription = (row, ex) => {
    const [, , type, min, max, weight, unit, rirMin, rirMax, , , pct, rule, automatic, sec, minutes, speed] = row
    const range = (lo, hi) => lo === hi ? String(hi) : `${lo}–${hi}`
    const target = type === 'Warm-up' && min === '' ? t('Automatic warm-up') : sec !== '' ? `${sec} s` : minutes !== '' ? `${minutes} min · ${speed} km/h` : `${range(displayReps(min, ex), displayReps(max, ex))} reps`
    return [target + (ex.side ? ` · ${t('per side')}` : ''), weight !== '' && minutes === '' ? `${weight} ${unit}` : '', rirMin !== '' ? `RIR ${range(rirMin, rirMax)}` : '', type === 'Back-off' ? `${pct}% · ${automatic ? rule === 'increased' ? t('Top reps +2') : rule === 'same' ? t('Same as Top reps') : String(rule) : t('Independent reps')}` : ''].filter(Boolean).join(' · ')
  }
  const cancel = () => { abort.current?.abort(); generation.current++; working.current = false; setBusy(false); setProgress(0) }
  const prepare = async (template = false) => {
    if (working.current) return
    const epoch = ++generation.current; abort.current = new AbortController(); working.current = true; setBusy(true); setError(''); setFile(null)
    try {
      const next = await buildRoutineExchangeFile(S, selection, template ? 'xlsx' : format, { template, signal: abort.current.signal, onProgress: value => { if (mounted.current && epoch === generation.current) setProgress(value) } })
      if (mounted.current && epoch === generation.current) setFile(next)
    } catch (e) { if (e.name !== 'AbortError' && mounted.current && epoch === generation.current) setError(t('Export failed: {0}', e.message || t('Could not export. Try again.'))) }
    finally { if (epoch === generation.current) { working.current = false; if (mounted.current) setBusy(false) } }
  }
  const download = async () => {
    if (working.current || !file) return
    working.current = true; setBusy(true); setError('')
    try { await saveReportFile(file); if (mounted.current) setProgress(100) }
    catch (e) { if (e.name !== 'AbortError' && mounted.current) setError(t('Could not save. Download again.')) }
    finally { working.current = false; if (mounted.current) setBusy(false) }
  }
  const chooseFile = async event => {
    const selected = event.target.files?.[0]; event.target.value = ''; if (!selected || working.current) return
    const epoch = ++generation.current; working.current = true; setBusy(true); setError(''); setImported(null); setCommitted(false); setChoices({}); setMappings({}); setSchedule(false); setAcceptAdaptations(false); setReplaceConfirmed(false); setLegacyUnit('')
    try { const parsed = await readRoutineExchangeFile(selected); if (mounted.current && epoch === generation.current) setImported({ ...parsed, name: selected.name }) }
    catch (e) { if (mounted.current && epoch === generation.current) setError(t('Import failed: {0}', e.message)) }
    finally { if (epoch === generation.current) { working.current = false; if (mounted.current) setBusy(false) } }
  }
  const apply = async () => {
    if (working.current || !committed && (errors.length || !validation?.valid || !allChosen || replacing && !replaceConfirmed || adaptations.length && !acceptAdaptations)) return
    working.current = true; setBusy(true); setError('')
    let saved = committed
    try {
      // Recheck against the live state inside the persisted update, then commit one complete draft.
      if (!saved) {
        update(current => { const next = applyRoutineExchange(current, validation, { conflicts: choices, schedule, acceptAdaptations, exerciseMappings: mappings, legacyUnit }); Object.assign(current, next) }, true, false)
        saved = true; setCommitted(true)
      }
      await useStore.getState().flushPersistence()
      if (useStore.getState().storageWarning === 'mirror') throw new Error('Profile mirror unavailable')
      setImported(null); setChoices({}); setMappings({}); setFile(null); setError(''); close()
    } catch (e) { setError(saved ? t('The routines are saved locally. Could not finish saving the local copy. Check available storage and retry saving; the import will not be repeated.') : t('Import failed: {0}', e.message)) }
    finally { working.current = false; if (mounted.current) setBusy(false) }
  }
  const changeSelection = ids => { setSelection(ids); setFile(null); setError('') }
  return <section className="routine-exchange" aria-label={t('Import / Export routines')}>
    <h3>{t('Import / Export routines')}</h3>
    <p className="small dim">{t('Routines and exercise prescriptions only. Workout results are kept separately.')}</p>
    <label className="routine-exchange-choice"><input type="checkbox" disabled={busy} checked={selection.length === (S.routines || []).length && selection.length > 0} onChange={event => changeSelection(event.target.checked ? S.routines.map(r => r.id) : [])}/>{t('Select All')}</label>
    <div className="routine-exchange-routines">{(S.routines || []).map(routine => <label className="routine-exchange-choice" key={routine.id}><input type="checkbox" disabled={busy} checked={selection.includes(routine.id)} onChange={event => changeSelection(event.target.checked ? [...selection, routine.id] : selection.filter(id => id !== routine.id))}/><span>{routine.name}</span><small>{routine.ex?.length || 0} {t('Exercises')}</small></label>)}</div>
    <label>{t('Format')}<select className="input" aria-label={t('Format')} disabled={busy} value={format} onChange={event => { setFormat(event.target.value); setFile(null) }}><option value="json">JSON v{ROUTINE_EXCHANGE_VERSION}</option><option value="xlsx">Excel (.xlsx) v{ROUTINE_EXCHANGE_VERSION}</option><option value="pdf">PDF</option></select></label>
    <p className="small dim">{t('Prepare {0} selected routines as {1}.', selection.length, format.toUpperCase())}</p>
    <Button variant="primary" disabled={busy || !selection.length} onClick={() => prepare()}>{t('Prepare export')}</Button>
    {busy && <><progress max="100" value={progress} aria-label={t('Export progress')}/>{!committed && <Button onClick={cancel}>{t('Cancel')}</Button>}</>}
    {file && <div className="routine-exchange-result"><div>{file.name}</div><Button disabled={busy} onClick={download}>{t('Download')}</Button></div>}
    <h4 className="sec">{t('Import routines')}</h4>
    <p className="small dim">{t('Use Excel or JSON. Download the template, choose exercises from its catalog lists, and review before saving.')}</p>
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}><Button disabled={busy} onClick={() => prepare(true)}>{t('Download Excel template')}</Button><Button disabled={busy || committed} onClick={() => input.current?.click()}>{t('Choose Excel / JSON')}</Button></div>
    <input ref={input} type="file" hidden accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile}/>
    {imported && <div className="routine-exchange-preview">
      <h4>{t('Review import')}</h4><p className="small">{imported.name}</p>
      {committed && <p role="status">{t('The complete import is saved locally. Retry saving the local copy.')}</p>}
      <fieldset disabled={busy || committed} className="routine-exchange-review-fields">
      <p>{t('{0} routines · {1} exercises', validation?.routineCount || 0, validation?.exerciseCount || 0)}</p>
      {validation?.data?.convertedLegacy && <p className="small dim">{t('Legacy plan v1 converted. No unknown exercise is removed automatically.')}</p>}
      {validation?.needsLegacyUnit && <label>{t('Source weight unit of the legacy file')}<select className="input" aria-label={t('Source weight unit of the legacy file')} value={legacyUnit} onChange={event => { setLegacyUnit(event.target.value); setChoices({}); setReplaceConfirmed(false) }}><option value="">{t('Choose how to import')}</option><option value="kg">kg</option><option value="lb">lb</option></select></label>}
      {previewRoutines.map((routine, index) => <details key={`${routine.id}-${index}`}>
        <summary>{String(routine.name || '')} ({Array.isArray(routine.ex) ? routine.ex.length : 0})</summary>
        {typeof routine.note === 'string' && routine.note && <p className="small">{routine.note}</p>}
        {(Array.isArray(routine.ex) ? routine.ex : []).map((ex, i) => ex && typeof ex === 'object' ? <div className="routine-exchange-exercise" key={i}>
          <strong className="small">{i + 1}. {String(previewCatalog.find(item => item.id === ex.id)?.n || catalogue.find(item => item.id === ex.id)?.n || ex.id || '')}</strong>
          {typeof ex.sg === 'string' && ex.sg && <p className="small">{t('Superset')}: {ex.sg}</p>}
          {typeof ex.note === 'string' && ex.note && <p className="small">{ex.note}</p>}
          <table className="routine-exchange-series small"><thead><tr><th>{t('Sets')}</th><th>{t('Prescription')}</th><th>{t('Rest')}</th></tr></thead><tbody>{previewRows.filter(row => row[0] === `${routine.id}:${i + 1}`).map(row => <tr key={row[1]}><td>{row[1]} · {row[2]}</td><td>{prescription(row, ex)}</td><td>{row[9]} s</td></tr>)}</tbody></table>
        </div> : null)}
      </details>)}
      {errors.length > 0 && <div role="alert"><p>{t('Fix these errors before importing:')}</p><ul>{errors.map((item, index) => <li key={index}>{item.sheet} {item.row ? `#${item.row}` : ''} · {item.field}: {item.message}</li>)}</ul></div>}
      {validation?.unresolved.map(item => <label key={item.id}>{t('Map unknown exercise: {0}', item.name)}<select className="input" aria-label={t('Map unknown exercise: {0}', item.name)} value={mappings[item.id] || ''} onChange={event => { setMappings(old => ({ ...old, [item.id]: event.target.value })); setChoices({}) }}><option value="">{t('Choose an exercise')}</option>{catalogue.map(ex => <option key={ex.id} value={ex.id}>{ex.selector}{ex.alias ? ` · ${ex.alias}` : ''}</option>)}</select></label>)}
      {validation?.conflicts.map(conflict => <div key={conflict.key}>
        <label>{t('Conflict: {0}', conflict.name)}<select className="input" aria-label={t('Conflict: {0}', conflict.name)} value={choices[conflict.key] || ''} onChange={event => { setChoices(old => ({ ...old, [conflict.key]: event.target.value })); setReplaceConfirmed(false); setAcceptAdaptations(false) }}><option value="">{t('Choose how to import')}</option>{(conflict.allowedChoices || (conflict.kind === 'unit' ? ['convert'] : ['keep', ...(conflict.kind !== 'routine' || conflict.existingId ? ['replace'] : []), ...(conflict.kind === 'routine' ? ['copy'] : [])])).map(choice => <option key={choice} value={choice}>{t(choice === 'convert' ? 'Convert weights to my current unit' : choice === 'keep' ? 'Keep existing' : choice === 'replace' ? 'Replace existing' : 'Import a separate copy')}</option>)}</select></label>
        {conflict.message && <p className="small dim">{conflict.message}</p>}
        {conflict.canMap && <label>{t('Choose an existing exercise instead')}<select className="input" aria-label={t('Choose an existing exercise instead')} value={mappings[conflict.sourceId || conflict.key.slice('catalog:'.length)] || ''} onChange={event => { setMappings(old => ({ ...old, [conflict.sourceId || conflict.key.slice('catalog:'.length)]: event.target.value })); setChoices({}); setAcceptAdaptations(false) }}><option value="">{t('Choose an exercise')}</option>{catalogue.map(ex => <option key={ex.id} value={ex.id}>{ex.selector}{ex.alias ? ` · ${ex.alias}` : ''}</option>)}</select></label>}
      </div>)}
      {replacing && <label className="routine-exchange-choice"><input type="checkbox" aria-label={t('I confirm replacing the selected existing data')} checked={replaceConfirmed} onChange={event => setReplaceConfirmed(event.target.checked)}/>{t('I confirm replacing the selected existing data')}</label>}
      <label className="routine-exchange-choice"><input type="checkbox" checked={schedule} onChange={event => setSchedule(event.target.checked)}/>{t('Apply imported schedule (preserves other routines)')}</label>
      {adaptations.length > 0 && <div className="routine-exchange-adaptations"><p>{t('Review the settings that differ on this device:')}</p><ul>{adaptations.map((item, index) => <li key={item.key || index}>{item.message}</li>)}</ul><label className="routine-exchange-choice"><input type="checkbox" aria-label={t('I accept these adaptations for this import')} checked={acceptAdaptations} onChange={event => setAcceptAdaptations(event.target.checked)}/>{t('I accept these adaptations for this import')}</label></div>}
      <p className="small dim">{t('Routine prescriptions retain their transferred settings. This device keeps its global preferences and workout history.')}</p>
      <p className="small dim">{t('Confirm saves the complete valid import at once. Existing history and active workouts are preserved.')}</p>
      </fieldset>
      <Button variant="primary" disabled={busy || !committed && (errors.length > 0 || !validation?.valid || !allChosen || replacing && !replaceConfirmed || adaptations.length > 0 && !acceptAdaptations)} onClick={apply}>{t(committed ? 'Retry saving' : 'Confirm import')}</Button>
      {!committed && <Button onClick={() => { setImported(null); setChoices({}); setMappings({}); setSchedule(false); setAcceptAdaptations(false); setReplaceConfirmed(false); setLegacyUnit(''); setError('') }}>{t('Cancel import')}</Button>}
    </div>}
    {error && <p role="alert">{error}</p>}
    <Button disabled={busy} onClick={close}>{t('Done')}</Button>
  </section>
}
