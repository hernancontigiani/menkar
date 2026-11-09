import './windows.css'
import { thresholdsOf } from '../core/context/levels'
import {
  parseFont,
  SCROLLBACK_MAX,
  SCROLLBACK_MIN,
  SCROLLBACK_STEP,
  shownTheme,
} from '../core/preferences'
import type { Settings } from '../core/settings'
import { PALETTES, THEME_NAMES } from '../core/theme'
import type { PreferencesInfo } from '../shared/ipc'
import { el } from './dom'
import { loadCatalog, t } from './i18n'
import { integrationsPage } from './integrations'
import { applyLook } from './look'

// The Preferences window: two pages, General and Integrations. Every change is saved at once, and
// main re-applies it in every window.

const api = window.menkar.preferences
let info: PreferencesInfo
let settings: Settings

async function set(
  key: Parameters<typeof api.set>[0],
  value: string | number | boolean,
): Promise<void> {
  settings = await api.set(key, value)
  applyLook(settings)
}

function group(
  title: string,
  rows: HTMLElement[],
  options: { description?: string; action?: HTMLElement } = {},
) {
  return el(
    'section',
    { class: 'group' },
    el(
      'div',
      { class: 'group-head' },
      el('div', { class: 'group-title' }, title),
      options.action ?? null,
    ),
    options.description ? el('p', { class: 'group-description dim' }, options.description) : null,
    el('div', { class: 'card' }, ...rows),
  )
}

function row(
  title: string,
  subtitle: string | null,
  ...controls: (HTMLElement | null)[]
): HTMLElement {
  return el(
    'div',
    { class: 'row' },
    el(
      'div',
      { class: 'row-text' },
      el('div', { class: 'row-title' }, title),
      subtitle ? el('div', { class: 'row-subtitle' }, subtitle) : null,
    ),
    ...controls,
  )
}

function toggle(
  key: 'show_folder_path' | 'notify_idle' | 'notify_sound' | 'reopen_tabs',
): HTMLElement {
  const input = el('input', { type: 'checkbox', role: 'switch', 'data-key': key })
  input.checked = settings[key]
  input.addEventListener('change', () => void set(key, input.checked))
  return input
}

// A row that, collapsed, shows its title and the current choice; expanded, one radio per choice.
function expander(
  name: string,
  title: string,
  choices: readonly { value: string; label: string; extra?: HTMLElement }[],
  current: string,
  choose: (value: string) => void,
): HTMLElement {
  const subtitle = el(
    'div',
    { class: 'row-subtitle' },
    choices.find((c) => c.value === current)?.label ?? '',
  )
  const details = el(
    'details',
    { class: 'expander', 'data-expander': name },
    el(
      'summary',
      { class: 'row' },
      el('div', { class: 'row-text' }, el('div', { class: 'row-title' }, title), subtitle),
    ),
  )
  for (const choice of choices) {
    const radio = el('input', { type: 'radio', name, value: choice.value })
    radio.checked = choice.value === current
    radio.addEventListener('change', () => {
      if (!radio.checked) return
      subtitle.textContent = choice.label
      choose(choice.value)
    })
    details.append(
      el(
        'label',
        { class: 'row choice' },
        radio,
        el('div', { class: 'row-text' }, choice.label),
        choice.extra ?? null,
      ),
    )
  }
  return details
}

// A strip of the theme's background, a bar of its foreground and its six accent colors; Default is
// plain gray.
function swatch(theme: string): HTMLElement {
  const palette = PALETTES[theme]
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'swatch')
  svg.setAttribute('viewBox', '0 0 130 22')
  const rect = (x: number, y: number, w: number, h: number, fill: string) => {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    for (const [k, v] of Object.entries({ x, y, width: w, height: h, fill }))
      r.setAttribute(k, String(v))
    svg.append(r)
  }
  if (!palette) {
    rect(0, 0, 130, 22, 'rgb(140, 140, 140)')
    return svg as unknown as HTMLElement
  }
  rect(0, 0, 130, 22, palette.bg)
  rect(6, 4, 10, 14, palette.fg)
  for (let i = 0; i < 6; i += 1)
    rect(130 - 96 + i * 16, 4, 13, 14, palette.ansi[i + 1] ?? palette.fg)
  return svg as unknown as HTMLElement
}

function fontRow(): HTMLElement {
  const current = parseFont(settings.font)
  const family = el('select', { 'data-key': 'font-family', 'aria-label': t('prefs.font') })
  family.append(el('option', { value: '' }, t('prefs.fontDefault')))
  const families = new Set(info.fonts)
  if (current.family) families.add(current.family)
  for (const name of [...families].sort((a, b) => a.localeCompare(b))) {
    family.append(el('option', { value: name }, name))
  }
  family.value = settings.font ? current.family : ''
  const size = el('input', {
    type: 'number',
    min: '6',
    max: '72',
    step: '1',
    'data-key': 'font-size',
    'aria-label': t('prefs.fontSize'),
  })
  size.value = String(current.size ?? 10)
  const save = () => void set('font', family.value ? `${family.value} ${size.value || 10}` : '')
  family.addEventListener('change', save)
  size.addEventListener('change', save)
  const reset = el('button', { title: t('prefs.fontReset'), 'data-key': 'font-reset' }, '⌫')
  reset.addEventListener('click', () => {
    family.value = ''
    size.value = '10'
    void set('font', '')
  })
  return row(t('prefs.font'), t('prefs.fontSubtitle'), family, size, reset)
}

