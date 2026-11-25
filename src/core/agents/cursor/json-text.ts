import { type JsonValue, jsonEqual } from '../../context/settings'

// Edits a JSON file's text in place, so every byte outside what Menkar adds stays as the user wrote
// it: their indentation, key order, number spellings and escapes. Adding appends after the last
// element with the separator the container already uses, and removing an appended element deletes
// exactly those bytes, so adding then removing gives the file back byte for byte.

export type JsonNode =
  | {
      readonly kind: 'object'
      readonly start: number
      readonly end: number
      readonly members: readonly Member[]
    }
  | {
      readonly kind: 'array'
      readonly start: number
      readonly end: number
      readonly items: readonly JsonNode[]
    }
  | { readonly kind: 'scalar'; readonly start: number; readonly end: number }

interface Member {
  readonly key: string
  // From the key's opening quote to the value's end.
  readonly start: number
  readonly end: number
  readonly value: JsonNode
}

// The text's structure with each value's offsets. Throws a SyntaxError when it is not JSON.
export function parseSpans(text: string): JsonNode {
  JSON.parse(text)
  let at = 0
  const space = () => {
    while (at < text.length && ' \t\n\r'.includes(text.charAt(at))) at++
  }
  const string = (): string => {
    const start = at
    at++
    while (text.charAt(at) !== '"') at += text.charAt(at) === '\\' ? 2 : 1
    at++
    return JSON.parse(text.slice(start, at)) as string
  }
  const value = (): JsonNode => {
    space()
    const start = at
    const c = text.charAt(at)
    if (c === '{') {
      at++
      const members: Member[] = []
      space()
      while (text.charAt(at) !== '}') {
        const keyStart = at
        const key = string()
        space()
        at++ // the colon
        const v = value()
        members.push({ key, start: keyStart, end: v.end, value: v })
        space()
        if (text.charAt(at) === ',') at++
        space()
      }
      at++
      return { kind: 'object', start, end: at, members }
    }
    if (c === '[') {
      at++
      const items: JsonNode[] = []
      space()
      while (text.charAt(at) !== ']') {
        items.push(value())
        space()
        if (text.charAt(at) === ',') at++
        space()
      }
      at++
      return { kind: 'array', start, end: at, items }
    }
    if (c === '"') {
      string()
      return { kind: 'scalar', start, end: at }
    }
    while (at < text.length && !' \t\n\r,]}'.includes(text.charAt(at))) at++
    return { kind: 'scalar', start, end: at }
  }
  return value()
}

const splice = (text: string, start: number, end: number, insert = '') =>
  text.slice(0, start) + insert + text.slice(end)

const childSpans = (node: JsonNode): readonly { start: number; end: number }[] =>
  node.kind === 'object' ? node.members : node.kind === 'array' ? node.items : []

// Appends a child's text (an element, or a `"key": value` member) as the container's last.
function append(text: string, container: JsonNode, child: string): string {
  const children = childSpans(container)
  const last = children.at(-1)
  if (!last) return splice(text, container.start + 1, container.start + 1, child)
  const previous = children.at(-2)
  const separator = previous
    ? text.slice(previous.end, last.start)
    : `,${text.slice(container.start + 1, last.start)}`
  return splice(text, last.end, last.end, separator + child)
}

// Removes the container's child at `index`, with the separator before it (or after it, when it is
// the first of several).
function removeAt(text: string, container: JsonNode, index: number): string {
  const children = childSpans(container)
  const child = children[index]
  if (!child) return text
  const before = children[index - 1]
  const after = children[index + 1]
  if (before) return splice(text, before.end, child.end)
  if (after) return splice(text, child.start, after.start)
  return splice(text, child.start, child.end)
}

