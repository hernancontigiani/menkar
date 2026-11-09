import { now } from '../core/clock'
import type { RetentionStatus } from '../core/context/types'
import { latestOnly } from '../core/latest'
import { el } from './dom'
import { t } from './i18n'

// Settings' Integrations and Data sections: what Menkar may add to Claude Code's own settings (one
// switch per piece, off until turned on), and the classification of turns with its earlier-turns
// run.

const prefs = window.menkar.preferences
const classifier = window.menkar.classifier

// A refused change: our sentence, then the switch shows what the files say.
function notice(text: string): void {
  const toast = el('div', { class: 'toast', role: 'status', 'data-toast': '' }, text)
  document.body.append(toast)
  setTimeout(() => toast.remove(), 8000)
}

function switchRow(
  title: string,
  subtitle: HTMLElement | string,
  input: HTMLInputElement,
): HTMLElement {
  return el(
    'div',
    { class: 'row' },
    el(
      'div',
      { class: 'row-text' },
      el('div', { class: 'row-title' }, title),
      typeof subtitle === 'string' ? el('div', { class: 'row-subtitle' }, subtitle) : subtitle,
    ),
    input,
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

function weekAgo(): string {
  const d = new Date(now())
  d.setDate(d.getDate() - 7)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The earlier-turns dialog: a day, the count and the estimate for it, then a run in the background.
function earlierDialog(onStarted: () => void): void {
  const day = el('input', { type: 'date', 'data-key': 'earlier-day' })
  day.value = weekAgo()
  const estimate = el('div', { class: 'estimate', 'data-key': 'estimate' })
  const cancel = el('button', { 'data-key': 'earlier-cancel' }, t('classifier.cancel'))
  const confirm = el(
    'button',
    { class: 'suggested', 'data-key': 'earlier-confirm' },
    t('classifier.countingButton'),
  )
  const dialog = el(
    'div',
    { class: 'scrim', 'data-dialog': 'earlier' },
    el(
      'div',
      { class: 'dialog card', role: 'dialog' },
      el('h2', {}, t('classifier.earlier')),
      el('p', {}, t('classifier.dialogBody')),
      day,
      estimate,
      el('div', { class: 'responses' }, cancel, confirm),
    ),
  )
  const askCount = latestOnly()
  const count = async () => {
    const current = askCount()
    confirm.disabled = true
    confirm.textContent = t('classifier.countingButton')
    estimate.replaceChildren(el('div', { class: 'dim' }, t('classifier.counting')))
    const found = await classifier.estimate(day.value)
    if (!current()) return
    estimate.replaceChildren(...found.lines.map((line) => el('div', {}, line)))
    confirm.disabled = found.turns === 0
    confirm.textContent =
      found.turns > 0
        ? t('classifier.classifyCount', { count: String(found.turns) })
        : t('classifier.classify')
  }
  const close = () => dialog.remove()
  cancel.addEventListener('click', close)
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
  })
  day.addEventListener('change', () => void count())
  confirm.addEventListener('click', async () => {
    await classifier.classifyEarlier(day.value)
    close()
    onStarted()
  })
  document.body.append(dialog)
  void count()
}

function group(title: string | null, description: string | null, ...rows: HTMLElement[]) {
  return el(
    'section',
    { class: 'group' },
    title ? el('div', { class: 'group-head' }, el('div', { class: 'group-title' }, title)) : null,
    description ? el('p', { class: 'group-description dim' }, description) : null,
    el('div', { class: 'card' }, ...rows),
  )
}

// A switch over one piece of ~/.claude/settings.json: a refused change shows our sentence, then the
// switch shows what the files say.
async function claudeSwitch(
  key: string,
  read: () => Promise<{ on: boolean }>,
  write: (on: boolean) => Promise<{ on: boolean; error: string | null }>,
): Promise<HTMLInputElement> {
  const input = el('input', { type: 'checkbox', role: 'switch', 'data-key': key })
  input.checked = (await read()).on
  input.addEventListener('change', async () => {
    const result = await write(input.checked)
    input.checked = result.on
    if (result.error) notice(result.error)
  })
  return input
}

export async function statuslineSection(): Promise<HTMLElement> {
  const input = await claudeSwitch('statusline', prefs.statusline, prefs.setStatusline)
  return el(
    'div',
    {},
    group(
      t('integrations.claudeSettings'),
      t('integrations.claudeSettingsDescription'),
      switchRow(t('integrations.statusline'), t('integrations.statuslineSubtitle'), input),
    ),
  )
}

// How long Claude Code keeps transcripts now, as its settings say; read again after each change.
function retentionText(status: RetentionStatus): string {
  switch (status.kind) {
    case 'unset':
      return t('integrations.retentionUnset', { days: String(status.defaultDays) })
    case 'unreadable':
      return t('integrations.retentionUnreadable', { path: status.path })
    case 'days': {
      const days = String(status.days)
      if (!status.on) return t('integrations.retentionDays', { days })
      return status.by === 'menkar'
        ? t('integrations.retentionByMenkar', { days })
        : t('integrations.retentionByUser', { days })
    }
  }
}

export async function retentionSection(): Promise<HTMLElement> {
  const now = el('div', { class: 'retention-now', 'data-key': 'retention-now' })
  const show = async () => {
    const read = await prefs.retention()
    now.textContent = retentionText(read.status)
    return read
  }
  const input = await claudeSwitch('retention', show, async (on) => {
    const result = await prefs.setRetention(on)
    await show()
    return result
  })
  return el(
    'div',
    {},
    group(null, null, el('div', { class: 'row' }, el('div', { class: 'row-text' }, now))),
    group(
      t('integrations.claudeSettings'),
      t('integrations.claudeSettingsDescription'),
      switchRow(t('integrations.retention'), t('integrations.retentionSubtitle'), input),
    ),
  )
}

export async function usageSection(): Promise<HTMLElement> {
  const classify = el('input', { type: 'checkbox', role: 'switch', 'data-key': 'classify' })
  const status = el('div', { class: 'row-subtitle', 'data-key': 'classify-status' })
  const earlierSubtitle = el('div', { class: 'row-subtitle', 'data-key': 'earlier-subtitle' })
  const earlierButton = el('button', { 'data-key': 'earlier-button' })
  const earlierRow = el(
    'div',
    { class: 'row', 'data-key': 'earlier-row' },
    el(
      'div',
      { class: 'row-text' },
      el('div', { class: 'row-title' }, t('classifier.earlier')),
      earlierSubtitle,
    ),
    earlierButton,
  )
  let running = false
  const refresh = async () => {
    const now = await classifier.status()
    classify.checked = now.on
    status.textContent = [t('classifier.switchSubtitle'), now.status].filter(Boolean).join('\n')
    earlierRow.hidden = !now.on
    running = now.progress !== null
    earlierSubtitle.textContent = now.progress ?? t('classifier.earlierSubtitle')
    earlierButton.textContent = running ? t('classifier.stop') : t('classifier.earlierButton')
  }
  classify.addEventListener('change', async () => {
    await classifier.set(classify.checked)
    await refresh()
  })
  earlierButton.addEventListener('click', () => {
    if (running) void classifier.stop().then(refresh)
    else earlierDialog(() => void refresh())
  })
  await refresh()
  // While Settings is open the run's progress is read again once a second.
  setInterval(() => void refresh(), 1000)
  return el(
    'div',
    {},
    group(
      t('classifier.group'),
      null,
      switchRow(t('classifier.switch'), status, classify),
      earlierRow,
    ),
  )
}
