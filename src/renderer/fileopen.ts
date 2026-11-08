import { act } from './app'
import { el, icon } from './dom'
import { t, translate } from './i18n'
import { dialogClosed, dialogOpened, showDialog } from './ui'

let open = false

// "Open file": a full path typed or browsed; errors stay in the dialog until it opens.
export function openFileDialog(): void {
  if (open) return
  open = true
  dialogOpened()
  const entry = el('input', { type: 'text', placeholder: t('files.openPlaceholder') })
  const browse = el('button', { class: 'normal' }, t('files.browse'))
  const error = el('div', { class: 'error-line', hidden: '' })
  const submit = el('button', { class: 'pill' }, t('files.open'))
  const closeButton = el('button', { 'aria-label': t('tab.close') }, icon('close'))
  const dialog = el(
    'div',
    { class: 'dialog sheet open-file', role: 'dialog' },
    el(
      'div',
      { class: 'add-head' },
      el('div', { class: 'heading' }, t('files.openTitle')),
      closeButton,
    ),
    el(
      'div',
      { class: 'open-body' },
      el('div', { class: 'open-row' }, entry, browse),
      error,
      el('div', { class: 'form-actions' }, submit),
    ),
  )
  const scrim = el('div', { class: 'scrim' }, dialog)
  const close = () => {
    open = false
    dialogClosed()
    scrim.remove()
  }
  const go = async () => {
    const { refusal } = await act({ type: 'openFile', input: entry.value })
    if (refusal) {
      error.textContent = translate(refusal)
      error.hidden = false
      return
    }
    close()
  }
  closeButton.addEventListener('click', close)
  submit.addEventListener('click', () => void go())
  browse.addEventListener('click', async () => {
    const { value } = await act({ type: 'pickFile' })
    if (typeof value === 'string') {
      entry.value = value
      error.hidden = true
    }
  })
  entry.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void go()
    if (event.key === 'Escape') close()
  })
  document.body.append(scrim)
  entry.focus()
}

// `menkar open` with several windows: Cancel, then one button per window by its project, the
// active window's first (suggested, default).
window.menkar.files.onWhichWindow(async ({ paths, names, choices }) => {
  const answer = await showDialog({
    heading: t('files.whichWindow'),
    body: names.join(', '),
    buttons: [
      { label: t('dialog.cancel'), value: '' },
      ...choices.map((c, i) => ({
        label: c.label,
        value: c.window,
        ...(i === 0 ? { style: 'suggested' as const } : {}),
      })),
    ],
    defaultValue: choices[0]?.window ?? '',
  })
  if (answer.value) void act({ type: 'openFilesIn', window: answer.value, paths })
})

window.menkar.files.onRefused(async (refused) => {
  for (const { name, reason } of refused) {
    await showDialog({
      heading: t('files.notOpened'),
      body: `${name}: ${translate(reason)}`,
      buttons: [{ label: t('dialog.ok'), value: 'ok' }],
      defaultValue: 'ok',
    })
  }
})
