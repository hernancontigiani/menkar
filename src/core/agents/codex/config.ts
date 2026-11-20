import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { log } from '../../log'

// What Menkar's `-c` replaces for its own sessions, read from the user's file so it can be passed
// on: a `-c` value wins over the user's config.toml for that run.
export interface UserConfig {
  readonly notify: readonly string[] | null
  readonly developerInstructions: string | null
}

const NONE: UserConfig = { notify: null, developerInstructions: null }

export function codexHome(): string {
  const set = process.env.CODEX_HOME
  return set ? set : join(homedir(), '.codex')
}

// The base config.toml only: a profile is chosen with `-p`, which Menkar never passes, and Codex
// refuses to start on a top-level `profile` key. Read only; a file that cannot be read or parsed
// gives nothing to chain, never a refused start.
export async function readUserConfig(home: string = codexHome()): Promise<UserConfig> {
  const path = join(home, 'config.toml')
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      log.warn("Codex's config.toml could not be read: nothing of it is chained", { path, error })
    return NONE
  }
  let table: Record<string, unknown>
  try {
    table = parse(text)
  } catch (error) {
    log.warn("Codex's config.toml does not parse: nothing of it is chained", { path, error })
    return NONE
  }
  if ('profile' in table) {
    log.warn(
      "Codex's config.toml has a top-level profile, which Codex refuses: nothing is chained",
      {
        path,
      },
    )
    return NONE
  }
  const notify = table.notify
  const instructions = table.developer_instructions
  return {
    notify:
      Array.isArray(notify) &&
      notify.length > 0 &&
      notify.every((word): word is string => typeof word === 'string')
        ? notify
        : null,
    developerInstructions: typeof instructions === 'string' ? instructions : null,
  }
}

// A TOML basic string holding `text` byte for byte. A `-c` value that is not valid TOML is taken
// as a string with its edge spaces and quotes trimmed, and one that is (`42`, `true`) changes type;
// JSON's escapes are TOML's, but a lone surrogate's `\udXXX` is not, so it is replaced first; and
// JSON leaves DEL as it is, which TOML forbids in a string.
export function tomlString(text: string): string {
  return JSON.stringify(text.replace(LONE_SURROGATE, REPLACEMENT)).replaceAll(DEL, '\\u007f')
}

const REPLACEMENT = String.fromCharCode(0xfffd)
const DEL = String.fromCharCode(0x7f)

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
