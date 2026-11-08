import './windows.css'
import { el } from './dom'
import { loadCatalog, t } from './i18n'
import { applyLook } from './look'

// The MCP servers browser: what Claude Code's ~/.claude.json configures, read once, read only.

function row(title: string, subtitle: string | null): HTMLElement {
  return el(
    'div',
    { class: 'row' },
    el(
      'div',
      { class: 'row-text' },
      el('div', { class: 'row-title' }, title),
      subtitle ? el('div', { class: 'row-subtitle' }, subtitle) : null,
    ),
  )
}

async function main(): Promise<void> {
  await loadCatalog()
  const info = await window.menkar.preferences.get()
  applyLook(info.settings)
  document.title = t('mcp.title')
  const sections = await window.menkar.chat.mcpSections()
  const page = el(
    'div',
    { class: 'page', 'data-page': 'mcp' },
    el('h2', { class: 'mcp-title' }, t('mcp.title')),
    el('div', { class: 'dim' }, t('mcp.readOnly')),
  )
  if (sections.length === 0)
    page.append(el('div', { class: 'card', 'data-key': 'none' }, row(t('mcp.none'), null)))
  for (const section of sections) {
    const title =
      section.path === null
        ? t('mcp.global')
        : (section.path.split('/').filter(Boolean).pop() ?? section.path)
    const description = section.path === null ? t('mcp.globalDescription') : section.path
    page.append(
      el(
        'section',
        { class: 'group', 'data-section': title },
        el('div', { class: 'group-head' }, el('div', { class: 'group-title' }, title)),
        el('p', { class: 'group-description dim' }, description),
        el('div', { class: 'card' }, ...section.servers.map((s) => row(s.name, s.summary))),
      ),
    )
  }
  document.getElementById('app')?.replaceChildren(page)
}

void main()
