import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Annotation, ChangeSet, Compartment, EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { Key } from '../core/i18n'
import type { SyntaxRole } from '../core/theme'
import type { FileUpdate, TabView } from '../shared/workspace'
import { act, saveFile } from './app'
import { el } from './dom'
import { t, translate } from './i18n'
import { renderPreview } from './preview'

// An edit that came from the buffer in main, which the view must not send back.
const remote = Annotation.define<boolean>()

interface EditorTab {
  readonly tab: string
  readonly path: string
  readonly root: HTMLElement
  readonly bars: HTMLElement
  view: EditorView | null
  readonly preview: boolean
  readonly theme: Compartment
  readonly save: HTMLButtonElement
}

const editors = new Map<string, EditorTab>()
// The version this window last saw of each file.
const versions = new Map<string, number>()
let dark = true

export function isMarkdown(path: string): boolean {
  return /\.(md|markdown|mdown|mkd)$/i.test(path)
}

function languageOf(path: string): Extension {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  // GitHub's flavour: tables, strikethrough and task lists are marked up too.
  if (isMarkdown(path)) return markdown({ base: markdownLanguage })
  if (['js', 'mjs', 'cjs', 'jsx'].includes(ext)) return javascript({ jsx: ext === 'jsx' })
  if (['ts', 'mts', 'cts', 'tsx'].includes(ext))
    return javascript({ typescript: true, jsx: ext === 'tsx' })
  if (ext === 'json') return json()
  if (ext === 'py') return python()
  if (ext === 'css') return css()
  if (ext === 'html' || ext === 'htm') return html()
  return []
}

// The syntax colours are CSS variables the look sets for every theme: its roles, or the theme's own
// syntax colours where it has them. Display only.
const syntax = (role: SyntaxRole) => `var(--syntax-${role})`
const highlight = HighlightStyle.define([
  { tag: tags.heading, color: syntax('heading'), fontWeight: '700', textDecoration: 'none' },
  { tag: tags.strong, color: syntax('strong'), fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.monospace, tags.labelName], color: syntax('code') },
  { tag: [tags.link, tags.url], color: syntax('link'), textDecoration: 'underline' },
  { tag: tags.quote, color: syntax('quote'), fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.atom], color: syntax('marker') },
  { tag: tags.contentSeparator, color: syntax('rule') },
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: syntax('keyword') },
  { tag: tags.controlKeyword, color: syntax('control') },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: syntax('string') },
  { tag: [tags.number, tags.bool, tags.null], color: syntax('number') },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: syntax('comment'),
    fontStyle: 'italic',
  },
  { tag: [tags.propertyName, tags.attributeName], color: syntax('property') },
  { tag: [tags.typeName, tags.className, tags.tagName], color: syntax('type') },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: syntax('function'),
  },
  { tag: tags.invalid, color: syntax('invalid') },
])

// The editor follows the app's light / dark state, not its color theme.
function themeOf(isDark: boolean): Extension {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
        color: isDark ? '#deddda' : '#1e1e1e',
      },
      '.cm-gutters': {
        backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
        color: isDark ? '#77767b' : '#9a9996',
        border: 'none',
      },
      '.cm-activeLine': { backgroundColor: isDark ? '#2a2a2e' : '#f0f0f3' },
      '.cm-activeLineGutter': {
        backgroundColor: isDark ? '#2a2a2e' : '#f0f0f3',
        fontWeight: '700',
      },
      '.cm-scroller': {
        fontFamily: 'var(--term-font, monospace)',
        fontSize: 'var(--term-font-size, 13.3333px)',
      },
      '&.cm-focused .cm-cursor': { borderLeftColor: isDark ? '#ffffff' : '#000000' },
    },
    { dark: isDark },
  )
}

function bar(text: string, buttons: HTMLElement[] = [], kind = 'info'): HTMLElement {
  return el(
    'div',
    { class: `file-bar ${kind}` },
    el('span', { class: 'bar-text' }, text),
    ...buttons,
  )
}

// Save is there for whoever does not know Ctrl+S; off, saying why, when there is nothing to save.
function drawSave(e: EditorTab, state: { readOnly: Key | null; dirty: boolean }): void {
  e.save.disabled = state.readOnly !== null || !state.dirty
  e.save.title = state.readOnly
    ? translate(state.readOnly)
    : state.dirty
      ? t('files.saveTooltip')
      : t('files.saveClean')
}

