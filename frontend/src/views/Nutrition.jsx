import { useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { isoOf, fmtDate, fmtNum, fmtWeight } from '../lib/format.js'
import { useLocalNow } from '../lib/use-local-now.js'
import { LB_PER_KG, CM_PER_IN } from '../lib/unit-conversion.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, NumberField, SearchField, Row, Switch } from '../components/ui.jsx'
import {
  COMMON_FOODS,
  NUTRITION_GOAL_MINIMUMS,
  calculateTDEE,
  getDailyNutrition,
  getNutritionGoals,
  nutritionTotals,
  logFoodItem,
  removeFoodItem,
  logWater,
  updateNutritionGoals,
  recentFoods,
  customFoods,
  removeCustomFood,
  copyDayItems,
} from '../lib/nutrition.js'

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sun' },
  { key: 'lunch', label: 'Lunch', icon: 'bolt' },
  { key: 'dinner', label: 'Dinner', icon: 'moon' },
  { key: 'snack', label: 'Snacks', icon: 'sparkles' },
]

// Display labels for lib/nutrition.js's activity keys; the factors stay in the lib.
const ACTIVITY_LABELS = {
  sedentary: 'Sedentary: little or no exercise',
  light: 'Light: 1–3 training days a week',
  moderate: 'Moderate: 3–5 training days a week',
  active: 'Very active: 6–7 training days a week',
  extreme: 'Athlete: extreme training load',
}

const pct = (value, goal) => Math.min(100, Math.round((value / Math.max(1, goal)) * 100))
const shiftIso = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  return isoOf(new Date(y, m - 1, d + days))   // local calendar arithmetic, no UTC drift
}
const macroLine = item => {
  const totals = nutritionTotals([item])
  return t('{0} kcal · P {1} g · C {2} g · F {3} g',
    fmtNum(totals.calories), fmtNum(totals.protein), fmtNum(totals.carbs), fmtNum(totals.fat))
}
const saveChange = action => {
  try {
    const result = action()
    if (result === false || result === null) { useUI.getState().toast(t('Enter a valid number')); return false }
    return true
  } catch {
    useUI.getState().toast(t('Could not save changes. Try again.'))
    return false
  }
}

