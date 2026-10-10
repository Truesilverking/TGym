import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { buildRoutineExchangeFile, readRoutineExchangeFile, validateRoutineExchange, applyRoutineExchange, exchangeCatalogue, routineExchangeReviewKey } from '../lib/routine-exchange.js'
import { saveReportFile } from '../lib/report-file.js'
import { Button } from './ui.jsx'
import './RoutineExchange.css'

export default function RoutineExchange({ close }) {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const [selection, setSelection] = useState(() => (S.routines || []).map(r => r.id)), [format, setFormat] = useState('json')
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [file, setFile] = useState(null)
  const [imported, setImported] = useState(null), [mappings, setMappings] = useState({}), [choices, setChoices] = useState({}), [schedule, setSchedule] = useState(false), [rules, setRules] = useState(false)
  const input = useRef(null), abort = useRef(null), mounted = useRef(true), generation = useRef(0), working = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); generation.current++ } }, [])
  const catalogue = useMemo(() => exchangeCatalogue(S), [S])
  const reviewKey = routineExchangeReviewKey(S)
  useEffect(() => { setChoices({}) }, [reviewKey])
  const validation = useMemo(() => imported ? validateRoutineExchange(imported.data, S, { exerciseMappings: mappings }) : null, [imported, S, mappings])
  const errors = [...(imported?.errors || []), ...(validation?.errors || [])]
  const previewRoutines = Array.isArray(validation?.data?.routines) ? validation.data.routines.filter(routine => routine && typeof routine === 'object') : []
  const previewCatalog = Array.isArray(validation?.data?.catalog) ? validation.data.catalog.filter(ex => ex && typeof ex === 'object') : []
  const allChosen = validation?.conflicts.every(conflict => choices[conflict.key])
  const cancel = () => { abort.current?.abort(); generation.current++; working.current = false; setBusy(false); setProgress(0) }
  const prepare = async (template = false) => {
    if (working.current) return
    const epoch = ++generation.current; abort.current = new AbortController(); working.current = true; setBusy(true); setError(''); setFile(null)
    try {
      const next = await buildRoutineExchangeFile(S, selection, template ? 'xlsx' : format, { template, signal: abort.current.signal, onProgress: value => { if (mounted.current && epoch === generation.current) setProgress(value) } })
      if (mounted.current && epoch === generation.current) setFile(next)
    } catch (e) { if (e.name !== 'AbortError' && mounted.current && epoch === generation.current) setError(t('Could not export. Try again.')) }
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
    const epoch = ++generation.current; working.current = true; setBusy(true); setError(''); setImported(null); setChoices({}); setMappings({})
    try { const parsed = await readRoutineExchangeFile(selected); if (mounted.current && epoch === generation.current) setImported({ ...parsed, name: selected.name }) }
    catch (e) { if (mounted.current && epoch === generation.current) setError(t('Import failed: {0}', e.message)) }
    finally { if (epoch === generation.current) { working.current = false; if (mounted.current) setBusy(false) } }
  }
  const apply = () => {
    if (working.current || errors.length || !validation?.valid || !allChosen) return
    working.current = true; setError('')
    try {
      // Recheck against the live state inside the persisted update, then commit one complete draft.
      update(current => { const next = applyRoutineExchange(current, validation, { conflicts: choices, schedule, rules, exerciseMappings: mappings }); Object.assign(current, next) })
      setImported(null); setChoices({}); setMappings({}); setFile(null); setError(''); close()
    } catch (e) { setError(t('Import failed: {0}', e.message)) }
    finally { working.current = false }
  }
  const changeSelection = ids => { setSelection(ids); setFile(null); setError('') }
  return <section className="routine-exchange" aria-label={t('Import / Export routines')}>
    <h3>{t('Import / Export routines')}</h3>
    <p className="small dim">{t('Routines and exercise prescriptions only. Workout results are kept separately.')}</p>
    <label className="routine-exchange-choice"><input type="checkbox" disabled={busy} checked={selection.length === (S.routines || []).length && selection.length > 0} onChange={event => changeSelection(event.target.checked ? S.routines.map(r => r.id) : [])}/>{t('Select All')}</label>
    <div className="routine-exchange-routines">{(S.routines || []).map(routine => <label className="routine-exchange-choice" key={routine.id}><input type="checkbox" disabled={busy} checked={selection.includes(routine.id)} onChange={event => changeSelection(event.target.checked ? [...selection, routine.id] : selection.filter(id => id !== routine.id))}/><span>{routine.name}</span><small>{routine.ex?.length || 0} {t('Exercises')}</small></label>)}</div>
    <label>{t('Format')}<select className="input" aria-label={t('Format')} disabled={busy} value={format} onChange={event => { setFormat(event.target.value); setFile(null) }}><option value="json">JSON v1</option><option value="xlsx">Excel (.xlsx) v1</option><option value="pdf">PDF</option></select></label>
    <p className="small dim">{t('Prepare {0} selected routines as {1}.', selection.length, format.toUpperCase())}</p>
    <Button variant="primary" disabled={busy || !selection.length} onClick={() => prepare()}>{t('Prepare export')}</Button>
    {busy && <><progress max="100" value={progress} aria-label={t('Export progress')}/><Button onClick={cancel}>{t('Cancel')}</Button></>}
    {file && <div className="routine-exchange-result"><div>{file.name}</div><Button disabled={busy} onClick={download}>{t('Download')}</Button></div>}
    <h4 className="sec">{t('Import routines')}</h4>
    <p className="small dim">{t('Use Excel or JSON. Download the template, choose exercises from its catalog lists, and review before saving.')}</p>
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}><Button disabled={busy} onClick={() => prepare(true)}>{t('Download Excel template')}</Button><Button disabled={busy} onClick={() => input.current?.click()}>{t('Choose Excel / JSON')}</Button></div>
    <input ref={input} type="file" hidden accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile}/>
    {imported && <div className="routine-exchange-preview">
      <h4>{t('Review import')}</h4><p className="small">{imported.name}</p>
      <p>{t('{0} routines · {1} exercises', validation?.routineCount || 0, validation?.exerciseCount || 0)}</p>
      {validation?.data?.convertedLegacy && <p className="small dim">{t('Legacy plan v1 converted. No unknown exercise is removed automatically.')}</p>}
      {previewRoutines.map((routine, index) => <details key={`${routine.id}-${index}`}><summary>{String(routine.name || '')} ({Array.isArray(routine.ex) ? routine.ex.length : 0})</summary>{(Array.isArray(routine.ex) ? routine.ex.filter(ex => ex && typeof ex === 'object') : []).map((ex, i) => <p className="small" key={i}>{i + 1}. {String(previewCatalog.find(item => item.id === ex.id)?.n || catalogue.find(item => item.id === ex.id)?.n || ex.id || '')} · {ex.setScheme === 'topback' ? `${ex.topSets || 1} Top + ${ex.backoffSets || 2} Back-off` : `${ex.sets || 1} ${t('Sets')}`}{typeof ex.note === 'string' && ex.note ? ` · ${ex.note}` : ''}</p>)}</details>)}
      {errors.length > 0 && <div role="alert"><p>{t('Fix these errors before importing:')}</p><ul>{errors.map((item, index) => <li key={index}>{item.sheet} {item.row ? `#${item.row}` : ''} · {item.field}: {item.message}</li>)}</ul></div>}
      {validation?.unresolved.map(item => <label key={item.id}>{t('Map unknown exercise: {0}', item.name)}<select className="input" aria-label={t('Map unknown exercise: {0}', item.name)} value={mappings[item.id] || ''} onChange={event => { setMappings(old => ({ ...old, [item.id]: event.target.value })); setChoices({}) }}><option value="">{t('Choose an exercise')}</option>{catalogue.map(ex => <option key={ex.id} value={ex.id}>{ex.selector}{ex.alias ? ` · ${ex.alias}` : ''}</option>)}</select></label>)}
      {validation?.conflicts.map(conflict => <label key={conflict.key}>{t('Conflict: {0}', conflict.name)}<select className="input" aria-label={t('Conflict: {0}', conflict.name)} value={choices[conflict.key] || ''} onChange={event => setChoices(old => ({ ...old, [conflict.key]: event.target.value }))}><option value="">{t('Choose how to import')}</option>{conflict.kind === 'unit' ? <option value="convert">{t('Convert weights to my current unit')}</option> : <><option value="keep">{t('Keep existing')}</option>{conflict.kind !== 'routine' || conflict.existingId ? <option value="replace">{t('Replace existing')}</option> : null}{conflict.kind === 'routine' && <option value="copy">{t('Import a separate copy')}</option>}</>}</select></label>)}
      <label className="routine-exchange-choice"><input type="checkbox" checked={schedule} onChange={event => setSchedule(event.target.checked)}/>{t('Apply imported schedule (preserves other routines)')}</label>
      <label className="routine-exchange-choice"><input type="checkbox" checked={rules} onChange={event => setRules(event.target.checked)}/>{t('Apply imported default rest, effort and Back-off preferences')}</label>
      <p className="small dim">{t('Confirm saves the complete valid import at once. Existing history and active workouts are preserved.')}</p>
      <Button variant="primary" disabled={busy || errors.length > 0 || !validation?.valid || !allChosen} onClick={apply}>{t('Confirm import')}</Button>
      <Button onClick={() => { setImported(null); setChoices({}); setMappings({}); setError('') }}>{t('Cancel import')}</Button>
    </div>}
    {error && <p role="alert">{error}</p>}
    <Button disabled={busy} onClick={close}>{t('Done')}</Button>
  </section>
}
