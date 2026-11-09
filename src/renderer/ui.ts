import type { Key } from '../core/i18n'
import { el } from './dom'
import { t, translate } from './i18n'

export interface DialogButton {
  readonly label: string
  readonly value: string
  readonly style?: 'suggested' | 'destructive'
}

export interface DialogOptions {
  readonly heading: string
  readonly body?: string
  readonly entry?: { readonly value: string; readonly placeholder?: string }
  // The body as a monospace block, left-aligned, one line per line.
  readonly monospace?: boolean
  // Controls of the caller's own, below the body.
  readonly extra?: HTMLElement
  readonly buttons: readonly DialogButton[]
  // The response Enter gives; Escape gives the first button's.
  readonly defaultValue?: string
}

export interface DialogResult {
  readonly value: string
  readonly text: string
}

let openDialogs = 0
export const dialogOpen = () => openDialogs > 0
export const dialogOpened = () => {
  openDialogs += 1
}
export const dialogClosed = () => {
  openDialogs -= 1
}

export function showDialog(options: DialogOptions): Promise<DialogResult> {
  return new Promise((resolve) => {
    openDialogs += 1
    const entry = options.entry
      ? el('input', { type: 'text', placeholder: options.entry.placeholder ?? '' })
      : null
    if (entry && options.entry) entry.value = options.entry.value
    const finish = (value: string) => {
      openDialogs -= 1
      scrim.remove()
      resolve({ value, text: entry?.value ?? '' })
    }
    const buttons = options.buttons.map((b) => {
      const button = el(
        'button',
        { class: b.style ? `${b.style}-text` : '', 'data-value': b.value },
        b.label,
      )
      button.addEventListener('click', () => finish(b.value))
      return button
    })
    const body = options.body
      ? options.monospace
        ? el('div', { class: 'body mono-block' }, options.body)
        : el(
            'div',
            { class: 'body' },
            ...options.body.split('\n').flatMap((line, i) => (i === 0 ? [line] : [el('br'), line])),
          )
      : null
    const dialog = el(
      'div',
      { class: 'dialog', role: 'alertdialog' },
      el(
        'div',
        { class: 'message' },
        el('div', { class: 'heading' }, options.heading),
        body,
        options.extra ?? null,
        entry ? el('div', { class: 'field' }, entry) : null,
      ),
      el('div', { class: 'responses' }, ...buttons),
    )
    const scrim = el('div', { class: 'scrim' }, dialog)
    scrim.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish(options.buttons[0]?.value ?? 'cancel')
      } else if (event.key === 'Enter' && options.defaultValue !== undefined) {
        event.preventDefault()
        finish(options.defaultValue)
      }
    })
    document.body.append(scrim)
    if (entry) {
      entry.focus()
      entry.select()
    } else (buttons.find((b) => b.dataset.value === options.defaultValue) ?? buttons[0])?.focus()
  })
}

export function showError(heading: string, refusal: Key): Promise<DialogResult> {
  return showDialog({
    heading,
    body: translate(refusal),
    buttons: [{ label: t('dialog.ok'), value: 'ok' }],
    defaultValue: 'ok',
  })
}

const TOAST_MS = 4000

export function toast(
  text: string,
  options: { sticky?: boolean; ms?: number; action?: { label: string; run: () => void } } = {},
): void {
  const host = document.getElementById('toasts')
  if (!host) return
  const node = el('div', { class: 'toast', role: 'status' }, el('span', {}, text))
  if (options.action) {
    const { label, run } = options.action
    const button = el('button', { class: 'toast-action' }, label)
    button.addEventListener('click', () => {
      run()
      node.remove()
    })
    node.append(button)
  }
  if (options.sticky) {
    const close = el('button', { class: 'toast-action', 'aria-label': t('toast.dismiss') }, '×')
    close.addEventListener('click', () => node.remove())
    node.append(close)
  } else setTimeout(() => node.remove(), options.ms ?? TOAST_MS)
  host.append(node)
}

export interface MenuItem {
  readonly label: string
  readonly run?: () => void
  readonly submenu?: readonly MenuItem[]
  // The keys that do the same, shown at the item's right.
  readonly shortcut?: string
  readonly disabled?: boolean
}
export type MenuEntry = MenuItem | 'separator'

let openPopover: HTMLElement | null = null

export function closePopover(): void {
  openPopover?.remove()
  openPopover = null
}

// Esc closes an open menu or popover, and goes no further (not to a terminal under it).
document.addEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape' || !openPopover) return
    event.preventDefault()
    event.stopPropagation()
    closePopover()
  },
  true,
)

export function showPopover(
  content: HTMLElement,
  anchor: { x: number; y: number },
  extraClass = '',
): HTMLElement {
  closePopover()
  const popover = el('div', { class: `popover ${extraClass}` }, content)
  popover.style.left = `${Math.max(4, anchor.x)}px`
  popover.style.top = `${anchor.y}px`
  document.body.append(popover)
  const rect = popover.getBoundingClientRect()
  if (rect.right > window.innerWidth - 4)
    popover.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`
  if (rect.bottom > window.innerHeight - 4)
    popover.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`
  openPopover = popover
  setTimeout(() => {
    const away = (event: MouseEvent) => {
      if (openPopover === popover && !popover.contains(event.target as Node)) {
        closePopover()
        document.removeEventListener('mousedown', away, true)
      }
    }
    document.addEventListener('mousedown', away, true)
  })
  return popover
}

export function showMenu(entries: readonly MenuEntry[], anchor: { x: number; y: number }): void {
  const content = el('div', { role: 'menu' })
  for (const entry of entries) {
    if (entry === 'separator') {
      content.append(el('div', { class: 'menu-sep' }))
      continue
    }
    const item = el(
      'button',
      { class: 'menu-item', role: 'menuitem' },
      entry.label,
      entry.submenu ? ' ▸' : '',
      entry.shortcut ? el('span', { class: 'menu-shortcut dim' }, entry.shortcut) : null,
    )
    if (entry.disabled) item.disabled = true
    item.addEventListener('click', (event) => {
      if (entry.submenu) {
        const rect = item.getBoundingClientRect()
        showMenu(entry.submenu, { x: rect.right, y: rect.top })
        event.stopPropagation()
        return
      }
      closePopover()
      entry.run?.()
    })
    content.append(item)
  }
  showPopover(content, anchor)
}
