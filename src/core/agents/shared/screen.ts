// The line breaks Python's splitlines() honours: the state rules' line counts were tuned counting
// them.
const LINE_BREAK = new RegExp(
  `\r\n|[\n\r\v\f\x1c-\x1e${String.fromCodePoint(0x85, 0x2028, 0x2029)}]`,
  'u',
)

// The last n lines that hold a non-space character, lowercased.
export function bottom(screen: string, n: number): string {
  const lines = screen.split(LINE_BREAK).filter((line) => line.trim() !== '')
  return lines.slice(-n).join('\n').toLowerCase()
}
