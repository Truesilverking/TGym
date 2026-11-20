import { useState } from 'react'
import { t } from '../lib/i18n.js'
import RoutineImport from './RoutineImport.jsx'
import RoutineExport from './RoutineExport.jsx'
import './RoutineExchange.css'

export default function RoutineExchange({ close, mode = 'import', onSaving }) {
  const [active, setActive] = useState(mode === 'export' ? 'export' : 'import'), [saving, setSaving] = useState(false)
  const savingChanged = value => { setSaving(value); onSaving?.(value) }
  return <section className="routine-exchange" aria-label={t('Import / Export routines')}>
    <h3>{t('Import / Export routines')}</h3>
    <div className="routine-exchange-modes" role="group" aria-label={t('Routine file action')}>
      <button type="button" aria-pressed={active === 'import'} disabled={saving} onClick={() => setActive('import')}>{t('Import routines')}</button>
      <button type="button" aria-pressed={active === 'export'} disabled={saving} onClick={() => setActive('export')}>{t('Export routines')}</button>
    </div>
    <div hidden={active !== 'import'} inert={active !== 'import'}><RoutineImport close={close} onSaving={savingChanged} /></div>
    <div hidden={active !== 'export'} inert={active !== 'export'}><RoutineExport close={close} /></div>
  </section>
}
