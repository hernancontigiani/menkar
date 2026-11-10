import { variantsFor } from '../core/chat/variants'
import { formatSize, formatTimestamp, formatTokens } from '../core/format'
import type { Key } from '../core/i18n'
import type { SessionInfo } from '../core/sessions/info'
import { act, currentState, renameSessionDialog } from './app'
import { el } from './dom'
import { t, translate } from './i18n'
import { dialogClosed, dialogOpened, showDialog, showError, showMenu } from './ui'

const agentName = (info: SessionInfo) =>
  info.agent === 'claude' ? t('agent.claude') : t('agent.cursor')

export async function renameFromHistory(info: SessionInfo): Promise<void> {
  await renameSessionDialog(info)
}

// Details (F7): read whole off the UI path; "Reading transcript…" until then.
export async function sessionDetails(info: SessionInfo): Promise<void> {
  dialogOpened()
  const content = el(
    'div',
    { class: 'details-body' },
    el('div', { class: 'dim' }, t('details.reading')),
  )
  const close = el('button', {}, t('dialog.ok'))
  const dialog = el(
    'div',
    { class: 'dialog sheet details', role: 'dialog' },
    el(
      'div',
      { class: 'add-head' },
      el(
        'div',
        {},
        el('div', { class: 'heading' }, info.name),
        el('div', { class: 'dim caption' }, info.cwd ?? info.folder),
      ),
    ),
    content,
    el('div', { class: 'responses' }, close),
  )
  const scrim = el('div', { class: 'scrim' }, dialog)
  const finish = () => {
    dialogClosed()
    scrim.remove()
  }
  close.addEventListener('click', finish)
  scrim.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Enter') finish()
  })
  document.body.append(scrim)
  close.focus()
  const { details, tokens } = await act({ type: 'sessionDetails', session: info.id })
  if (!details) return
  const row = (title: string, value: string) =>
    el('div', { class: 'prop' }, el('div', { class: 'dim caption' }, title), el('div', {}, value))
  const rows = [
    row(t('details.agent'), agentName(info)),
    row(t('details.id'), info.id),
    row(t('details.directory'), info.cwd ?? t('details.unknown')),
  ]
  if (details.created) rows.push(row(t('details.created'), formatTimestamp(details.created)))
  if (details.lastActivity)
    rows.push(row(t('details.lastActivity'), formatTimestamp(details.lastActivity)))
  rows.push(
    row(
      t('details.messages'),
      t('details.messageCount', { u: details.user, a: details.assistant }),
    ),
  )
  if (details.toolCalls > 0) rows.push(row(t('details.toolCalls'), String(details.toolCalls)))
  if (details.models.length > 0) rows.push(row(t('details.models'), details.models.join(', ')))
  if (tokens && (tokens.input > 0 || tokens.output > 0 || tokens.cacheRead > 0)) {
    rows.push(
      row(
        t('details.tokens'),
        t('details.tokenCounts', {
          in: formatTokens(tokens.input),
          out: formatTokens(tokens.output),
          cache: formatTokens(tokens.cacheRead),
        }),
      ),
    )
  }
  rows.push(row(t('details.size'), formatSize(info.size)))
  rows.push(el('div', { class: 'group-title' }, 'MCP'))
  rows.push(
    row(
      t('details.toolsUsed'),
      details.mcpUsed.length > 0
        ? details.mcpUsed.map(([server, n]) => `${server}: ${n}`).join(' · ')
        : '—',
    ),
  )
  rows.push(el('div', { class: 'group-title' }, t('details.recent')))
  for (const message of details.recent)
    rows.push(row(message.fromUser ? t('details.you') : agentName(info), message.text))
  content.replaceChildren(...rows)
}

