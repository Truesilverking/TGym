import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { buildRoutineExchangeFile, ROUTINE_EXCHANGE_VERSION } from '../lib/routine-exchange.js'
import { saveReportFile } from '../lib/report-file.js'
import { Button } from './ui.jsx'

export default function RoutineExport({ close }) {
  const S = useStore(s => s.S)
  const [selection, setSelection] = useState(() => (S.routines || []).map(r => r.id)), [format, setFormat] = useState('json')
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [file, setFile] = useState(null)
  const abort = useRef(null), mounted = useRef(true), generation = useRef(0), working = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); generation.current++ } }, [])
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
  const changeSelection = ids => { setSelection(ids); setFile(null); setError('') }
  return <section className="routine-export" aria-label={t('Export routines')}>
    <h4>{t('Export routines')}</h4>
    <p className="small dim">{t('Routines and exercise prescriptions only. Workout results are kept separately.')}</p>
    <label className="routine-exchange-choice"><input type="checkbox" disabled={busy} checked={selection.length === (S.routines || []).length && selection.length > 0} onChange={event => changeSelection(event.target.checked ? S.routines.map(r => r.id) : [])}/>{t('Select All')}</label>
    <div className="routine-exchange-routines">{(S.routines || []).map(routine => <label className="routine-exchange-choice" key={routine.id}><input type="checkbox" disabled={busy} checked={selection.includes(routine.id)} onChange={event => changeSelection(event.target.checked ? [...selection, routine.id] : selection.filter(id => id !== routine.id))}/><span>{routine.name}</span><small>{routine.ex?.length || 0} {t('Exercises')}</small></label>)}</div>
    <label>{t('Format')}<select className="input" aria-label={t('Format')} disabled={busy} value={format} onChange={event => { setFormat(event.target.value); setFile(null) }}><option value="json">JSON v{ROUTINE_EXCHANGE_VERSION}</option><option value="xlsx">Excel (.xlsx) v{ROUTINE_EXCHANGE_VERSION}</option><option value="pdf">PDF</option></select></label>
    <p className="small dim">{t('Prepare {0} selected routines as {1}.', selection.length, format.toUpperCase())}</p>
    <Button variant="primary" disabled={busy || !selection.length} onClick={() => prepare()}>{t('Prepare export')}</Button>
    {busy && <><progress max="100" value={progress} aria-label={t('Export progress')}/><Button onClick={cancel}>{t('Cancel')}</Button></>}
    {file && <div className="routine-exchange-result"><div>{file.name}</div><Button disabled={busy} onClick={download}>{t('Download')}</Button></div>}
    <Button disabled={busy} onClick={() => prepare(true)}>{t('Download Excel template')}</Button>
    {error && <p role="alert">{error}</p>}
    <Button disabled={busy} onClick={close}>{t('Done')}</Button>
  </section>
}
