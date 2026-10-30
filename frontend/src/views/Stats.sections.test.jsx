// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { setLang, t } from '../lib/i18n.js'
import { STATS_VIEW_SECTIONS as STATS_SECTIONS } from '../lib/stats-sections.js'
import Stats from './Stats.jsx'
import BodyMap from '../components/BodyMap.jsx'
import {migrateState} from '../lib/state-migrations.js'
import {sessionTiming} from '../lib/workout-time.js'
import {setNav} from '../lib/nav.js'

vi.mock('../sheets.jsx', () => ({
  bwSheet: () => {}, goalSheet: () => {}, measurementsSheet: () => {}, heightSheet: () => {},
  sessionTimingSheet: () => {}, inBodySheet: () => {}, confirmSheet: () => {}, workoutDetailSheet: () => {},
  WorkoutRow: ({ w }) => React.createElement('div', null, w.name), bwDeltaColor: () => 'inherit',
}))
vi.mock('../components/LineChart.jsx', () => ({ default: () => React.createElement('div') }))
vi.mock('../components/MeasurementBodyMap.jsx', () => ({ default: () => React.createElement('div') }))
vi.mock('../components/BodyMap.jsx', () => ({
  default: vi.fn(() => React.createElement('div')), BodyMapLegend: () => React.createElement('div'),
}))

const NOW = new Date('2026-10-06T12:00:00-04:00').getTime()
let host
let root

function state() {
  return {
    ...structuredClone(DEF), lang: 'en', effort: 'rir', hasCompletedOnboarding: true,
    trainingStartDate: '2026-09-01',
    routines: [{ id: 'routine', name: 'Saved routine', ex: [] }], routineOrder: ['routine'],
    workouts: [{
      id: 'workout', routineId: 'routine', name: 'Saved routine', d: '2026-10-05',
      start: NOW - 86400000, end: NOW - 86400000 + 3600000, unit: 'kg',
      entries: [{ id: '1254', target: { mode: 'reps' }, sets: [{ done: true, w: 80, r: 8, rir: 2 }] }],
    }],
    bodyweight: [{ d: '2026-10-05', w: 80 }],
    measurements: [{ id: 'measurement', d: '2026-10-05', waist: 85 }],
  }
}

async function renderStats(show = true) {
  await act(async () => { root.render(<MemoryRouter initialEntries={['/stats']}><NavigationBridge />{show && <Stats />}<TestSheets /></MemoryRouter>) })
}

function NavigationBridge() {
  const navigate = useNavigate()
  React.useLayoutEffect(() => {
    setNav(navigate)
    return () => setNav(() => {})
  }, [navigate])
  return null
}

function TestSheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(sheet => <div key={sheet.id} data-test-sheet>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)
}

function section(id) {
  return host.querySelector(`[data-stats-section="${id}"]`)
}

function visibleSections() {
  return [...host.querySelectorAll('[data-stats-section]')].filter(node => !node.hidden)
    .map(node => node.dataset.statsSection)
}

function checkbox(id) {
  const label = STATS_SECTIONS.find(([value]) => value === id)?.[1]
  return [...host.querySelectorAll('[role="checkbox"]')].find(node => node.getAttribute('aria-label') === label)
}

function sectionsTrigger() {
  return host.querySelector('.stats-sections-trigger')
}

function sectionsMenu() {
  return host.querySelector('#stats-sections-menu')
}

