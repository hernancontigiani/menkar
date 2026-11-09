import { el } from './dom'
import { t } from './i18n'

// Settings' MCP servers section: what Claude Code's ~/.claude.json configures, read each time the
// section is shown, never written.

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

export async function mcpSection(): Promise<HTMLElement> {
  const sections = await window.menkar.chat.mcpSections()
  const page = el('div', {}, el('div', { class: 'dim' }, t('mcp.readOnly')))
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
  return page
}