async function drawBars(
  e: EditorTab,
  state: { readOnly: Key | null; bar: 'changed' | 'deleted' | null },
): Promise<void> {
  const bars: HTMLElement[] = []
  if (state.readOnly) bars.push(bar(translate(state.readOnly)))
  if (state.bar === 'changed') {
    const reload = el('button', {}, t('files.reload'))
    const keep = el('button', {}, t('files.keepMine'))
    reload.addEventListener('click', () => void act({ type: 'reloadFile', path: e.path }))
    keep.addEventListener('click', () => void act({ type: 'keepMine', path: e.path }))
    bars.push(bar(t('files.changedOnDisk'), [reload, keep], 'warning'))
  }
  if (state.bar === 'deleted') bars.push(bar(t('files.deletedOnDisk'), [], 'warning'))
  e.bars.replaceChildren(...bars)
}

function makeView(e: EditorTab, text: string, readOnly: boolean, host: HTMLElement): EditorView {
  return new EditorView({
    parent: host,
    state: EditorState.create({
      doc: text,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        highlightSelectionMatches(),
        syntaxHighlighting(highlight),
        languageOf(e.path),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        e.theme.of(themeOf(dark)),
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || update.transactions.some((tr) => tr.annotation(remote))) return
          const base = versions.get(e.path) ?? 0
          versions.set(e.path, base + 1)
          void act({
            type: 'fileEdit',
            path: e.path,
            base,
            changes: update.changes.toJSON(),
            tab: e.tab,
          })
        }),
      ],
    }),
  })
}

// The DOM of a file tab, created once per tab and kept across renders.
export function fileElement(tab: TabView): HTMLElement {
  const existing = editors.get(tab.id)
  if (existing) return existing.root
  const path = tab.file?.path ?? ''
  const preview = tab.file?.preview === true
  const bars = el('div', { class: 'file-bars' })
  const root = el('div', { class: 'file-tab', 'data-file-tab': tab.id }, bars)
  const e: EditorTab = {
    tab: tab.id,
    path,
    root,
    bars,
    view: null,
    preview,
    theme: new Compartment(),
    save: el('button', { class: 'flat save', disabled: '' }, t('files.save')),
  }
  e.save.addEventListener('click', () => void saveFile(path))
  editors.set(tab.id, e)
  void act({ type: 'fileState', path }).then(({ file }) => {
    if (!file) return
    versions.set(path, file.version)
    void drawBars(e, file)
    if (preview) {
      root.append(renderPreview(tab.id, path, file.text, dark))
      return
    }
    drawSave(e, file)
    const row = el('div', { class: 'preview-row' }, e.save)
    if (isMarkdown(path)) {
      const button = el(
        'button',
        { class: 'flat', title: t('files.previewTooltip') },
        t('files.preview'),
      )
      button.addEventListener('click', () => void act({ type: 'togglePreview', tab: tab.id }))
      row.append(button)
    }
    root.append(row)
    const host = el('div', { class: 'editor-host' })
    root.append(host)
    e.view = makeView(e, file.text, file.readOnly !== null, host)
    e.view.focus()
  })
  return root
}

window.menkar.files.onUpdate((update: FileUpdate) => {
  for (const e of editors.values()) {
    if (e.path !== update.path) continue
    void drawBars(e, update)
    drawSave(e, update)
    if (e.preview) {
      renderPreview(e.tab, e.path, update.text, dark)
      continue
    }
    const view = e.view
    if (!view) continue
    // Our own edit came back: this view has it already.
    if (update.origin === e.tab) continue
    const known = versions.get(e.path) ?? -1
    if (update.changes !== undefined && known === update.version - 1) {
      view.dispatch({ changes: ChangeSet.fromJSON(update.changes), annotations: remote.of(true) })
    } else if (view.state.doc.toString() !== update.text) {
      const line = view.state.doc.lineAt(view.state.selection.main.head).number
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: update.text },
        annotations: remote.of(true),
      })
      const target = view.state.doc.line(Math.min(line, view.state.doc.lines))
      view.dispatch({ selection: { anchor: target.from } })
    }
  }
  // An echo of this window's own edit never moves the version back: later keystrokes were already
  // sent on top of it.
  const own = update.origin !== undefined && editors.has(update.origin)
  versions.set(
    update.path,
    own ? Math.max(versions.get(update.path) ?? 0, update.version) : update.version,
  )
})

export function forgetFilesExcept(live: ReadonlySet<string>): void {
  for (const [id, e] of editors) {
    if (live.has(id)) continue
    e.view?.destroy()
    editors.delete(id)
  }
}

export function focusFile(tabId: string): void {
  editors.get(tabId)?.view?.focus()
}

export function setFileTheme(isDark: boolean): void {
  if (dark === isDark) return
  dark = isDark
  for (const e of editors.values()) {
    e.view?.dispatch({ effects: e.theme.reconfigure(themeOf(isDark)) })
    if (e.preview)
      void act({ type: 'fileState', path: e.path }).then(
        ({ file }) => file && renderPreview(e.tab, e.path, file.text, dark),
      )
  }
}