async function confirmRemove(info: SessionInfo, kind: 'trash' | 'delete'): Promise<void> {
  const trash = kind === 'trash'
  const answer = await showDialog({
    heading: trash ? t('sessions.trashHeading') : t('sessions.deleteHeading'),
    body: trash
      ? `${t('sessions.trashBody', { name: info.name })}\n${t('sessions.trashBody2')}`
      : t('sessions.deleteBody', { name: info.name }),
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      {
        label: trash ? t('sessions.trashButton') : t('sessions.deleteButton'),
        value: 'go',
        style: 'destructive',
      },
    ],
    defaultValue: 'cancel',
  })
  if (answer.value !== 'go') return
  const { refusal } = await act({
    type: trash ? 'trashSession' : 'deleteSession',
    session: info.id,
  })
  if (refusal)
    await showError(
      trash ? t('sessions.trashFailedHeading') : t('sessions.deleteFailedHeading'),
      refusal,
    )
}

export async function trashSelected(ids: readonly string[]): Promise<void> {
  const answer = await showDialog({
    heading: t('sessions.trashManyHeading', { n: ids.length }),
    body: t('sessions.trashBody2'),
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('sessions.trashButton'), value: 'go', style: 'destructive' },
    ],
    defaultValue: 'cancel',
  })
  if (answer.value !== 'go') return
  const failures: string[] = []
  for (const id of ids) {
    const { refusal } = await act({ type: 'trashSession', session: id })
    const name = currentState()?.sessions.find((s) => s.id === id)?.name ?? id
    if (refusal) failures.push(`${name}: ${translate(refusal)}`)
  }
  if (failures.length > 0) {
    await showDialog({
      heading: t('sessions.someFailed'),
      body: failures.join('\n'),
      buttons: [{ label: t('dialog.ok'), value: 'ok' }],
      defaultValue: 'ok',
    })
  }
}

export async function exportSession(info: SessionInfo): Promise<void> {
  const { refusal } = await act({ type: 'exportSession', session: info.id })
  if (refusal)
    await showDialog({
      heading: t('export.failed'),
      body: t('export.failedBody'),
      buttons: [{ label: t('dialog.ok'), value: 'ok' }],
      defaultValue: 'ok',
    })
}

// The session-level items shared by the sidebar's row menu and the history row menu.
export function infoItems(info: SessionInfo) {
  return [
    { label: t('row.details'), run: () => void sessionDetails(info) },
    { label: t('row.copyId'), run: () => void act({ type: 'copyText', text: info.id }) },
    { label: t('row.export'), run: () => void exportSession(info) },
    { label: t('row.reveal'), run: () => void act({ type: 'revealTranscript', session: info.id }) },
  ]
}

// The history row menu (M33–M45).
export function historyRowMenu(info: SessionInfo, at: { x: number; y: number }): void {
  const open = [
    { label: t('row.open'), run: () => void act({ type: 'openSession', session: info.id }) },
  ]
  if (currentState()?.ghostty)
    open.push({
      label: t('row.ghostty'),
      run: () => void act({ type: 'openInGhostty', session: info.id }),
    })
  if (info.agent === 'claude')
    open.push({
      label: t('row.fork'),
      run: () => void act({ type: 'forkSession', session: info.id }),
    })
  for (const v of variantsFor(new Set([info.agent]))) {
    open.push({
      label: v.mode
        ? t('chat.continueMode', { mode: translate(MODE_KEY[v.mode]) })
        : t('chat.continueSole'),
      run: () => void act({ type: 'continueInChat', session: info.id, key: v.key }),
    })
  }
  showMenu(
    [
      ...open,
      'separator',
      { label: t('row.rename'), run: () => void renameFromHistory(info) },
      ...infoItems(info),
      'separator',
      {
        label: info.hidden ? t('row.unhide') : t('row.hide'),
        run: () => void window.menkar.sessions.setHidden([info.id], !info.hidden),
      },
      { label: t('row.trash'), run: () => void confirmRemove(info, 'trash') },
      { label: t('row.delete'), run: () => void confirmRemove(info, 'delete') },
    ],
    at,
  )
}

const MODE_KEY: Record<'askReadOnly' | 'trustedAutoRun', Key> = {
  askReadOnly: 'chat.modeAskReadOnly',
  trustedAutoRun: 'chat.modeTrustedAutoRun',
}