// The whitespace that starts the container's last child's line, or null when its children do not
// start lines of their own.
function indentOf(text: string, container: JsonNode): string | null {
  const children = childSpans(container)
  const last = children.at(-1)
  if (!last) return null
  const gap = text.slice(children.at(-2)?.end ?? container.start + 1, last.start)
  const newline = gap.lastIndexOf('\n')
  return newline < 0 ? null : gap.slice(newline + 1)
}

const jsonAt = (text: string, node: JsonNode): JsonValue =>
  JSON.parse(text.slice(node.start, node.end)) as JsonValue

// The node at `path` (object keys from the root), or null.
export function nodeAt(root: JsonNode, path: readonly string[]): JsonNode | null {
  let node: JsonNode = root
  for (const key of path) {
    if (node.kind !== 'object') return null
    const member: Member | undefined = node.members.find((m) => m.key === key)
    if (!member) return null
    node = member.value
  }
  return node
}

export class ShapeError extends Error {}

export interface Added {
  readonly text: string
  // Whether the item was added (false: an equal one was there already).
  readonly added: boolean
  // How many of the path's keys, from its end, were created to hold it.
  readonly created: number
}

// Adds `item` to the array at `path` unless an equal element is there, creating the missing keys
// of the path as objects and its last as an array. A key on the path holding another kind of value
// is the user's and is refused, never replaced.
export function addToArray(text: string, path: readonly string[], item: JsonValue): Added {
  const root = parseSpans(text)
  if (root.kind !== 'object') throw new ShapeError('root')
  let node: JsonNode = root
  for (let depth = 0; depth < path.length; depth++) {
    const key = path[depth] as string
    if (node.kind !== 'object') throw new ShapeError(path.slice(0, depth).join('.'))
    const member: Member | undefined = node.members.find((m) => m.key === key)
    if (!member) {
      // A created object is laid out as the container's own children are: on lines of their own
      // when they are, one level deeper.
      const indent = indentOf(text, node)
      const inners = path.slice(depth + 1)
      let value = JSON.stringify([item])
      inners.forEach((inner, i) => {
        const level = inners.length - 1 - i
        const outer = indent === null ? null : indent + '  '.repeat(level)
        const field = `${JSON.stringify(inner)}: ${value}`
        value = outer === null ? `{${field}}` : `{\n${outer}  ${field}\n${outer}}`
      })
      return {
        text: append(text, node, `${JSON.stringify(key)}: ${value}`),
        added: true,
        created: path.length - depth,
      }
    }
    node = member.value
  }
  if (node.kind !== 'array') throw new ShapeError(path.join('.'))
  if (node.items.some((element) => jsonEqual(jsonAt(text, element), item)))
    return { text, added: false, created: 0 }
  return { text: append(text, node, JSON.stringify(item)), added: true, created: 0 }
}

// Removes the first element equal to `item` from the array at `path`; then each of the path's
// last `created` keys whose value is left empty, deepest first. Text that no longer holds the item
// is returned as it is.
export function removeFromArray(
  text: string,
  path: readonly string[],
  item: JsonValue,
  created: number,
): string {
  const array = nodeAt(parseSpans(text), path)
  if (array?.kind !== 'array') return text
  const index = array.items.findIndex((element) => jsonEqual(jsonAt(text, element), item))
  if (index < 0) return text
  let result = removeAt(text, array, index)
  for (let depth = path.length; depth > path.length - created && depth > 0; depth--) {
    const root = parseSpans(result)
    const value = nodeAt(root, path.slice(0, depth))
    if (!value || childSpans(value).length > 0) break
    const parent = nodeAt(root, path.slice(0, depth - 1))
    if (parent?.kind !== 'object') break
    const at = parent.members.findIndex((m) => m.key === path[depth - 1])
    result = removeAt(result, parent, at)
  }
  return result
}

// Whether the array at `path` holds an element equal to `item`.
export function holds(text: string, path: readonly string[], item: JsonValue): boolean {
  const array = nodeAt(parseSpans(text), path)
  return array?.kind === 'array' && array.items.some((e) => jsonEqual(jsonAt(text, e), item))
}
