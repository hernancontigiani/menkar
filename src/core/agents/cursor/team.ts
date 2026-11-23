import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { shellQuote } from '../../command'
import { PRE_COMPACT_ARG } from '../../context/statusline'
import { log } from '../../log'
import type { LaunchContext, LaunchFile, TeamDelivery } from '../types'
import { readVersion } from '../versions'
import { descriptor, NEW_ID_FLOOR } from './descriptor'
import { takesNewId } from './ids'
import type { PluginHooks } from './mcp'

// Cursor holds the block a new chat's sessionStart hook gave it, through resumes and compactions,
// and never sees a later one: what it was told since is what main records for it.
export const team: TeamDelivery = {
  skill: (name, file) => (file ? `\`${name}\` (\`${file}\`)` : `\`${name}\``),
  own: (name, folder) =>
    folder ? `\`menkar:${name}\` (\`${join(folder, name, 'SKILL.md')}\`)` : `\`menkar:${name}\``,
  byName: 'by reading its SKILL.md at the path given',
  part: 'cursor.md',
  heldAtStart: (start, block, recorded) => {
    if (start.kind === 'new') return block
    if (start.kind === 'resume') return recorded ?? null
    return null
  },
  records: true,
  // A resume runs no sessionStart: what a compaction keeps of its creation's block, Menkar does not
  // know, so after one it is told the whole block again.
  startedWith: (start, block) => (start.kind === 'new' ? block : null),
  // The pane's plugin folder carries it: its sessionStart hook answers the block.
  atStart: () => [],
  // A chat Menkar cannot give an id is not known by the hook's pane until it binds.
  floor: {
    version: NEW_ID_FLOOR,
    read: (output) => readVersion(output, descriptor.versionWord),
    accepts: takesNewId,
    notice: 'team.oldCursor',
  },
  orchestratorPrompt: 'orch.firstPromptByFile',
}

// Cursor runs sessionStart once per process, for a new chat only, so a resume is given no hook.
export const SESSION_START_FILE = 'session-start.json'
// Cursor waits for a hook before going on; a file read or a record written takes far less.
const HOOK_TIMEOUT_S = 3
// The program that records a session's start for main, among those Menkar ships.
const RECORD_PROGRAM = 'statusline.js'

// Before a compaction a plugin's preCompact runs, with no entry of the user's: it records the
// compaction for main as a start of the session in the pane.
export function preCompact(ctx: LaunchContext): PluginHooks {
  if (!ctx.execPath || !ctx.programs) return {}
  const program = join(ctx.programs, RECORD_PROGRAM)
  return {
    preCompact: [
      {
        command: `ELECTRON_RUN_AS_NODE=1 ${shellQuote(ctx.execPath)} ${shellQuote(program)} ${PRE_COMPACT_ARG}`,
        timeout: HOOK_TIMEOUT_S,
      },
    ],
  }
}

// The hook's answer, and the hook that prints it: Cursor runs `command` through a shell.
export function sessionStart(
  folder: string,
  teamFile: string,
): { readonly file: LaunchFile; readonly hooks: PluginHooks } {
  const path = join(folder, SESSION_START_FILE)
  return {
    file: {
      path,
      text: async () => {
        let block = ''
        try {
          block = await readFile(teamFile, 'utf8')
        } catch (error) {
          log.warn('the team block could not be read: the session starts without it', {
            teamFile,
            error,
          })
        }
        return `${JSON.stringify({ additional_context: block })}\n`
      },
    },
    hooks: {
      sessionStart: [{ command: `cat ${shellQuote(path)}`, timeout: HOOK_TIMEOUT_S }],
    },
  }
}
