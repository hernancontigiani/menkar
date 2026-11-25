// What Menkar holds for a Cursor session until it can be handed over: Cursor has no channel into a
// running chat, so a wake waits for the session's next `stop`, whose hook answers it as
// `followup_message`, or for main to end the idle session and resume it with the text.
//
// One folder per pane, one file per held text. Main puts a file in whole (written beside, renamed
// in); the hook takes the whole folder by renaming it away, so a file main puts in after that lands
// in a new folder and waits for the next stop. Which files are gone tells main what was handed over.
import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { controlPaths } from '../../control/files'
import { bottom } from '../shared/screen'
import { state } from './state'

export const heldRoot = (): string => join(controlPaths().root, 'held-wakes')

// The team update sorts before the wakes, which keep the order they came in.
export const TEAM_PREFIX = 'a-team-'
export const WAKE_PREFIX = 'b-wake-'
export const HELD_SUFFIX = '.txt'

// Between two held texts in one message.
export const JOIN = '\n\n'

// Takes every text held for the pane, in order, joined as one message; null when none is held.
// Never waits and never throws: the stop hook calls it.
export function takeHeld(root: string, pane: string): string | null {
  const taken = join(root, `.taken-${pane}-${process.pid}-${randomBytes(4).toString('hex')}`)
  try {
    renameSync(join(root, pane), taken)
  } catch {
    return null // nothing held, or the folder taken by an earlier stop
  }
  try {
    const texts = readdirSync(taken)
      .filter((name) => name.endsWith(HELD_SUFFIX))
      .sort()
      .map((name) => readFileSync(join(taken, name), 'utf8'))
      .filter((text) => text !== '')
    return texts.length > 0 ? texts.join(JOIN) : null
  } catch {
    return null
  } finally {
    rmSync(taken, { recursive: true, force: true })
  }
}

// The placeholders of Cursor's input box while nothing is typed in it, in a chat with messages
// and in a new one. The box is the last line that starts with the arrow; a draft, or a prompt an
// interrupt put back, shows there in their place.
const EMPTY_BOXES = ['→ add a follow-up', '→ plan, search, build anything']
const BOX = /^\s*→/u

// The session waits on the human with nothing typed: no turn running, no card, an empty box. Only
// then may it be ended and resumed, since ending it loses whatever the box holds.
export function quiet(screen: string): boolean {
  if (state.detect('', screen) !== 'idle') return false
  const box = bottom(screen, 8)
    .split('\n')
    .filter((line) => BOX.test(line))
    .at(-1)
  return box !== undefined && EMPTY_BOXES.includes(box.trim())
}
