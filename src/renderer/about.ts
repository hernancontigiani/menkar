import { descriptorOf } from '../core/agents/descriptors'
import {
  type AgentVersionView,
  STANDING_LABELS,
  type Standing,
  versionLineOf,
} from '../core/agents/versions'
import { flavorFacts } from '../core/flavor'
import type { PreferencesInfo } from '../shared/ipc'
import { el, icon } from './dom'
import { t, translate } from './i18n'

// Settings' About section: Menkar's star, its name, its developer and version, the coding agents'
// versions, then Details, the issue tracker, Credits and Legal.

const STAR =
  '<svg viewBox="0 0 100 100" width="96" height="96" fill="currentColor" aria-hidden="true"><path d="M50 2 L56 44 L98 50 L56 56 L50 98 L44 56 L2 50 L44 44Z"/><path d="M50 22 L54 46 L78 50 L54 54 L50 78 L46 54 L22 50 L46 46Z" transform="rotate(45 50 50)"/></svg>'

const COPYRIGHT = '© 2026 Hernan Contigiani'
const DEVELOPER = 'Hernan Contigiani'
const LICENSE = 'GPL-3.0-or-later'

// The app's name as this flavour shows it. t() takes a literal key, so each is named here.
export function appName(): string {
  switch (flavorFacts().titleKey) {
    case 'window.title':
      return t('window.title')
    case 'window.titleSandbox':
      return t('window.titleSandbox')
  }
}

function section(name: string, title: string, ...content: (HTMLElement | string)[]): HTMLElement {
  return el(
    'details',
    { class: 'about-section', 'data-section': name },
    el('summary', { class: 'row' }, title),
    el('div', { class: 'about-body' }, ...content),
  )
}

// The ones the banner also tells: shown with its icon and colour.
const WARNS: ReadonlySet<Standing> = new Set(['old', 'newer', 'muchNewer'])

function agentRow(v: AgentVersionView): HTMLElement {
  const key = STANDING_LABELS[v.standing]
  const line = versionLineOf(v)
  const warns = WARNS.has(v.standing)
  return el(
    'div',
    { class: 'row agent-version', 'data-agent': v.agent, 'data-standing': v.standing },
    el(
      'div',
      { class: 'row-text' },
      el('div', { class: 'row-title' }, translate(descriptorOf(v.agent).label)),
      el('div', { class: 'row-subtitle' }, translate(line.key, line.params)),
    ),
    key &&
      el(
        'span',
        { class: warns ? 'agent-standing warns' : 'agent-standing dim' },
        warns ? icon('warning') : null,
        el('span', {}, translate(key)),
      ),
  )
}

// Filled once main has read the versions, and again whenever it reads them anew.
function agentsCard(): HTMLElement {
  const head = el(
    'div',
    { class: 'row' },
    el(
      'div',
      { class: 'row-text' },
      el('div', { class: 'row-title agents-title' }, t('about.agents')),
      el('div', { class: 'row-subtitle' }, t('about.agentsValidated')),
    ),
  )
  const card = el('div', { class: 'card agents-card', 'data-key': 'agents' }, head)
  const fill = (views: readonly AgentVersionView[]) =>
    card.replaceChildren(head, ...views.map(agentRow))
  void window.menkar.agents.versions().then(fill)
  window.menkar.agents.onVersions(fill)
  return card
}

export function aboutSection(info: PreferencesInfo): HTMLElement {
  const prefs = window.menkar.preferences
  const logo = el('div', { class: 'about-logo' })
  logo.innerHTML = STAR
  const website = el('button', { class: 'link', 'data-key': 'website' }, t('about.website'))
  website.addEventListener('click', () => void prefs.openLink('website'))
  const issues = el(
    'button',
    { class: 'row link', 'data-key': 'issues' },
    `${t('about.reportIssue')} ↗`,
  )
  issues.addEventListener('click', () => void prefs.openLink('issues'))
  return el(
    'div',
    { class: 'about' },
    logo,
    el('h1', { 'data-key': 'name' }, appName()),
    el('div', { class: 'dim', 'data-key': 'developer' }, DEVELOPER),
    el('span', { class: 'badge', 'data-key': 'version' }, info.version),
    agentsCard(),
    el(
      'div',
      { class: 'card' },
      section(
        'details',
        t('about.details'),
        el('p', {}, t('about.comments')),
        el('p', {}, t('about.unofficial')),
        website,
      ),
      issues,
      section(
        'credits',
        t('about.credits'),
        el('h3', {}, t('about.developer')),
        el('p', {}, DEVELOPER),
        el('h3', {}, t('about.basedOn')),
        el('p', {}, t('about.basedOnText')),
      ),
      section(
        'legal',
        t('about.legal'),
        el('p', {}, COPYRIGHT),
        el('p', {}, LICENSE),
        el('p', {}, t('about.license')),
      ),
    ),
  )
}