// The ring's two edges: yellow from, red from. A pair that is not whole numbers from 1 to 100 with
// yellow below red is refused with our sentence, and the last valid values come back.
function ringGroup(): HTMLElement {
  const input = (key: 'ring_warn' | 'ring_full') => {
    const field = el('input', { type: 'number', min: '1', max: '100', step: '1', 'data-key': key })
    field.value = String(settings[key])
    return field
  }
  const warn = input('ring_warn')
  const full = input('ring_full')
  const error = el('div', { class: 'row-subtitle dim', 'data-key': 'ring-error', hidden: '' })
  const edit = async (key: 'ring_warn' | 'ring_full', field: HTMLInputElement) => {
    const w = key === 'ring_warn' ? Number(field.value) : settings.ring_warn
    const f = key === 'ring_full' ? Number(field.value) : settings.ring_full
    const kept = thresholdsOf(w, f)
    if (kept.warn !== w || kept.full !== f) {
      error.textContent = t('prefs.ringInvalid')
      error.hidden = false
      field.value = String(settings[key])
      return
    }
    error.hidden = true
    await set(key, Number(field.value))
    field.value = String(settings[key])
  }
  warn.addEventListener('change', () => void edit('ring_warn', warn))
  full.addEventListener('change', () => void edit('ring_full', full))
  return group(t('prefs.ring'), [
    row(t('prefs.ringWarn'), t('prefs.ringGreen'), warn),
    row(t('prefs.ringFull'), null, full),
    error,
  ])
}

function scrollbackRow(): HTMLElement {
  const input = el('input', {
    type: 'number',
    min: String(SCROLLBACK_MIN),
    max: String(SCROLLBACK_MAX),
    step: String(SCROLLBACK_STEP),
    'data-key': 'scrollback',
  })
  input.value = String(settings.scrollback)
  input.addEventListener('change', async () => {
    await set('scrollback', Number(input.value))
    input.value = String(settings.scrollback)
  })
  return row(t('prefs.scrollback'), null, input)
}

function generalPage(): HTMLElement {
  const scheme = el('select', { 'data-key': 'color_scheme', 'aria-label': t('prefs.colorScheme') })
  for (const [value, label] of [
    ['system', t('prefs.schemeSystem')],
    ['light', t('prefs.schemeLight')],
    ['dark', t('prefs.schemeDark')],
  ] as const) {
    scheme.append(el('option', { value }, label))
  }
  scheme.value = settings.color_scheme
  scheme.addEventListener('change', () => void set('color_scheme', scheme.value))

  const restart = el(
    'button',
    { class: 'suggested', hidden: '', 'data-key': 'restart' },
    t('prefs.restartNow'),
  )
  restart.addEventListener('click', () => void api.restart())
  const languages = [
    { value: '', label: t('prefs.systemDefault') },
    ...info.languages.map((l) => ({ value: l.code, label: l.name })),
  ]

  return el(
    'div',
    { class: 'page', 'data-page': 'general' },
    group(t('prefs.terminal'), [fontRow(), scrollbackRow()]),
    group(t('prefs.appearance'), [
      row(t('prefs.colorScheme'), null, scheme),
      expander(
        'ui_style',
        t('prefs.interfaceStyle'),
        [
          { value: 'tui', label: t('prefs.styleTui') },
          { value: 'classic', label: t('prefs.styleClassic') },
        ],
        settings.ui_style,
        (value) => void set('ui_style', value),
      ),
      expander(
        'terminal_theme',
        t('prefs.colorTheme'),
        THEME_NAMES.map((name) => ({ value: name, label: name, extra: swatch(name) })),
        shownTheme(settings),
        (value) => void set('terminal_theme', value),
      ),
    ]),
    group(t('prefs.addSession'), [
      row(t('prefs.showFolderPath'), t('prefs.showFolderPathSubtitle'), toggle('show_folder_path')),
    ]),
    group(
      t('prefs.language'),
      [
        expander('language', t('prefs.language'), languages, settings.language, (value) => {
          restart.hidden = value === info.startLanguage
          void set('language', value)
        }),
      ],
      { description: t('prefs.languageRestart'), action: restart },
    ),
    ringGroup(),
    group(t('prefs.notifications'), [
      row(t('prefs.notifyIdle'), t('prefs.notifyIdleSubtitle'), toggle('notify_idle')),
      row(t('prefs.notifySound'), t('prefs.notifySoundSubtitle'), toggle('notify_sound')),
    ]),
    group(t('prefs.start'), [
      row(t('prefs.reopenTabs'), t('prefs.reopenTabsSubtitle'), toggle('reopen_tabs')),
    ]),
  )
}

async function main(): Promise<void> {
  await loadCatalog()
  info = await api.get()
  settings = info.settings
  applyLook(settings)
  api.onSettings((next) => {
    settings = next
    applyLook(next)
  })
  document.title = t('preferences.title')
  const pages = { general: generalPage(), integrations: await integrationsPage() }
  const body = el('main', {})
  const switcher = el('nav', { class: 'page-switch' })
  const show = (name: keyof typeof pages) => {
    body.replaceChildren(pages[name])
    for (const button of switcher.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.page === name))
    }
  }
  for (const [name, label] of [
    ['general', t('prefs.general')],
    ['integrations', t('prefs.integrations')],
  ] as const) {
    const button = el('button', { 'data-page': name }, label)
    button.addEventListener('click', () => show(name))
    switcher.append(button)
  }
  document.getElementById('app')?.replaceChildren(switcher, body)
  show(
    new URLSearchParams(location.search).get('page') === 'integrations'
      ? 'integrations'
      : 'general',
  )
}

void main()