export default function Nutrition() {
  const S = useStore(s => s.S)
  const today = isoOf(useLocalNow())
  const [selectedDate, setDateIso] = useState(null)
  const dateIso = selectedDate || today
  const daily = getDailyNutrition(S, dateIso)
  const { goals, totals } = daily
  const isToday = dateIso === today

  const remaining = goals.calories - totals.calories
  const prevIso = shiftIso(dateIso, -1)
  const prevCount = S.nutrition?.logs?.[prevIso]?.items?.length || 0
  const copyPrevious = () => {
    // A second click can arrive before the old empty-day button has unmounted.
    if (useStore.getState().S.nutrition?.logs?.[dateIso]?.items?.length) return
    saveChange(() => {
      const n = copyDayItems(prevIso, dateIso)
      if (n) useUI.getState().toast(t('{0} foods copied from {1}', n, fmtDate(prevIso, true)))
    })
  }
  const macros = [
    { key: 'protein', label: 'Protein', color: 'var(--teal)' },
    { key: 'carbs', label: 'Carbs', color: 'var(--orange)' },
    { key: 'fat', label: 'Fat', color: 'var(--yellow)' },
  ]

  const openGoals = () => useUI.getState().openSheet(close => <NutritionGoalsSheet close={close} S={S} goals={getNutritionGoals(S)} />)
  const openAddFood = meal => useUI.getState().openSheet(close => <AddFoodSheet close={close} dateIso={dateIso} initialMeal={meal} />)

  return (
    <div className="narrow">
      <div className="hdr hdr-centered">
        <span className="hdr-slot" aria-hidden="true" />
        <div className="hdr-center">
          <h1>{t('Nutrition')}</h1>
          <div className="sub">{t('Goal: {0} kcal', goals.calories)}</div>
        </div>
        <button className="iconbtn" onClick={openGoals} aria-label={t('Nutrition goals')}><Icon name="gear" /></button>
      </div>

      <div className="card nutri-date">
        <button className="iconbtn" onClick={() => setDateIso(shiftIso(dateIso, -1))} aria-label={t('Previous day')}><Icon name="chevronLeft" /></button>
        <button type="button" onClick={() => setDateIso(null)} disabled={isToday} aria-label={isToday ? undefined : t('Back to today')}>
          <b>{isToday ? t('Today') : fmtDate(dateIso, true)}</b>
          {isToday ? <small>{fmtDate(dateIso, true, true)}</small> : <small>{t('Tap to return to today')}</small>}
        </button>
        <button className="iconbtn" onClick={() => setDateIso(shiftIso(dateIso, 1))} aria-label={t('Next day')}><Icon name="chevronRight" /></button>
      </div>

      {!daily.items.length && prevCount > 0 && (
        <button type="button" className="nutri-copy" onClick={copyPrevious}>
          <Icon name="reset" /><span>{prevCount === 1 ? t('Copy 1 food from {0}', fmtDate(prevIso, true)) : t('Copy {0} foods from {1}', prevCount, fmtDate(prevIso, true))}</span>
        </button>
      )}

      <section className="card plate" aria-label={t('Daily calories')}>
        <div className="nutri-head">
          <div>
            <div className="lbl2">{t('Daily calories')}</div>
            <div className="nutri-figure">{totals.calories}<small>/ {goals.calories} kcal</small></div>
          </div>
          <div className={'nutri-left' + (remaining < 0 ? ' over' : '')}>
            {remaining >= 0 ? t('Remaining') : t('Over goal')}
            <b>{Math.abs(remaining)}</b>
          </div>
        </div>
        <div className="nutri-meter" aria-hidden="true"><i style={{ width: pct(totals.calories, goals.calories) + '%' }} /></div>

        <div className="nutri-macros">
          {macros.map(m => (
            <div key={m.key} className="nutri-macro" style={{ '--meter': m.color }}>
              <div className="lbl2">{t(m.label)}</div>
              <span className="nutri-figure">{totals[m.key]}<small>g</small></span>
              <small>{t('of {0} g', goals[m.key])}</small>
              <div className="nutri-meter" aria-hidden="true"><i style={{ width: pct(totals[m.key], goals[m.key]) + '%' }} /></div>
            </div>
          ))}
        </div>

      </section>

      <section className="card" aria-label={t('Hydration')} style={{ '--meter': 'var(--blue)' }}>
        <div className="nutri-water-top">
          <div>
            <div className="lbl2">{t('Hydration')}</div>
            <span className="nutri-figure">{daily.waterMl}<small>/ {goals.water} ml</small></span>
          </div>
          <span className="tag nocap">{pct(daily.waterMl, goals.water)}%</span>
        </div>
        <div className="nutri-meter" aria-hidden="true"><i style={{ width: pct(daily.waterMl, goals.water) + '%' }} /></div>
        <div className="nutri-water-actions">
          <Button size="sm" onClick={() => saveChange(() => logWater(dateIso, -250))} disabled={daily.waterMl <= 0} aria-label={t('Remove {0} ml of water', 250)}>−250</Button>
          <Button size="sm" variant="tinted" onClick={() => saveChange(() => logWater(dateIso, 250))} aria-label={t('Add {0} ml of water', 250)}>+250</Button>
          <Button size="sm" variant="tinted" onClick={() => saveChange(() => logWater(dateIso, 500))} aria-label={t('Add {0} ml of water', 500)}>+500</Button>
        </div>
      </section>

      {MEALS.map(meal => {
        const items = daily.items.filter(it => it.meal === meal.key)
        const mealTotals = nutritionTotals(items), kcal = mealTotals.calories, protein = fmtNum(mealTotals.protein)
        return (
          <section key={meal.key} className="card nutri-meal" aria-label={t(meal.label)}>
            <div className="nutri-meal-head">
              <div style={{ minWidth: 0 }}>
                <h2><Icon name={meal.icon} />{t(meal.label)}</h2>
                {items.length > 0 && <span className="nutri-meal-sum">{t('{0} kcal · {1} g protein', kcal, protein)}</span>}
              </div>
              <Button size="sm" variant="tinted" icon="plus" onClick={() => openAddFood(meal.key)}>{t('Add')}</Button>
            </div>
            {items.length ? (
              <ul className="nutri-items">
                {items.map(item => (
                  <li key={item.id}>
                    <span className="grow">
                      <b>{item.name}{item.qty && item.qty !== 1 ? ` × ${item.qty}` : ''}</b>
                      <small>{macroLine(item)}</small>
                    </span>
                    <button className="iconbtn" onClick={() => saveChange(() => removeFoodItem(dateIso, item.id))} aria-label={t('Remove {0}', item.name)}><Icon name="trash" /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="nutri-empty">{t('Nothing logged yet')}</p>}
          </section>
        )
      })}
    </div>
  )
}

function AddFoodSheet({ close, dateIso, initialMeal }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const recent = recentFoods(S)
  const mine = customFoods(S)
  const [tab, setTab] = useState(recent.length ? 'recent' : 'common')
  const [meal, setMeal] = useState(initialMeal || 'lunch')
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState(1)
  const [name, setName] = useState('')
  const [serving, setServing] = useState('')
  const [calories, setCalories] = useState(null)
  const [protein, setProtein] = useState(null)
  const [carbs, setCarbs] = useState(null)
  const [fat, setFat] = useState(null)
  const [keep, setKeep] = useState(true)
  const committed = useRef(false)
  const form = useRef(null)
  const validQuantity = Number.isFinite(Number(qty)) && Number(qty) > 0
  const validMacros = [calories, protein, carbs, fat].every(value => value == null || Number.isFinite(Number(value)) && Number(value) >= 0)

  const query = search.trim().toLowerCase()
  const matches = list => query ? list.filter(f => f.name.toLowerCase().includes(query)) : list
  const myFoods = matches(mine)
  const foods = matches(COMMON_FOODS)

  const closeAfterSave = event => {
    // A mouse double-click can finish on the newly exposed page after the first
    // click closes this sheet. Consume only its continuing click; a new single
    // click or keyboard activation remains immediate and removes the listener.
    if (event?.detail > 0) window.addEventListener('click', next => {
      if (next.detail > 1) { next.preventDefault(); next.stopImmediatePropagation() }
    }, { capture: true, once: true })
    close()
  }
  const add = (food, event) => {
    if (committed.current || !validQuantity) return
    if (form.current?.querySelector('[aria-invalid="true"]')) { toast(t('Enter a valid number')); return }
    committed.current = true
    if (saveChange(() => logFoodItem(dateIso, { ...food, meal, qty }))) closeAfterSave(event)
    else committed.current = false
  }
  const addCustom = event => {
    if (committed.current || !name.trim() || !validMacros) return
    if (form.current?.querySelector('[aria-invalid="true"]')) { toast(t('Enter a valid number')); return }
    const food = { name: name.trim(), serving: serving.trim() || t('1 serving'), calories, protein, carbs, fat }
    committed.current = true
    if (!saveChange(() => logFoodItem(dateIso, { ...food, meal, qty: 1 }, { saveFood: keep }))) { committed.current = false; return }
    toast(keep ? t('Added and saved to My foods') : t('Added'))
    closeAfterSave(event)
  }
  const row = (food, key, onRemove) => (
    <div key={key} className="nutri-food-row">
      <button type="button" disabled={!validQuantity} onClick={event => add(food, event)}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontWeight: 600 }}>{food.name}</b>
          <small className="dim">{food.serving ? food.serving + ' · ' : ''}{macroLine({ ...food, qty: 1 })}</small>
        </span>
        <Icon name="plus" />
      </button>
      {onRemove && <button type="button" className="iconbtn" onClick={onRemove} aria-label={t('Remove {0}', food.name)}><Icon name="trash" /></button>}
    </div>
  )

  return (
    <div ref={form}>
      <h3>{t('Add food')}</h3>
      <div className="field-label">{t('Meal')}</div>
      <div className="chips choice-grid" style={{ marginBottom: 14 }}>
        {MEALS.map(m => (
          <button key={m.key} type="button" className={'chip' + (meal === m.key ? ' on' : '')} aria-pressed={meal === m.key} onClick={() => setMeal(m.key)}>{t(m.label)}</button>
        ))}
      </div>
      <Segmented options={[
        ...(recent.length ? [{ value: 'recent', label: t('Recent') }] : []),
        { value: 'common', label: t('Foods') },
        { value: 'custom', label: t('Create') },
      ]} value={tab} onChange={setTab} />
      <div style={{ height: 14 }} />
      {tab !== 'custom' ? (
        <>
          <div className="nutri-form" style={{ gridTemplateColumns: 'minmax(0,1fr) 92px', marginBottom: 10 }}>
            <SearchField value={search} onChange={e => setSearch(e.target.value)} onClear={() => setSearch('')} placeholder={t('Search food…')} aria-label={t('Search food…')} />
            <NumberField className="field" value={qty} onChange={setQty} validation={{ min: 0.1 }} retainInvalid aria-label={t('Servings')} title={t('Servings')} style={{ textAlign: 'center' }} />
          </div>
          <div className="nutri-food-list">
            {tab === 'recent' ? matches(recent).map((f, i) => row(f, 'r' + i)) : <>
              {myFoods.length > 0 && <div className="nutri-food-group">{t('My foods')}</div>}
              {myFoods.map(f => row(f, f.id, () => saveChange(() => removeCustomFood(f.id))))}
              {myFoods.length > 0 && foods.length > 0 && <div className="nutri-food-group">{t('Common foods')}</div>}
              {foods.map(f => row(f, f.id))}
            </>}
            {(tab === 'recent' ? !matches(recent).length : !myFoods.length && !foods.length) && <p className="nutri-empty" style={{ padding: 12, margin: 0 }}>{t('No matches')}</p>}
          </div>
        </>
      ) : (
        <>
          <div className="nutri-form">
            <label className="wide"><span className="field-label">{t('Food name')}</span>
              <input className="field" value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
            <label className="wide"><span className="field-label">{t('Serving (optional)')}</span>
              <input className="field" value={serving} onChange={e => setServing(e.target.value)} placeholder={t('e.g. 100 g or 1 cup')} autoComplete="off" /></label>
            <label><span className="field-label">{t('Calories (kcal)')}</span><NumberField className="field" decimal={false} nullable value={calories} onChange={setCalories} validation={{ min: 0 }} retainInvalid /></label>
            <label><span className="field-label">{t('Protein (g)')}</span><NumberField className="field" nullable value={protein} onChange={setProtein} validation={{ min: 0 }} retainInvalid /></label>
            <label><span className="field-label">{t('Carbs (g)')}</span><NumberField className="field" nullable value={carbs} onChange={setCarbs} validation={{ min: 0 }} retainInvalid /></label>
            <label><span className="field-label">{t('Fat (g)')}</span><NumberField className="field" nullable value={fat} onChange={setFat} validation={{ min: 0 }} retainInvalid /></label>
          </div>
          <div className="sect-b" style={{ marginTop: 14 }}>
            <Row title={t('Save to My foods')} subtitle={t('Find it again under Foods next time.')}><Switch checked={keep} onChange={setKeep} /></Row>
          </div>
          <div style={{ height: 16 }} />
          <Button variant="primary" disabled={!name.trim() || !validMacros} onClick={addCustom}>{t('Add food')}</Button>
        </>
      )}
    </div>
  )
}

function NutritionGoalsSheet({ close, S, goals }) {
  const toast = useUI(s => s.toast)
  const [tab, setTab] = useState('tdee')
  const [manual, setManual] = useState({ calories: goals.calories, protein: goals.protein, carbs: goals.carbs, fat: goals.fat, water: goals.water })
  const lastWeight = (Array.isArray(S.bodyweight) ? S.bodyweight : []).filter(b => b && Number.isFinite(Number(b.w)) && Number(b.w) > 0).sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')) || (Number(a.t) || 0) - (Number(b.t) || 0)).at(-1)
  const weightUnit = ['kg', 'lb'].includes(lastWeight?.unit) ? lastWeight.unit : S.unit
  const [weightKg, setWeightKg] = useState(lastWeight ? Math.round((weightUnit === 'lb' ? lastWeight.w / LB_PER_KG : Number(lastWeight.w)) * 10) / 10 : 75)
  const storedHeight = Number(S.heightCm)
  const [heightCm, setHeightCm] = useState(Number.isFinite(storedHeight) && storedHeight > 0 ? Math.round(storedHeight * (S.measurementUnit === 'in' ? CM_PER_IN : 1) * 100) / 100 : 175)
  const [age, setAge] = useState(28)
  const [sex, setSex] = useState(S.body === 'female' ? 'female' : 'male')
  const [activity, setActivity] = useState('moderate')
  const [goal, setGoal] = useState('maintain')
  const preview = calculateTDEE({ weightKg, heightCm, age, sex, activity, goal })
  const committed = useRef(false)
  const form = useRef(null)
  const validCalculator = [weightKg, heightCm, age].every(value => Number.isFinite(Number(value)) && Number(value) > 0)
  const validManual = Object.entries(manual).every(([key, value]) => Number.isFinite(Number(value)) && Number(value) >= NUTRITION_GOAL_MINIMUMS[key])

  const save = values => {
    if (committed.current) return
    if (form.current?.querySelector('[aria-invalid="true"]')) { toast(t('Enter a valid number')); return }
    committed.current = true
    if (!saveChange(() => updateNutritionGoals(values))) { committed.current = false; return }
    toast(t('Nutrition goals updated'))
    close()
  }
  const setField = key => value => setManual(m => ({ ...m, [key]: value }))

  return (
    <div ref={form}>
      <h3>{t('Nutrition goals')}</h3>
      <Segmented options={[{ value: 'tdee', label: t('Calculator') }, { value: 'manual', label: t('Manual') }]} value={tab} onChange={setTab} />
      <div style={{ height: 16 }} />
      {tab === 'tdee' ? (
        <>
          <div className="nutri-form" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            <label><span className="field-label">{t('Weight (kg)')}</span><NumberField className="field" value={weightKg} displayValue={fmtWeight(weightKg)} onChange={setWeightKg} validation={{ min: 1 }} retainInvalid /></label>
            <label><span className="field-label">{t('Height (cm)')}</span><NumberField className="field" value={heightCm} onChange={setHeightCm} validation={{ min: 1 }} retainInvalid /></label>
            <label><span className="field-label">{t('Age')}</span><NumberField className="field" decimal={false} value={age} onChange={setAge} validation={{ min: 1 }} retainInvalid /></label>
          </div>
          <div className="field-label" style={{ marginTop: 14 }}>{t('Biological sex')}</div>
          <Segmented options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]} value={sex} onChange={setSex} />
          <div className="field-label" style={{ marginTop: 14 }}>{t('Activity level')}</div>
          <div className="chips choice-grid">
            {Object.keys(ACTIVITY_LABELS).map(key => (
              <button key={key} type="button" className={'chip nocap' + (activity === key ? ' on' : '')} aria-pressed={activity === key} onClick={() => setActivity(key)}>{t(ACTIVITY_LABELS[key])}</button>
            ))}
          </div>
          <div className="field-label" style={{ marginTop: 14 }}>{t('Goal')}</div>
          <Segmented options={[{ value: 'cut', label: t('Cut') }, { value: 'maintain', label: t('Maintain') }, { value: 'bulk', label: t('Bulk') }]} value={goal} onChange={setGoal} />
          <div style={{ height: 16 }} />
          <div className="nutri-result">
            <div className="lbl2">{t('Suggested target')}</div>
            <span className="nutri-figure">{preview.calories}<small>kcal</small></span>
            <div className="small dim">{t('TDEE {0} kcal · BMR {1} kcal', preview.tdee, preview.bmr)}</div>
            <dl>
              <div><dt>{t('Protein')}</dt><dd>{preview.protein} g</dd></div>
              <div><dt>{t('Carbs')}</dt><dd>{preview.carbs} g</dd></div>
              <div><dt>{t('Fat')}</dt><dd>{preview.fat} g</dd></div>
              <div><dt>{t('Water')}</dt><dd>{preview.water} ml</dd></div>
            </dl>
          </div>
          <div style={{ height: 16 }} />
          <Button variant="primary" disabled={!validCalculator} onClick={() => save(preview)}>{t('Apply recommendation')}</Button>
        </>
      ) : (
        <>
          <div className="nutri-form">
            <label className="wide"><span className="field-label">{t('Daily calories (kcal)')}</span><NumberField className="field" decimal={false} value={manual.calories} onChange={setField('calories')} validation={{ min: NUTRITION_GOAL_MINIMUMS.calories }} retainInvalid /></label>
            <label><span className="field-label">{t('Protein (g)')}</span><NumberField className="field" decimal={false} value={manual.protein} onChange={setField('protein')} validation={{ min: NUTRITION_GOAL_MINIMUMS.protein }} retainInvalid /></label>
            <label><span className="field-label">{t('Carbs (g)')}</span><NumberField className="field" decimal={false} value={manual.carbs} onChange={setField('carbs')} validation={{ min: NUTRITION_GOAL_MINIMUMS.carbs }} retainInvalid /></label>
            <label><span className="field-label">{t('Fat (g)')}</span><NumberField className="field" decimal={false} value={manual.fat} onChange={setField('fat')} validation={{ min: NUTRITION_GOAL_MINIMUMS.fat }} retainInvalid /></label>
            <label><span className="field-label">{t('Daily water (ml)')}</span><NumberField className="field" decimal={false} value={manual.water} onChange={setField('water')} validation={{ min: NUTRITION_GOAL_MINIMUMS.water }} retainInvalid /></label>
          </div>
          <div style={{ height: 16 }} />
          <Button variant="primary" disabled={!validManual} onClick={() => save(manual)}>{t('Save goals')}</Button>
        </>
      )}
    </div>
  )
}
