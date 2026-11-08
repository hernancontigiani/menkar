import type { Turn } from '../core/sessions/transcript'
import { el } from './dom'
import { t } from './i18n'

const PLAY_MS = 800

interface ReplayView {
  readonly root: HTMLElement
  stop(): void
}

const views = new Map<string, ReplayView>()

// A replay tab: one turn shown at first; Next, Previous, Show all, Play (a turn every 800 ms).
export function replayElement(tabId: string, turns: readonly Turn[]): HTMLElement {
  const existing = views.get(tabId)
  if (existing) return existing.root
  let shown = turns.length > 0 ? 1 : 0
  let timer: ReturnType<typeof setInterval> | undefined
  const previous = el('button', { title: t('replay.previous') }, '⏮')
  const play = el('button', { title: t('replay.play') }, '▶')
  const next = el('button', { title: t('replay.next') }, '⏭')
  const all = el('button', {}, t('replay.showAll'))
  const progress = el('span', { class: 'dim progress' })
  const list = el('div', { class: 'replay-turns' })
  const stop = () => {
    clearInterval(timer)
    timer = undefined
  }
  const draw = () => {
    if (turns.length === 0) {
      list.replaceChildren(
        el(
          'div',
          { class: 'status-page compact' },
          el('div', { class: 'body dim' }, t('replay.empty')),
        ),
      )
    } else {
      list.replaceChildren(
        ...turns
          .slice(0, shown)
          .map((turn) => el('div', { class: `bubble ${turn.kind}` }, turn.text)),
      )
      list.lastElementChild?.scrollIntoView({ block: 'end' })
    }
    progress.textContent = `${shown} / ${turns.length}`
    previous.toggleAttribute('disabled', shown === 0)
    next.toggleAttribute('disabled', shown >= turns.length)
    all.toggleAttribute('disabled', shown >= turns.length)
    play.toggleAttribute('disabled', shown >= turns.length && !timer)
    play.textContent = timer ? '⏸' : '▶'
    play.title = timer ? t('replay.pause') : t('replay.play')
  }
  previous.addEventListener('click', () => {
    shown = Math.max(0, shown - 1)
    draw()
  })
  next.addEventListener('click', () => {
    shown = Math.min(turns.length, shown + 1)
    draw()
  })
  all.addEventListener('click', () => {
    shown = turns.length
    draw()
  })
  play.addEventListener('click', () => {
    if (timer) stop()
    else
      timer = setInterval(() => {
        shown = Math.min(turns.length, shown + 1)
        if (shown >= turns.length) stop()
        draw()
      }, PLAY_MS)
    draw()
  })
  const root = el(
    'div',
    { class: 'replay' },
    el(
      'div',
      { class: 'replay-bar' },
      previous,
      play,
      next,
      all,
      el('span', { class: 'spacer' }),
      progress,
    ),
    list,
  )
  views.set(tabId, { root, stop })
  draw()
  return root
}

export function forgetReplaysExcept(live: ReadonlySet<string>): void {
  for (const [id, view] of views) {
    if (live.has(id)) continue
    view.stop()
    views.delete(id)
  }
}
