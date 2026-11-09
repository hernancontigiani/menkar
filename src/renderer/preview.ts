import MarkdownIt from 'markdown-it'
import { act } from './app'
import { el } from './dom'

// CommonMark plus tables and strikethrough; raw HTML shown as text; no linkify, no typography.
const md = new MarkdownIt('commonmark', { html: false, linkify: false, typographer: false }).enable(
  ['table', 'strikethrough'],
)

const PREVIEW_DELAY_MS = 300

const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1)
const fileUrl = (path: string) => `file://${encodeURI(path)}`

// Relative image sources become absolute file: URLs next to the file (the page has no <base>:
// the window's policy forbids one); anything remote is left for the page's policy to block.
function absoluteImages(html: string, path: string): string {
  return html.replace(/<img src="([^"]*)"/g, (whole, src: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/'))
      return src.startsWith('/') ? `<img src="${fileUrl(src)}"` : whole
    return `<img src="${fileUrl(dirOf(path) + decodeURI(src))}"`
  })
}

const COLORS = {
  light: {
    bg: '#ffffff',
    fg: '#1e1e1e',
    rule: '#d0d0d7',
    code: '#f0f0f3',
    muted: '#5e5c64',
    link: '#1c71d8',
  },
  dark: {
    bg: '#1e1e1e',
    fg: '#e8e8ea',
    rule: '#45454d',
    code: '#2e2e35',
    muted: '#b0afb8',
    link: '#78aeed',
  },
}

export function previewPage(text: string, path: string, dark: boolean): string {
  const c = COLORS[dark ? 'dark' : 'light']
  const style = `body{font:15px/1.6 system-ui,sans-serif;max-width:52em;margin:0 auto;padding:1.5em 2em;background:${c.bg};color:${c.fg}}
h1,h2{border-bottom:1px solid ${c.rule};padding-bottom:.3em}
code,pre{font-family:ui-monospace,monospace;font-size:90%;background:${c.code}}
code{padding:.1em .3em;border-radius:4px}pre{padding:.8em 1em;border-radius:6px;overflow-x:auto}pre code{padding:0;background:none}
table{border-collapse:collapse}th,td{border:1px solid ${c.rule};padding:.3em .7em}
blockquote{margin:0;padding-left:1em;border-left:3px solid ${c.rule};color:${c.muted}}img{max-width:100%}a{color:${c.link}}`
  const body = absoluteImages(md.render(text), path)
  return `<!doctype html><html data-theme="${dark ? 'dark' : 'light'}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: data:; style-src 'unsafe-inline'"><style>${style}</style></head><body>${body}</body></html>`
}

interface Frame {
  readonly frame: HTMLIFrameElement
  timer: ReturnType<typeof setTimeout> | undefined
  rendered: boolean
}

const frames = new Map<string, Frame>()

// http(s) links go to the system browser; a link to a .md file opens it in a tab; the rest, and
// every #fragment, do nothing. The page never navigates.
function onLink(event: MouseEvent, path: string): void {
  const anchor = (event.target as Element | null)?.closest('a')
  if (!anchor) return
  event.preventDefault()
  const href = anchor.getAttribute('href') ?? ''
  if (/^https?:\/\//i.test(href)) {
    void act({ type: 'openExternal', url: href })
    return
  }
  if (href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href.replace(/^file:/, ''))) return
  const target = decodeURI(href.replace(/^file:\/\//, '').split('#')[0] ?? '')
  if (!/\.md$/i.test(target)) return
  void act({ type: 'openFilePath', path: target.startsWith('/') ? target : dirOf(path) + target })
}

export function renderPreview(
  tabId: string,
  path: string,
  text: string,
  dark: boolean,
): HTMLElement {
  let f = frames.get(tabId)
  if (!f) {
    const frame = el('iframe', {
      class: 'preview-frame',
      sandbox: 'allow-same-origin',
      title: path,
    }) as HTMLIFrameElement
    const created: Frame = { frame, timer: undefined, rendered: false }
    // The scroll is kept as the user leaves it; a hidden frame (another tab selected) reads 0 and
    // cannot be scrolled, so it is put back when the frame shows again.
    const restore = () => {
      if (frame.offsetWidth > 0) frame.contentWindow?.scrollTo(0, Number(frame.dataset.scroll ?? 0))
    }
    frame.addEventListener('load', () => {
      const doc = frame.contentDocument
      doc?.addEventListener('click', (event) => onLink(event, path))
      frame.contentWindow?.addEventListener('scroll', () => {
        if (frame.offsetWidth > 0) frame.dataset.scroll = String(frame.contentWindow?.scrollY ?? 0)
      })
      restore()
    })
    new ResizeObserver(restore).observe(frame)
    frames.set(tabId, created)
    f = created
  }
  const target = f
  const write = () => {
    target.frame.srcdoc = previewPage(text, path, dark)
    target.rendered = true
  }
  clearTimeout(target.timer)
  if (!target.rendered) write()
  else target.timer = setTimeout(write, PREVIEW_DELAY_MS)
  return target.frame
}
