// The Markdown subset an assistant bubble renders: fenced code and inline code, headings as bold,
// **bold**, bullets. Anything else is text. No Node import, no HTML: the view builds nodes.

export type Span = { readonly text: string; readonly bold?: true; readonly code?: true }
export type Block =
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'line'; readonly spans: readonly Span[] }

function inline(text: string, bold = false): Span[] {
  const spans: Span[] = []
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last)
      spans.push({ text: text.slice(last, at), ...(bold ? { bold: true as const } : {}) })
    if (match[1] !== undefined) spans.push({ text: match[1], code: true })
    else spans.push({ text: match[2] ?? '', bold: true })
    last = at + match[0].length
  }
  if (last < text.length)
    spans.push({ text: text.slice(last), ...(bold ? { bold: true as const } : {}) })
  return spans
}

export function renderMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (line.trimStart().startsWith('```')) {
      const code: string[] = []
      for (i += 1; i < lines.length && !(lines[i] ?? '').trimStart().startsWith('```'); i += 1) {
        code.push(lines[i] ?? '')
      }
      blocks.push({ kind: 'code', text: code.join('\n') })
      continue
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'line', spans: inline(heading[1] ?? '', true) })
      continue
    }
    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      blocks.push({
        kind: 'line',
        spans: [{ text: `${bullet[1] ?? ''}• ` }, ...inline(bullet[2] ?? '')],
      })
      continue
    }
    blocks.push({ kind: 'line', spans: inline(line) })
  }
  return blocks
}
