import './windows.css'
import { thresholdsOf } from '../core/context/levels'
import {
  parseFont,
  SCROLLBACK_MAX,
  SCROLLBACK_MIN,
  SCROLLBACK_STEP,
  SETTINGS_LIST,
  type SettingsSection,
  shownTheme,
} from '../core/preferences'
import type { Settings } from '../core/settings'
import { PALETTES, THEME_NAMES } from '../core/theme'
import type { PreferencesInfo } from '../shared/ipc'
import { aboutSection } from './about'
import { el } from './dom'
import { loadCatalog, t } from './i18n'
import { retentionSection, statuslineSection, usageSection } from './integrations'
import { applyLook } from './look'
import { mcpSection } from './mcp'

// The Settings window: a list of sections on the left, grouped, and the chosen one on the right.
// Every change is saved at once, and main re-applies it in every window.

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
  title: string | null,
  rows: HTMLElement[],
  options: { description?: string; action?: HTMLElement } = {},
) {
  return el(
    'section',
    { class: 'group' },
    title || options.action
      ? el(
          'div',
          { class: 'group-head' },
          el('div', { class: 'group-title' }, title ?? ''),
          options.action ?? null,
        )
      : null,
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

function appearanceSection(): HTMLElement {
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
  return group(null, [
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
  ])
}

function languageSection(): HTMLElement {
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
  return group(
    null,
    [
      expander('language', t('prefs.language'), languages, settings.language, (value) => {
        restart.hidden = value === info.startLanguage
        void set('language', value)
      }),
    ],
    { description: t('prefs.languageRestart'), action: restart },
  )
}

// Each section's content; MCP and retention read the agent's files again each time they are
// shown, the rest is built once.
const SECTIONS: Record<SettingsSection, () => HTMLElement | Promise<HTMLElement>> = {
  appearance: appearanceSection,
  terminal: () => group(null, [fontRow(), scrollbackRow()]),
  sessions: () =>
    el(
      'div',
      {},
      group(t('prefs.start'), [
        row(t('prefs.reopenTabs'), t('prefs.reopenTabsSubtitle'), toggle('reopen_tabs')),
      ]),
      group(t('prefs.addSession'), [
        row(
          t('prefs.showFolderPath'),
          t('prefs.showFolderPathSubtitle'),
          toggle('show_folder_path'),
        ),
      ]),
    ),
  notifications: () =>
    group(null, [
      row(t('prefs.notifyIdle'), t('prefs.notifyIdleSubtitle'), toggle('notify_idle')),
      row(t('prefs.notifySound'), t('prefs.notifySoundSubtitle'), toggle('notify_sound')),
    ]),
  context: ringGroup,
  usage: usageSection,
  statusline: statuslineSection,
  retention: retentionSection,
  mcp: mcpSection,
  language: languageSection,
  about: () => aboutSection(info),
}

// One icon per section, in the header icons' stroke style, drawn here and never fetched.
const ICONS: Record<SettingsSection, string> = {
  appearance:
    '<path d="M8 1.8a6.2 6.2 0 1 0 0 12.4c1 0 1.5-.6 1.5-1.3 0-.9-.8-1.2-.8-2 0-.7.6-1.2 1.3-1.2h1.6c1.7 0 2.6-1.2 2.6-2.8C14.2 4 11.5 1.8 8 1.8z"/><circle cx="5" cy="7" r="0.8"/><circle cx="7.5" cy="4.6" r="0.8"/><circle cx="10.6" cy="5.4" r="0.8"/>',
  terminal:
    '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><polyline points="4,6 6.5,8 4,10"/><line x1="8" y1="10.5" x2="11.5" y2="10.5"/>',
  sessions:
    '<rect x="1.5" y="5" width="13" height="8.5" rx="1.5"/><path d="M1.5 6.5V4a1 1 0 0 1 1-1h3.5l1 2"/><line x1="7" y1="3" x2="10" y2="3"/>',
  notifications:
    '<path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.2H2.8z"/><path d="M6.6 13.8a1.5 1.5 0 0 0 2.8 0"/>',
  context:
    '<circle cx="8" cy="8" r="5.8"/><path d="M8 2.2a5.8 5.8 0 0 1 5.6 7.3"/><circle cx="8" cy="8" r="1.2"/>',
  usage:
    '<line x1="2.5" y1="13.5" x2="13.5" y2="13.5"/><rect x="3.5" y="8" width="2.4" height="5"/><rect x="6.8" y="4" width="2.4" height="9"/><rect x="10.1" y="6.5" width="2.4" height="6.5"/>',
  statusline:
    '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><line x1="1.5" y1="10.5" x2="14.5" y2="10.5"/><line x1="3.5" y1="12" x2="6.5" y2="12"/><line x1="9" y1="12" x2="12.5" y2="12"/>',
  retention:
    '<rect x="1.8" y="2.5" width="12.4" height="3" rx="0.8"/><path d="M2.8 5.5v7a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-7"/><line x1="6.3" y1="8.3" x2="9.7" y2="8.3"/>',
  mcp: '<path d="M5.5 2v3M10.5 2v3"/><path d="M3.5 5h9v2.5a4.5 4.5 0 0 1-9 0z"/><line x1="8" y1="12" x2="8" y2="14.5"/>',
  language:
    '<circle cx="8" cy="8" r="6.2"/><ellipse cx="8" cy="8" rx="2.6" ry="6.2"/><line x1="1.8" y1="8" x2="14.2" y2="8"/>',
  about:
    '<circle cx="8" cy="8" r="6.2"/><line x1="8" y1="7.2" x2="8" y2="11.5"/><circle cx="8" cy="4.8" r="0.5"/>',
}

function sectionIcon(name: SettingsSection): SVGSVGElement {
  const wrapper = document.createElement('span')
  wrapper.innerHTML = `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg>`
  return wrapper.firstElementChild as SVGSVGElement
}

const LAST = 'menkar.settings.section'
const isSection = (value: string | null): value is SettingsSection =>
  value !== null && value in SECTIONS

// The section last shown, kept by this window's page only as a convenience.
function lastSection(): SettingsSection | null {
  try {
    const value = localStorage.getItem(LAST)
    return isSection(value) ? value : null
  } catch {
    return null // storage refused: start on the first section
  }
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
  document.title = t('settings.title')
  const titles: Record<SettingsSection, string> = {
    appearance: t('settings.section.appearance'),
    terminal: t('settings.section.terminal'),
    sessions: t('settings.section.sessions'),
    notifications: t('settings.section.notifications'),
    context: t('settings.section.context'),
    usage: t('settings.section.usage'),
    statusline: t('settings.section.statusline'),
    retention: t('settings.section.retention'),
    mcp: t('settings.section.mcp'),
    language: t('settings.section.language'),
    about: t('settings.section.about'),
  }
  const built = new Map<SettingsSection, HTMLElement>()
  const title = el('h1', { class: 'section-title' })
  const content = el('div', { class: 'section-body' })
  const body = el('main', { class: 'page' }, title, content)
  const list = el('nav', {
    class: 'section-list',
    role: 'tablist',
    'aria-orientation': 'vertical',
    'aria-label': t('settings.sections'),
  })
  let shown: SettingsSection | null = null
  let asking = 0
  const show = async (name: SettingsSection) => {
    shown = name
    asking += 1
    const mine = asking
    for (const item of list.querySelectorAll<HTMLButtonElement>('[data-section]')) {
      const chosen = item.dataset.section === name
      item.setAttribute('aria-selected', String(chosen))
      item.tabIndex = chosen ? 0 : -1
    }
    title.textContent = titles[name]
    body.dataset.section = name
    let node = built.get(name)
    if (!node) {
      node = await SECTIONS[name]()
      if (name !== 'mcp' && name !== 'retention') built.set(name, node)
    }
    if (mine !== asking) return
    content.replaceChildren(node)
    try {
      localStorage.setItem(LAST, name)
    } catch {
      // storage refused: the next window starts on the first section
    }
  }
  const items: HTMLButtonElement[] = []
  for (const entry of SETTINGS_LIST) {
    if (entry === null) {
      list.append(el('hr', { class: 'section-separator' }))
      continue
    }
    const name = entry
    const item = el(
      'button',
      { role: 'tab', 'data-section': name, class: 'section-item' },
      sectionIcon(name),
      el('span', {}, titles[name]),
    )
    item.addEventListener('click', () => void show(name))
    items.push(item)
    list.append(item)
  }
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const at = items.findIndex((item) => item.dataset.section === shown)
    const next =
      items[Math.min(Math.max(at + (event.key === 'ArrowDown' ? 1 : -1), 0), items.length - 1)]
    if (!next?.dataset.section || !isSection(next.dataset.section)) return
    void show(next.dataset.section)
    next.focus()
  })
  api.onSection((name) => void show(name))
  const side = el(
    'aside',
    { class: 'settings-side' },
    el('div', { class: 'settings-header', 'data-key': 'settings-title' }, t('settings.title')),
    list,
  )
  document.getElementById('app')?.replaceChildren(el('div', { class: 'settings' }, side, body))
  const asked = new URLSearchParams(location.search).get('section')
  await show(isSection(asked) ? asked : (lastSection() ?? 'appearance'))
}

void main()
