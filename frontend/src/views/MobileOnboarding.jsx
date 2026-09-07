import { useRef, useState } from 'react'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { GUIDED_PLANS, createGuidedPlan } from '../lib/guided-plans.js'
import { setDevicePin } from '../lib/app-lock.js'
import { setLang, t } from '../lib/i18n.js'
import { convertMeasurementState, convertWeightState } from '../lib/unit-conversion.js'
import { Button, Segmented } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { parseTGymJson } from '../lib/json-import.js'
import { mergePlan } from '../lib/plan-share.js'

const EQUIPMENT = ['body weight', 'dumbbell', 'barbell', 'cable', 'leverage machine']

export default function MobileOnboarding() {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const replaceState = useStore(s => s.replaceState), finish = useStore(s => s.completeOnboarding)
  const toast = useUI(s => s.toast)
  const [step, setStep] = useState(0), [equipment, setEquipment] = useState(new Set()), [planId, setPlanId] = useState('')
  const [pin, setPin] = useState(''), [again, setAgain] = useState(''), [recovery, setRecovery] = useState('')
  const fileRef = useRef(null), next = () => setStep(x => Math.min(6, x + 1))
  const importBackup = e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    const rd = new FileReader()
    rd.onload = () => { try {
      const imported = parseTGymJson(rd.result)
      if (imported.kind === 'plan') {
        // A routine import must not reset choices already made on steps 1–2. Starting from
        // DEF used to silently put the tutorial back in Spanish/kg here.
        const data = JSON.parse(JSON.stringify(S))
        mergePlan(data, imported.bundle, { schedule: true })
        replaceState(data, false); toast(t('Added {0} routines to your plan', imported.bundle.routineCount)); setStep(4); return
      }
      replaceState(Object.assign(JSON.parse(JSON.stringify(DEF)), imported.data), false); toast(t('Backup imported')); setStep(6)
    } catch { toast(t('Could not read that backup')) } }
    rd.readAsText(f)
  }
  const installPlan = id => { const plan = createGuidedPlan(id, t); setPlanId(id); update(s => { s.routines.push(...plan.routines); Object.assign(s.week, plan.week) }); next() }
  const saveEquipment = () => { if (equipment.size) update(s => { const id = 'onboarding-gym'; s.equipProfiles = [{ id, name: t('My gym'), equipment: [...equipment] }]; s.activeEquipId = id; s.equipFilterOn = true }); next() }
  const savePin = async () => { if (!pin) { next(); return }; if (!/^\d{4}$/.test(pin)) return toast(t('PIN must contain 4 digits')); if (pin !== again) return toast(t('PINs do not match')); setRecovery(await setDevicePin(pin)) }
  const chooseLanguage = value => {
    update(s => { s.lang = value }, false)
    // Apply the dictionary immediately; App's effect remains a safety net for imported data.
    void setLang(value)
  }
  const chooseUnits = value => update(s => {
    convertWeightState(s, value)
    convertMeasurementState(s, value === 'lb' ? 'in' : 'cm')
  }, false)
  return <div className="narrow" style={{ paddingTop: 28 }}>
    <div className="row between" style={{ marginBottom: 20 }}><div><h1>TGym</h1><div className="sub">{t('Initial setup')} · {step + 1}/7</div></div><Icon name="figureStrength" style={{ color: 'var(--red)', fontSize: 34 }} /></div>
    {step === 0 && <><h2>{t('Language')}</h2><div className="muted" style={{ marginBottom: 16 }}>{t('You can change this later in Settings.')}</div><Segmented value={S.lang || 'es'} onChange={chooseLanguage} options={[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }]} /><Nav next={next} /></>}
    {step === 1 && <><h2>{t('Units and experience')}</h2><div className="small muted" style={{ margin: '12px 0 6px' }}>{t('Weight unit')}</div><Segmented value={S.unit} onChange={chooseUnits} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} /><div className="small muted" style={{ margin: '16px 0 6px' }}>{t('Training level')}</div><Segmented value={S.trainingLevel || 'beginner'} onChange={v => update(s => { s.trainingLevel = v })} options={[{ value: 'beginner', label: t('Beginner') }, { value: 'intermediate', label: t('Intermediate') }, { value: 'advanced', label: t('Advanced') }]} /><Nav next={next} /></>}
    {step === 2 && <><h2>{t('Available equipment')}</h2><div className="muted small" style={{ marginBottom: 12 }}>{t('This only improves suggestions. You can always see every exercise.')}</div><div className="chips">{EQUIPMENT.map(x => <button key={x} className={'chip' + (equipment.has(x) ? ' on' : '')} onClick={() => setEquipment(old => { const n = new Set(old); n.has(x) ? n.delete(x) : n.add(x); return n })}>{t(x)}</button>)}</div><Nav next={saveEquipment} /></>}
    {step === 3 && <><h2>{t('Choose how to begin')}</h2><div className="list">{GUIDED_PLANS.map(p => <div key={p.id} className="item" onClick={() => installPlan(p.id)}><span className="lrow-i"><Icon name="clipboard" /></span><div className="grow"><div className="tt">{t(p.title)}</div><div className="ss">{t(p.description)}</div></div><Icon name="chevronRight" /></div>)}<div className="item" onClick={next}><span className="lrow-i"><Icon name="plus" /></span><div className="grow"><div className="tt">{t('Create from scratch')}</div></div><Icon name="chevronRight" /></div><div className="item" onClick={() => fileRef.current.click()}><span className="lrow-i"><Icon name="upload" /></span><div className="grow"><div className="tt">{t('Import openGym or TGym backup')}</div></div><Icon name="chevronRight" /></div></div><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importBackup} /></>}
    {step === 4 && <><h2>{t('Default rest')}</h2><div className="muted small" style={{ marginBottom: 14 }}>{t('Exercises and routines can override this later.')}</div><Segmented value={S.restSec} onChange={v => update(s => { s.restSec = v })} options={[60, 90, 120, 180].map(v => ({ value: v, label: v + 's' }))} /><Nav next={next} /></>}
    {step === 5 && (recovery ? <><h2>{t('Save your recovery key')}</h2><div className="muted small">{t('Keep it somewhere private. It is the only way to enter TGym if you forget the PIN.')}</div><div className="card" style={{ textAlign: 'center', fontSize: 20, letterSpacing: 2, marginTop: 14 }}><b>{recovery}</b></div><Nav next={next} /></> : <><h2>{t('Protect TGym')}</h2><div className="muted small" style={{ marginBottom: 14 }}>{t('A device-only PIN is optional and recommended.')}</div><input className="input" type="password" inputMode="numeric" maxLength={4} placeholder={t('4-digit PIN')} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /><input className="input" style={{ marginTop: 10 }} type="password" inputMode="numeric" maxLength={4} placeholder={t('Repeat PIN')} value={again} onChange={e => setAgain(e.target.value.replace(/\D/g, '').slice(0, 4))} /><Nav next={savePin} /></>)}
    {step === 6 && <><h2>{t('Everything is ready')}</h2><div className="card"><div className="row between"><span>{t('Language')}</span><b>{S.lang === 'es' ? 'Español' : 'English'}</b></div><div className="row between" style={{ marginTop: 10 }}><span>{t('Weight unit')}</span><b>{S.unit}</b></div><div className="row between" style={{ marginTop: 10 }}><span>{t('Routine')}</span><b>{planId ? t(GUIDED_PLANS.find(p => p.id === planId)?.title) : t('Custom or imported')}</b></div></div><div style={{ height: 14 }} /><Button variant="primary" onClick={finish}>{t('Start using TGym')}</Button></>}
  </div>
}

function Nav({ next }) { return <><div style={{ height: 20 }} /><Button variant="primary" onClick={next}>{t('Continue')}</Button><div style={{ height: 6 }} /><Button variant="ghost" className="dim" onClick={next}>{t('Skip for now')}</Button></> }
