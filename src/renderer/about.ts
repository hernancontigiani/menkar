import type { PreferencesInfo } from '../shared/ipc'
import { el } from './dom'
import { t } from './i18n'

// Settings' About section: Menkar's star, its name, its developer and version, then Details, the issue
// tracker, Credits and Legal.

const STAR =
  '<svg viewBox="0 0 100 100" width="96" height="96" fill="currentColor" aria-hidden="true"><path d="M50 2 L56 44 L98 50 L56 56 L50 98 L44 56 L2 50 L44 44Z"/><path d="M50 22 L54 46 L78 50 L54 54 L50 78 L46 54 L22 50 L46 46Z" transform="rotate(45 50 50)"/></svg>'

const COPYRIGHT = '© 2026 Hernan Contigiani'
const DEVELOPER = 'Hernan Contigiani'
const LICENSE = 'GPL-3.0-or-later'

function section(name: string, title: string, ...content: (HTMLElement | string)[]): HTMLElement {
  return el(
    'details',
    { class: 'about-section', 'data-section': name },
    el('summary', { class: 'row' }, title),
    el('div', { class: 'about-body' }, ...content),
  )
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
    el('h1', { 'data-key': 'name' }, 'Menkar'),
    el('div', { class: 'dim', 'data-key': 'developer' }, DEVELOPER),
    el('span', { class: 'badge', 'data-key': 'version' }, info.version),
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