async function click(node) {
  expect(node).toBeTruthy()
  await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

async function toggle(id) {
  await openSections()
  await click(checkbox(id))
}

async function openSections() {
  if (sectionsTrigger().getAttribute('aria-expanded') !== 'true') await click(sectionsTrigger())
}

async function jump(id) {
  await openSections()
  await click(sectionsMenu().querySelector(`[data-stats-option="${id}"] .stats-section-jump`))
  expect(sectionsMenu()).toBeNull()
  expect(visibleSections()).toEqual([id])
}

function button(scope, text) {
  return [...scope.querySelectorAll('button')].find(node => node.textContent.trim() === text)
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  localStorage.clear()
  useStore.setState({ S: state(), user: null, ready: true, storageWarning: null })
  useUI.setState({ sheets: [] })
  bindUI(useUI)
  await setLang('en')
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('configurable Stats sections', () => {
  it.each([undefined, null, [], ['retired-section'], 'history', {}])('uses only the initial selection for invalid preference %j', async preference => {
    const S = state()
    if (preference !== undefined) S.statsSections = preference
    else delete S.statsSections
    useStore.setState({ S })
    await renderStats()

    expect(visibleSections()).toEqual(['history'])
    await openSections()
    expect(checkbox('history').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('consistency').getAttribute('aria-checked')).toBe('true')
    expect(useStore.getState().S.statsSections).toEqual(preference)
    expect(localStorage.getItem('gym_state_v1')).toBeNull()
  })

  it('keeps an accessible floating section arrow outside the header actions', async () => {
    await renderStats()
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(sectionsTrigger().getAttribute('aria-controls')).toBe('stats-sections-menu')
    expect(sectionsMenu()).toBeNull()
    expect(host.querySelectorAll('[role="checkbox"]')).toHaveLength(0)
    expect(sectionsTrigger().compareDocumentPosition(section('history')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sectionsTrigger().closest('.stats-header-actions,.stats-header')).toBeNull()
    expect(sectionsTrigger().parentElement.classList.contains('stats-view-control')).toBe(true)
    expect(host.querySelectorAll('[data-tour="stats-view"]')).toHaveLength(1)
    expect(sectionsTrigger().getAttribute('aria-label')).toBe('Stats view settings')
    expect(host.querySelector('.stats-sections-label')).toBeNull()
    expect(sectionsTrigger().textContent).toBe('')
    expect(host.querySelector('.stats-order-actions')).toBeNull()
    expect(visibleSections()).toEqual(['history'])
  })

  it('opens all section choices in a labeled desktop popover', async () => {
    await renderStats()
    await openSections()
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('true')
    expect(sectionsMenu().getAttribute('role')).toBe('dialog')
    expect(sectionsMenu().getAttribute('aria-label')).toBe('Stats view settings')
    expect(sectionsMenu().getAttribute('role')).not.toBe('menu')
    expect(host.querySelectorAll('[role="checkbox"]')).toHaveLength(STATS_SECTIONS.length)
    for (const [id] of STATS_SECTIONS) expect(checkbox(id)).toBeTruthy()
    expect(checkbox('history').compareDocumentPosition(section('history')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(host.textContent).toContain('Sections')
    expect(host.textContent).toContain('Select at least one section.')
  })

  it('defers unselected maps until first opened and retains their controls after hiding', async () => {
    await renderStats()
    expect(section('muscles').children).toHaveLength(0)
    expect(section('measurements').children).toHaveLength(0)
    await toggle('muscles')
    expect(visibleSections()).toEqual(['history'])
    expect(section('muscles').children).toHaveLength(0)
    await jump('muscles')
    expect(section('muscles').children.length).toBeGreaterThan(0)
    await click(button(section('muscles'),'Strength'))
    await toggle('muscles')
    expect(section('muscles').hidden).toBe(true)
    expect(button(section('muscles'),'Strength').getAttribute('aria-pressed')).toBe('true')
    await toggle('muscles')
    await jump('muscles')
    expect(button(section('muscles'),'Strength').getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps visible charts stable through an input-only persisted clock update', async () => {
    const S=state()
    S.statsSections=['history','muscles']
    S.active=sessionTiming({id:'active',start:NOW-60000,lastUserInteractionAt:NOW-1000,entries:[]},NOW)
    useStore.setState({S:migrateState(S)})
    await renderStats()
    await jump('muscles')
    const calls=BodyMap.mock.calls.length
    await act(async()=>{
      vi.advanceTimersByTime(10)
      useStore.getState().recordInteraction(Date.now())
    })
    expect(useStore.getState().S.active.lastUserInteractionAt).toBe(NOW+10)
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.lastUserInteractionAt).toBe(NOW+10)
    expect(BodyMap.mock.calls.length).toBe(calls)
    // Shell also re-renders its route element for every live-store notification.
    await renderStats()
    expect(BodyMap.mock.calls.length).toBe(calls)
    await act(async()=>useStore.getState().update(s=>{s.workouts.push({...s.workouts[0],id:'another'})}))
    expect(BodyMap.mock.calls.length).toBeGreaterThan(calls)
  })

  it('refreshes translations when the language pack arrives without a profile edit', async () => {
    await renderStats()
    const before=useStore.getState().S,heading=host.querySelector('.stats-header h1').textContent
    await act(async()=>{await setLang('es')})
    expect(host.querySelector('.stats-header h1').textContent).toBe(t('Stats'))
    expect(host.querySelector('.stats-header h1').textContent).not.toBe(heading)
    expect(useStore.getState().S).toBe(before)
    expect(localStorage.getItem('gym_state_v1')).toBeNull()
  })

  it('renders one saved nondefault section without reactivating either initial section', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['bodyweight', 'retired-section', 'bodyweight'] } })
    await renderStats()
    expect(visibleSections()).toEqual(['bodyweight'])
    await openSections()
    expect(checkbox('history').getAttribute('aria-checked')).toBe('false')
    expect(checkbox('consistency').getAttribute('aria-checked')).toBe('false')
  })

  it('allows both initial sections to be deselected and keeps the selector accessible', async () => {
    await renderStats()
    await toggle('bodyweight')
    await toggle('history')
    await toggle('consistency')

    expect(visibleSections()).toEqual(['bodyweight'])
    expect(section('history').hidden).toBe(true)
    expect(section('consistency').hidden).toBe(true)
    expect(checkbox('history').closest('[hidden]')).toBeNull()
    expect(checkbox('consistency').closest('[hidden]')).toBeNull()
    expect(useStore.getState().S.statsSections).toEqual(['bodyweight'])
  })

  it('keeps multiple selections in their original order without duplicates', async () => {
    await renderStats()
    await toggle('bmi')
    await toggle('exercise')
    await toggle('overview')
    await toggle('duration')

    const selected = ['history', 'consistency', 'bmi', 'exercise', 'overview', 'duration']
    expect(visibleSections()).toEqual(['history'])
    expect(useStore.getState().S.statsSections).toEqual(selected)
    expect(useStore.getState().S.statsSectionOrder).toEqual(selected)
    for (const id of selected) expect(host.querySelectorAll(`[data-stats-section="${id}"]`)).toHaveLength(1)
    expect(visibleSections()).not.toContain('bodyweight')
  })

  it('blocks deselecting the final section while leaving the checkbox operable', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['bodyweight'] } })
    await renderStats()
    await openSections()
    const selected = checkbox('bodyweight')
    expect(selected.disabled).toBe(false)
    await click(selected)

    expect(visibleSections()).toEqual(['bodyweight'])
    expect(checkbox('bodyweight').getAttribute('aria-checked')).toBe('true')
    expect(useStore.getState().S.statsSections).toEqual(['bodyweight'])
    expect(host.textContent).toContain('Select at least one section.')
  })

  it('restores selection after leaving Stats and reopening the saved local profile', async () => {
    await renderStats()
    await toggle('measurements')
    await toggle('history')
    await toggle('consistency')
    const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.statsSections).toEqual(['measurements'])

    await renderStats(false)
    await renderStats()
    expect(visibleSections()).toEqual(['measurements'])
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(sectionsMenu()).toBeNull()

    await renderStats(false)
    useStore.setState({ S: { ...structuredClone(DEF), ...saved } })
    await renderStats()
    expect(visibleSections()).toEqual(['measurements'])
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    await openSections()
    expect(checkbox('history').getAttribute('aria-checked')).toBe('false')
    expect(checkbox('consistency').getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the popover open while selecting and deselecting sections', async () => {
    await renderStats()
    await openSections()
    await click(checkbox('bodyweight'))
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('true')
    expect(sectionsMenu()).not.toBeNull()
    await click(checkbox('history'))
    await click(checkbox('consistency'))
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('true')
    expect(visibleSections()).toEqual(['bodyweight'])
    expect(checkbox('bodyweight').getAttribute('aria-checked')).toBe('true')
  })

  it('closes from the trigger and reopens with the saved selection intact', async () => {
    await renderStats()
    await toggle('bodyweight')
    const selected = useStore.getState().S.statsSections
    await click(sectionsTrigger())
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(sectionsMenu()).toBeNull()
    expect(useStore.getState().S.statsSections).toEqual(selected)
    await openSections()
    expect(checkbox('bodyweight').getAttribute('aria-checked')).toBe('true')
  })

  it('closes on Escape from a checkbox and restores focus to the trigger', async () => {
    await renderStats()
    await openSections()
    const choice = checkbox('history')
    choice.focus()
    expect(document.activeElement).toBe(choice)
    await act(async () => { choice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(sectionsMenu()).toBeNull()
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(sectionsTrigger())
  })

  it('closes on outside pointer interaction and preserves inside pointer interaction', async () => {
    await renderStats()
    await openSections()
    await act(async () => {
      checkbox('history').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    })
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('true')
    await act(async () => { host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })) })
    expect(sectionsMenu()).toBeNull()
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(visibleSections()).toEqual(['history'])
  })

  it('dismisses the desktop popover when keyboard focus moves outside without stealing focus', async () => {
    await renderStats()
    await openSections()
    const outside = document.createElement('button')
    document.body.append(outside)
    try {
      await act(async () => { outside.focus() })
      expect(sectionsMenu()).toBeNull()
      expect(document.activeElement).toBe(outside)
      expect(useStore.getState().S.statsSectionOrder).toBeUndefined()
    } finally { outside.remove() }
  })

  it('persists selection order immediately and appends a reselected section at the end', async () => {
    await renderStats()
    await toggle('bodyweight')
    await toggle('history')
    await toggle('history')
    expect(visibleSections()).toEqual(['consistency'])
    expect(button(sectionsMenu(), 'Edit order')).toBeUndefined()
    expect(button(sectionsMenu(), 'Save')).toBeUndefined()
    expect(button(sectionsMenu(), 'Cancel')).toBeUndefined()
    expect(sectionsMenu().querySelectorAll('.stats-order-actions')).toHaveLength(STATS_SECTIONS.length + 3)
    expect(sectionsMenu().querySelector('button[aria-label="Move Training history up"]')).not.toBeNull()
    expect([...sectionsMenu().querySelectorAll('[data-stats-option]')]
      .filter(node => node.querySelector('[role="checkbox"][aria-checked="true"]'))
      .map(node => node.dataset.statsOption)).toEqual(['consistency', 'bodyweight', 'history'])
    const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.statsSections).toEqual(['consistency', 'bodyweight', 'history'])
    expect(saved.statsSectionOrder).toEqual(saved.statsSections)
    await renderStats(false)
    useStore.setState({ S: { ...structuredClone(DEF), ...saved } })
    await renderStats()
    expect(visibleSections()).toEqual(['consistency'])
  })

  it('reads a previously saved explicit order without resetting the selection', async () => {
    const S = { ...state(), statsSections: ['history', 'bodyweight'], statsSectionOrder: ['bodyweight', 'history', 'recent'] }
    useStore.setState({ S })
    await renderStats()
    expect(visibleSections()).toEqual(['bodyweight'])
    expect(useStore.getState().S).toBe(S)
    expect(localStorage.getItem('gym_state_v1')).toBeNull()
  })

  it('removes Recent workouts from Stats without deleting workouts or its History action', async () => {
    const S = { ...state(), statsSections: ['history', 'recent'] }
    useStore.setState({ S })
    await renderStats()
    await openSections()
    expect(checkbox('recent')).toBeUndefined()
    expect(section('recent')).toBeNull()
    expect(sectionsMenu().querySelector('[data-stats-option="workout-history"] .stats-section-jump').textContent).toBe('History')
    expect(useStore.getState().S.workouts).toEqual(S.workouts)
  })

  it('uses the shared mobile sheet and retains card filters while selection changes its order', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query === '(max-width: 639px)', media: query }))
    useStore.setState({ S: { ...state(), statsSections: ['history', 'muscles'] } })
    await renderStats()
    await jump('muscles')
    await click(button(section('muscles'), '30d'))
    await click(button(section('muscles'), 'Strength'))
    await openSections()
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(sectionsMenu().closest('[data-test-sheet]')).not.toBeNull()
    expect(sectionsMenu().classList.contains('stats-customization-sheet')).toBe(true)
    expect(host.querySelector('.stats-customization-popover')).toBeNull()
    expect(sectionsMenu().querySelector('.stats-customization-options').hasAttribute('data-nodrag')).toBe(true)
    await toggle('history')
    await toggle('history')
    expect(visibleSections()).toEqual(['muscles'])
    expect(useStore.getState().S.statsSections).toEqual(['muscles', 'history'])
    expect(button(section('muscles'), 'Strength').getAttribute('aria-pressed')).toBe('true')
    await click(button(sectionsMenu(), 'Done'))
    expect(sectionsMenu()).toBeNull()
    await click(button(section('muscles'), 'Muscle balance'))
    expect(button(section('muscles'), '30d').getAttribute('aria-pressed')).toBe('true')
  })

  it('preserves the muscle view and range while hiding and showing its section', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['history', 'muscles'] } })
    await renderStats()
    await jump('muscles')
    await click(button(section('muscles'), '30d'))
    await click(button(section('muscles'), 'Strength'))
    await toggle('muscles')
    expect(section('muscles').hidden).toBe(true)
    await toggle('muscles')
    await jump('muscles')
    expect(button(section('muscles'), 'Strength').getAttribute('aria-pressed')).toBe('true')
    await click(button(section('muscles'), 'Muscle balance'))
    expect(button(section('muscles'), '30d').getAttribute('aria-pressed')).toBe('true')
  })

  it('preserves the independent Routine duration period while hiding and showing its section', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['history', 'duration'] } })
    await renderStats()
    await jump('duration')
    await click(section('duration').querySelector('button.lrow-select'))
    await click(button(host.querySelector('[data-test-sheet]'), 'Last 30 days'))
    expect(section('duration').querySelector('.lrow-v').textContent).toBe('Last 30 days')
    await toggle('duration')
    expect(section('duration').hidden).toBe(true)
    await toggle('duration')
    await jump('duration')
    expect(section('duration').querySelector('.lrow-v').textContent).toBe('Last 30 days')
  })

  it('keeps the chosen measurement dates through visibility changes and resets them when measurement data changes', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['history', 'measurements'], measurements: [
      { id: 'first', d: '2026-09-01', waist: 90 },
      { id: 'second', d: '2026-09-10', waist: 88 },
      { id: 'third', d: '2026-09-20', waist: 86 },
      { id: 'last', d: '2026-10-05', waist: 85 },
    ] } })
    await renderStats()
    await jump('measurements')
    const dates = () => [...section('measurements').querySelectorAll('.body-dates select')]
    const choose = async (index, value) => act(async () => {
      dates()[index].value = value
      dates()[index].dispatchEvent(new Event('change', { bubbles: true }))
    })
    await choose(0, '1')
    await choose(1, '2')
    expect(dates().map(select => select.value)).toEqual(['1', '2'])

    await toggle('measurements')
    expect(section('measurements').hidden).toBe(true)
    expect(dates().map(select => select.value)).toEqual(['1', '2'])
    await toggle('measurements')
    await toggle('bodyweight')
    await jump('measurements')
    expect(dates().map(select => select.value)).toEqual(['1', '2'])

    await act(async () => { useStore.getState().update(s => { s.measurements[2].waist = 84.5 }) })
    expect(dates().map(select => select.value)).toEqual(['0', '3'])
    expect(useStore.getState().S.measurements[2].waist).toBe(84.5)
  })

  it('changes visibility without changing saved workouts, routines, measurements or weight', async () => {
    const original = state()
    useStore.setState({ S: original })
    await renderStats()
    await toggle('effort')
    await toggle('history')
    await toggle('consistency')
    await toggle('bodyweight')
    await toggle('effort')
    const current = useStore.getState().S
    for (const key of ['workouts', 'routines', 'measurements', 'bodyweight', 'trainingStartDate']) {
      expect(current[key]).toEqual(original[key])
    }
  })
})
